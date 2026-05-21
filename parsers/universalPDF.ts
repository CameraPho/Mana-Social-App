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
        continue
      }

      if (line.includes('","')) {
        const parts = line.split('","').map(p => p.replace(/"/g, '').trim())
        if (parts.length >= 3) {
          const dateStr = parts[0]
          let desc = parts[1]
          const rawAmt = parts[2]

          if (dateStr.match(/^\d{2}\/\d{2}$/) && dateStr.includes('/')) {
            const [mm, dd] = dateStr.split('/')
            let amount = parseFloat(rawAmt.replace(/,/g, ''))
            if (isNaN(amount)) continue

            if (inPaymentsSection) {
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
  } 
  
  else if (bankType === 'CITI') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (line.includes('","') || (line.startsWith('"') && line.includes(','))) {
        const parts = line.split(',').map(p => p.replace(/"/g, '').trim())
        const dateIdx = parts.findIndex(p => p.match(/^\d{2}\/\d{2}$/))
        
        if (dateIdx !== -1 && parts.length > dateIdx + 2) {
          const dateStr = parts[dateIdx]
          
          // Defensive Check to completely clear the split crash
          if (!dateStr || !dateStr.includes('/')) {
            continue
          }
          
          const [mm, dd] = dateStr.split('/')
          let desc = parts[dateIdx + 1]
          const rawAmt = parts[parts.length - 1]
          
          let amount = parseFloat(rawAmt.replace(/[$\s,]/g, ''))
          if (isNaN(amount)) continue

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
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (line.includes(',') || line.includes('","')) {
        const parts = line.split(',').map(p => p.replace(/"/g, '').trim())
        const dateIdx = parts.findIndex(p => p.match(/^\d{2}\/\d{2}\/\d{2,4}$/) || p.match(/^\d{2}\/\d{2}$/))
        
        if (dateIdx !== -1 && parts.length >= 2) {
          const dateStr = parts[dateIdx].slice(0, 5)
          
          if (!dateStr || !dateStr.includes('/')) {
            continue
          }
          
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