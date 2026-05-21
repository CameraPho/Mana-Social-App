import type { ParseResult } from '@/lib/types'

export async function parsePDF(
  file: File,
  accountName: string
): Promise<ParseResult> {
  const arrayBuf = await file.arrayBuffer()
  const decoder = new TextDecoder('utf-8')
  const fullText = decoder.decode(arrayBuf)

  const lines = fullText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  // 1. DYNAMICALLY IDENTIFY BANK STATEMENT TYPE
  let bankType: 'CHASE' | 'CITI' | 'BARCLAYS' = 'CHASE'
  
  for (const line of lines) {
    const upperStr = line.toUpperCase()
    if (upperStr.includes("CITIBANK") || upperStr.includes("CITICARDS") || upperStr.includes("COSTCO ANYWHERE")) {
      bankType = 'CITI'
      break
    }
    if (upperStr.includes("BARCLAYS")) {
      bankType = 'BARCLAYS'
      break
    }
  }

  // 2. EXTRACT STATEMENT YEAR NATIVELY
  let stmtYear = String(new Date().getFullYear())
  const periodMatch = fullText.match(
    /(?:Statement Period|Billing Period|Opening\/Closing Date)\s*["\s,]*(\d{2})\/(\d{2})\/(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{2})/i
  )
  if (periodMatch) {
    stmtYear = `20${periodMatch[6]}`
  } else {
    // Backup boundary lookup for generic text loops
    const yearMatch = fullText.match(/\b(202\d)\b/)
    if (yearMatch) stmtYear = yearMatch[1]
  }

  const records: any[] = []

  // 3. ROUTE TO BANK SPECIFIC PARSING ENGINE
  if (bankType === 'CHASE') {
    let inPaymentsSection = false
    let inPurchasesSection = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const upperLine = line.toUpperCase()

      if (upperLine.includes("PAYMENTS") && upperLine.includes("CREDITS")) {
        inPaymentsSection = true
        inPurchasesSection = false
        continue
      }
      if (upperLine.includes("PURCHASE") && !upperLine.includes("SUMMARY")) {
        inPurchasesSection = true
        inPaymentsSection = false
        continue
      }
      if (upperLine.includes("TOTALS YEAR-TO-DATE") || upperLine.includes("INTEREST CHARGES")) {
        if (upperLine.includes("INTEREST CHARGED") && inPurchasesSection) {
          // Fallthrough allowed for single interest line tracking
        } else {
          continue
        }
      }

      // Extract quoted comma segments: "MM/DD","Merchant/Desc","Amount"
      if (line.includes('","')) {
        const parts = line.split('","').map(p => p.replace(/"/g, '').trim())
        if (parts.length >= 3) {
          const dateStr = parts[0]
          let desc = parts[1]
          const rawAmt = parts[2]

          if (dateStr.match(/^\d{2}\/\d{2}$/)) {
            const [mm, dd] = dateStr.split('/')
            let amount = parseFloat(rawAmt.replace(/,/g, ''))
            if (isNaN(amount)) continue

            if (inPaymentsSection) {
              amount = -Math.abs(amount) // Payments/Credits reduce credit balance
            } else {
              amount = Math.abs(amount)  // Charges increase balance
            }

            records.push({
              transaction_date: `${stmtYear}-${mm}-${dd}`,
              description: desc.slice(0, 200),
              amount: amount,
              account_name: accountName,
            })
          }
        }
      }
    }
  } 
  
  else if (bankType === 'CITI') {
    // Citi parses text row objects directly by identifying dates and looking for leading math operators
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Look for standard data structures containing quotes and commas
      if (line.includes('","') || (line.startsWith('"') && line.includes(','))) {
        const parts = line.split(',').map(p => p.replace(/"/g, '').trim())
        
        // Find a part matching MM/DD
        const dateIdx = parts.findIndex(p => p.match(/^\d{2}\/\d{2}$/))
        if (dateIdx !== -1 && parts.length > dateIdx + 2) {
          const dateStr = parts[dateIdx]
          const [mm, dd] = dateStr.split('/')
          
          // Description is usually right after the date, amount is the final numerical index
          let desc = parts[dateIdx + 1]
          const rawAmt = parts[parts.length - 1]
          
          let amount = parseFloat(rawAmt.replace(/[$\s,]/g, ''))
          if (isNaN(amount)) continue

          // Check if it's a payment/credit (Citi flags payments explicitly with a minus sign or via summary context)
          if (rawAmt.includes('-') || /PAYMENT|THANK YOU|CREDIT/i.test(desc)) {
            amount = -Math.abs(amount)
          } else {
            amount = Math.abs(amount)
          }

          records.push({
            transaction_date: `${stmtYear}-${mm}-${dd}`,
            description: desc.slice(0, 200),
            amount: amount,
            account_name: accountName,
          })
        }
      }
    }
  } 
  
  else if (bankType === 'BARCLAYS') {
    // Barclays loops through structured items looking for MM/DD patterns inside clean text nodes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (line.includes(',') || line.includes('","')) {
        const parts = line.split(',').map(p => p.replace(/"/g, '').trim())
        
        const dateIdx = parts.findIndex(p => p.match(/^\d{2}\/\d{2}\/\d{2,4}$/) || p.match(/^\d{2}\/\d{2}$/))
        if (dateIdx !== -1 && parts.length >= 2) {
          const dateStr = parts[dateIdx].slice(0, 5) // Extract clean MM/DD
          const [mm, dd] = dateStr.split('/')
          
          let desc = parts.find((p, idx) => idx !== dateIdx && isNaN(parseFloat(p)) && p.length > 2) || "Transaction"
          const rawAmt = parts[parts.length - 1]
          
          let amount = parseFloat(rawAmt.replace(/[$\s,]/g, ''))
          if (isNaN(amount)) continue

          if (/PAYMENT|CREDIT|THANK YOU/i.test(desc) || rawAmt.includes('-')) {
            amount = -Math.abs(amount)
          } else {
            amount = Math.abs(amount)
          }

          records.push({
            transaction_date: `${stmtYear}-${mm}-${dd}`,
            description: desc.slice(0, 200),
            amount: amount,
            account_name: accountName,
          })
        }
      }
    }
  }

  // Deduplicate any rows parsed twice due to multi-page statement carry-overs
  const uniqueRecords = records.filter((v, i, a) => 
    a.findIndex(t => t.transaction_date === v.transaction_date && t.description === v.description && t.amount === v.amount) === i
  )

  return {
    records: uniqueRecords,
    meta: {
      rows: uniqueRecords.length,
      year: stmtYear,
      fileName: file.name,
    }
  }
}