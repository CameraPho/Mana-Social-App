import type { ParseResult } from '@/lib/types'

// Secure, high-performance web distribution URL for PDF.js core workers
const PDFJS_CDN_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs'
const PDFJS_CDN_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs'

export async function parsePDF(
  file: File,
  accountName: string
): Promise<ParseResult> {
  let fullText = ''

  try {
    // 1. DYNAMICALLY LOAD THE PDF ENGINE AT RUNTIME (Bypasses Vercel Bundler entirely)
    const pdfjsLib = await import(/* @vite-ignore */ /* webpackIgnore: true */ PDFJS_CDN_SCRIPT)
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN_WORKER

    // 2. EXTRACT REAL TEXT LAYOUT ROWS FROM BINARY STRINGS
    const arrayBuf = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const content = await page.getTextContent()
      let lastY: number | null = null
      let pageText = ''

      for (const item of content.items as any[]) {
        const y = item.transform[5]
        // If text moves to a new vertical baseline row, inject a clean newline character
        if (lastY !== null && Math.abs(y - lastY) > 3) {
          pageText += '\n'
        } else if (pageText.length && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
          pageText += ' '
        }
        pageText += item.str
        lastY = y
      }
      fullText += pageText + '\n'
    }
  } catch (err) {
    console.error("PDF Core Extraction failed via CDN channel:", err)
    throw new Error("Unable to decode binary PDF assets. Please check internet connection properties.")
  }

  const lines = fullText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  // 3. AUTO-DETECT BANK STATEMENT FORMAT
  let bankType: 'CHASE' | 'CITI' | 'BARCLAYS' = 'CHASE'
  for (const line of lines) {
    const upperStr = line.toUpperCase()
    if (upperStr.includes("CITIBANK") || upperStr.includes("CITICARDS") || upperStr.includes("COSTCO")) {
      bankType = 'CITI'
      break
    }
    if (upperStr.includes("BARCLAYS")) {
      bankType = 'BARCLAYS'
      break
    }
  }

  // 4. PARSE STATEMENT YEAR
  let stmtYear = String(new Date().getFullYear())
  const periodMatch = fullText.match(
    /(?:Opening\/Closing Date|Billing Period|Statement Period)\s*(\d{2})\/(\d{2})\/(\d{2})/i
  )
  if (periodMatch) {
    stmtYear = `20${periodMatch[3]}`
  } else {
    const yearMatch = fullText.match(/\b(202\d)\b/)
    if (yearMatch) stmtYear = yearMatch[1]
  }

  const records: any[] = []

  // 5. NATIVE TRANSACTION LINE EXTRACTION MATRICES
  if (bankType === 'CHASE') {
    let currentSection: 'PAYMENT' | 'PURCHASE' | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const upperLine = line.toUpperCase()

      if (upperLine.includes("PAYMENTS") && upperLine.includes("CREDITS")) {
        currentSection = 'PAYMENT'
        continue
      }
      if (upperLine.includes("PURCHASE") && !upperLine.includes("SUMMARY")) {
        currentSection = 'PURCHASE'
        continue
      }

      // Matches: "MM/DD MERCHANT DESCRIPTION AMOUNT" or "MM/DD MM/DD MERCHANT AMOUNT"
      const chaseMatch = line.match(/^(\d{2})\/(\d{2})\s+(?:(\d{2})\/(\d{2})\s+)?(.+?)\s+([+-]?[\d,]+\.\d{2})$/)
      if (chaseMatch && currentSection) {
        const [, mm, dd, , , desc, rawAmt] = chaseMatch
        let amount = parseFloat(rawAmt.replace(/,/g, ''))
        if (isNaN(amount)) continue

        // Adjust sign convention dynamically based on card sections
        amount = currentSection === 'PAYMENT' ? -Math.abs(amount) : Math.abs(amount)

        records.push({
          transaction_date: `${stmtYear}-${mm}-${dd}`,
          description: desc.trim(),
          amount: amount,
          account_name: accountName,
        })
      }
    }
  } 
  
  else if (bankType === 'CITI') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Matches standard Citi rows: "MM/DD Merchant Description -$123.45" or "+$123.45"
      const citiMatch = line.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+([+-]?\$[\d,]+\.\d{2})$/)
      if (citiMatch) {
        const [, mm, dd, desc, rawAmt] = citiMatch
        let amount = parseFloat(rawAmt.replace(/[$\s,]/g, ''))
        if (isNaN(amount)) continue

        // Check for natural negative markers or common credit descriptions
        if (rawAmt.includes('-') || /PAYMENT|THANK YOU|CREDIT/i.test(desc)) {
          amount = -Math.abs(amount)
        } else {
          amount = Math.abs(amount)
        }

        records.push({
          transaction_date: `${stmtYear}-${mm}-${dd}`,
          description: desc.trim(),
          amount: amount,
          account_name: accountName,
        })
      }
    }
  } 
  
  else if (bankType === 'BARCLAYS') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Matches Barclays matrix variants: "MM/DD Description $123.45"
      const barclaysMatch = line.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+([+-]?\$?[\d,]+\.\d{2})(?:\s*[-+=])?$/)
      if (barclaysMatch) {
        const [, mm, dd, desc, rawAmt] = barclaysMatch
        let amount = parseFloat(rawAmt.replace(/[$\s,]/g, ''))
        if (isNaN(amount)) continue

        if (/PAYMENT|CREDIT|THANK YOU/i.test(desc) || rawAmt.includes('-')) {
          amount = -Math.abs(amount)
        } else {
          amount = Math.abs(amount)
        }

        records.push({
          transaction_date: `${stmtYear}-${mm}-${dd}`,
          description: desc.trim(),
          amount: amount,
          account_name: accountName,
        })
      }
    }
  }

  // Deduplicate overlapping page splits automatically
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