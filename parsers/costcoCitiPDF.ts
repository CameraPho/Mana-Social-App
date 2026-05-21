import type { ParseResult } from '@/lib/types'

// Citi credit card statements use a "Sale Date" + "Post Date" format with sections:
//   "Payments, Credits and Adjustments" — payments TO the card (positive sign on statement, becomes +amount for us)
//   "Cash Advances" — cash advances (charges, negative for us)
//   "Promo Purchase-Offer X" — promotional rate purchases (charges, negative for us)
//   "Fees Charged" — cash advance fees, late fees, etc. (negative for us)
//   "Interest Charged" — interest (negative for us)

const HEADER_PAYMENTS  = /payments,?\s+credits\s+and\s+adjustments/i
const HEADER_CASH_ADV  = /^cash\s+advances$/i
const HEADER_PROMO     = /promo\s+purchase|promotional\s+purchase|standard\s+purch/i
const HEADER_PURCHASES = /^purchases?$/i
const HEADER_FEES      = /^fees?\s+charged$/i
const HEADER_INTEREST  = /^interest\s+charged$/i

// Sections that should END parsing (footer/summary content)
const END_MARKERS = [
  /interest\s+charge\s+calculation/i,
  /total\s+fees\s+for\s+this\s+period/i,
  /total\s+interest\s+for\s+this\s+period/i,
  /2026\s+totals\s+year-to-date/i,
  /account\s+messages/i,
  /costco\s+cash\s+back\s+rewards\s+summary/i,
]

type Section = 'payments' | 'cash_advance' | 'purchase' | 'fees' | 'interest' | null

export async function parseCostcoCitiPDF(file: File): Promise<ParseResult> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any)
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs'
  const arrayBuf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise

  let fullText = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    let lastY: number | null = null
    for (const item of content.items as any[]) {
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) fullText += '\n'
      else if (fullText.length && !fullText.endsWith('\n')) fullText += ' '
      fullText += item.str
      lastY = y
    }
    fullText += '\n'
  }

  // Extract year from billing period: "Billing Period: 04/04/26-05/05/26"
  const periodMatch = fullText.match(/billing\s+period:?\s*(\d{2})\/(\d{2})\/(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{2})/i)
  const stmtYear = periodMatch ? `20${periodMatch[6]}` : String(new Date().getFullYear())

  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  // Citi date format: MM/DD (e.g. "04/13", "05/03"). Two columns: Sale Date + Post Date.
  // When parsing a transaction row, we use the SALE DATE (first one).
  // A typical purchase row: "04/04 04/04 COSTCO WHSE #0455 ... $223.79"
  // A payment row in payments section: "04/06 ONLINE PAYMENT, THANK YOU -$223.79"
  // Note: in payments section, only ONE date appears (post date), not two.
  // Fees/Interest section: "05/05 ADVANCES*TRANSACTION FEE $40.30" — single date
  const dateRe = /(\d{2})\/(\d{2})/g
  const moneyRe = /-?\$?[\d,]+\.\d{2}/g

  const records: any[] = []
  let section: Section = null
  let promoLabel: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check end markers — stop parsing after summary sections
    if (END_MARKERS.some(re => re.test(line))) {
      // Only end if we're past the fees/interest sections OR if it's the interest calculation table
      if (/interest\s+charge\s+calculation/i.test(line)) break
    }

    // Detect section headers
    if (HEADER_PAYMENTS.test(line)) { section = 'payments'; continue }
    if (HEADER_CASH_ADV.test(line)) { section = 'cash_advance'; continue }
    if (HEADER_PROMO.test(line)) {
      section = 'purchase'
      // Capture promo label like "Promo Purchase-Offer 5 (9.990%)"
      const promoMatch = line.match(/(promo\s+purchase[\s\S]*?)$/i)
      promoLabel = promoMatch ? promoMatch[1].trim() : null
      continue
    }
    if (HEADER_PURCHASES.test(line)) { section = 'purchase'; promoLabel = null; continue }
    if (HEADER_FEES.test(line)) { section = 'fees'; continue }
    if (HEADER_INTEREST.test(line)) { section = 'interest'; continue }

    if (!section) continue

    // Skip total/footer rows within a section
    if (/^total\s+(fees|interest|payments|purchases)/i.test(line)) continue
    if (/^total\s+(costco|cash)/i.test(line)) continue
    if (/^new\s+balance|^previous\s+balance|^minimum\s+payment/i.test(line)) continue

    // Find all dates in the line
    const dateMatches = [...line.matchAll(/(\d{2})\/(\d{2})/g)]
    if (dateMatches.length === 0) continue

    // Find money amounts
    const moneyMatches = [...line.matchAll(/(-?\$?[\d,]+\.\d{2})/g)]
    if (moneyMatches.length === 0) continue

    // Pick the LAST money amount as the transaction amount (often the only one)
    const rawAmt = moneyMatches[moneyMatches.length - 1][1]
    const isNegativeOnStatement = rawAmt.startsWith('-')
    const amount = parseFloat(rawAmt.replace(/[$,\-]/g, ''))
    if (!amount || isNaN(amount)) continue

    // Use first date as the transaction date
    const mm = dateMatches[0][1]
    const dd = dateMatches[0][2]

    // Extract description: text between dates and amounts
    // Strategy: take everything, remove date patterns and money patterns
    let desc = line
      .replace(/(\d{2})\/(\d{2})/g, ' ')
      .replace(/-?\$?[\d,]+\.\d{2}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!desc || desc.length < 2) continue
    // Skip if description is just punctuation or section labels
    if (/^(sale|post|date|description|amount)$/i.test(desc)) continue

    // Determine signed amount based on section + statement sign
    let signedAmount: number
    if (section === 'payments') {
      // Statement shows payments as negative; we want them as POSITIVE (credit to liability)
      signedAmount = Math.abs(amount)
    } else {
      // All other sections: charges, fees, interest, cash advances → NEGATIVE
      signedAmount = -Math.abs(amount)
    }

    // Annotate description with promo label if applicable
    let finalDesc = desc
    if (section === 'cash_advance') finalDesc = `[Cash Advance] ${desc}`
    else if (section === 'fees') finalDesc = `[Fee] ${desc}`
    else if (section === 'interest') finalDesc = `[Interest] ${desc}`
    else if (section === 'purchase' && promoLabel) finalDesc = `${desc} (${promoLabel})`

    records.push({
      transaction_date: `${stmtYear}-${mm}-${dd}`,
      description: finalDesc.slice(0, 200),
      amount: signedAmount,
      account_name: 'Costco Citi Visa',
    })
  }

  return { records, meta: { rows: records.length, year: stmtYear, fileName: file.name } }
}
