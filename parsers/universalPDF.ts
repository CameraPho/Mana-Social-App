import type { ParseResult } from '@/lib/types'

const PDFJS_CDN_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs'
const PDFJS_CDN_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs'

export async function parsePDF(
  file: File,
  accountName: string
): Promise<ParseResult> {
  let fullText = ''

  try {
    const pdfjsLib = await import(/* @vite-ignore */ /* webpackIgnore: true */ PDFJS_CDN_SCRIPT)
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN_WORKER

    const arrayBuf = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const content = await page.getTextContent()
      let lastY: number | null = null
      let pageText = ''

      for (const item of content.items as any[]) {
        const y = item.transform[5]
        if (lastY !== null && Math.abs(y - lastY) > 4) {
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
    console.error("PDF Core Extraction failed:", err)
    throw new Error("Unable to parse file asset structure safely.")
  }

  const lines = fullText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  // 1. AUTO-DETECT BANK TYPE SAFELY
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

  // 2. PARSE STATEMENT YEAR BOUNDARY
  let stmtYear = String(new Date().getFullYear())
  const periodMatch = fullText.match(
    /(?:Opening\/Closing Date|Billing Period|Statement Period|Account Ending)[^\n]{0,50}(\d{2})\/(\d{2})\/(\d{2})/i
  )
  if (periodMatch) {
    stmtYear = `20${periodMatch[3]}`
  } else {
    const yearMatch = fullText.match(/\b(202[5-9])\b/)
    if (yearMatch) stmtYear = yearMatch[1]
  }

  const records: any[] = []
  let currentSection: 'PAYMENT' | 'PURCHASE' = 'PURCHASE'

  // 3. ROBUST PARSING PIPELINE FOR EVERY BANK INTERFACE
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const upperLine = line.toUpperCase()

    // Dynamic Section Header Mapping
    if (upperLine.includes("PAYMENTS") && (upperLine.includes("CREDITS") || upperLine.includes("OTHER"))) {
      currentSection = 'PAYMENT'
      continue
    }
    if (upperLine.includes("PURCHASE") && !upperLine.includes("SUMMARY") && !upperLine.includes("TOTALS")) {
      currentSection = 'PURCHASE'
      continue
    }
    if (upperLine.includes("TOTALS YEAR-TO-DATE") || upperLine.includes("FEES CHARGED") || upperLine.includes("INTEREST CHARGED")) {
      if (!/\d{2}\/\d{2}/.test(line)) continue
    }

    // Capture standard and multi-column transaction rows (e.g. Barclays posting dates and rewards markers)
    // Anchors on the opening MM/DD date stamp, filters through middling segments, captures the final monetary amount string
    const txnMatch = line.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+([-+]?\s*\$?\s*[\d,]+\.\d{2})\s*[-+=]?$/)
    
    if (txnMatch) {
      const [, mm, dd, rawDesc, rawAmt] = txnMatch
      let desc = rawDesc.replace(/["']/g, '').trim()
      
      // Clean up secondary sub-column fields specific to Barclays (e.g., removing leading "MM/DD" posting dates or isolated reward digits)
      if (bankType === 'BARCLAYS') {
        desc = desc.replace(/^^\d{2}\/\d{2}\s+/, '') // Remove optional posting date duplicates
        desc = desc.replace(/\s+\d+\s*$/, '')       // Remove trailing isolated reward points numbers
      }

      let cleanAmt = rawAmt.replace(/[$\s,]/g, '')
      let amount = parseFloat(cleanAmt)
      if (isNaN(amount)) continue

      // Filter out total statements masquerading as line transactions
      if (/PREVIOUS BALANCE|NEW BALANCE|MINIMUM PAYMENT|TOTAL PURCHASES/i.test(desc)) continue

      // Normalize arithmetic math directions dynamically depending on bank platform rules
      if (bankType === 'CHASE') {
        amount = currentSection === 'PAYMENT' ? -Math.abs(amount) : Math.abs(amount)
      } else {
        if (rawAmt.includes('-') || cleanAmt.includes('-') || /PAYMENT|THANK YOU|CREDIT/i.test(desc)) {
          amount = -Math.abs(amount)
        } else {
          amount = Math.abs(amount)
        }
      }

      records.push({
        transaction_date: `${stmtYear}-${mm}-${dd}`,
        description: desc.slice(0, 200),
        amount: amount,
        account_name: accountName,
      })
    }
  }

  // Deduplicate overlapping multi-page record lines
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