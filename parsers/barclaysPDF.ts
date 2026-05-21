import type { ParseResult } from '@/lib/types'

// Barclays View Mastercard statement format:
//   "Payments" — payments TO the card (shown as positive $X on statement, but in Payments section)
//   "Purchase Activity for CAMERA PHO card ending XXXX" — purchases
//   "Fees Charged" — fees
//   "Interest Charged" — interest
// Date format: "Apr 16" (month abbreviation + day), no year
// Each row also has a Points column we need to ignore.

const HEADER_PAYMENTS = /^payments$/i
const HEADER_PURCHASES = /^purchase\s+activity/i
const HEADER_FEES     = /^fees?\s+charged$/i
const HEADER_INTEREST = /^interest\s+charged$/i

const END_MARKERS = [
  /total\s+interest\s+for\s+this\s+period/i,
  /total\s+fees\s+for\s+this\s+period/i,
  /year-to-date\s+totals/i,
  /interest\s+charge\s+calculation/i,
  /points\s+details/i,
]

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12'
}

type Section = 'payments' | 'purchase' | 'fees' | 'interest' | null

export async function parseBarclaysPDF(file: File): Promise<ParseResult> {
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

  // Statement period: "Statement Period 04/05/26 - 05/04/26"
  const periodMatch = fullText.match(/statement\s+period\s+(\d{2})\/(\d{2})\/(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{2})/i)
  const stmtYear = periodMatch ? `20${periodMatch[6]}` : String(new Date().getFullYear())

  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  const records: any[] = []
  let section: Section = null
  let inTransactionSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^transactions$/i.test(line)) { inTransactionSection = true; continue }
    if (!inTransactionSection) continue

    if (END_MARKERS.some(re => re.test(line))) break

    if (HEADER_PAYMENTS.test(line)) { section = 'payments'; continue }
    if (HEADER_PURCHASES.test(line)) { section = 'purchase'; continue }
    if (HEADER_FEES.test(line)) { section = 'fees'; continue }
    if (HEADER_INTEREST.test(line)) { section = 'interest'; continue }

    if (!section) continue

    // Skip "No Payment Received" / "No fees charged" / etc.
    if (/^no\s+(payment|fees?|interest|charges?)/i.test(line)) continue
    if (/^total\s+(payments?|purchase|fees|interest)/i.test(line)) continue
    if (/^transaction\s+date/i.test(line)) continue

    // Barclays row format: "Apr 16 Apr 17 PAYPAL *KENSAN003 4029357733 CA 1,386 $1,385.80"
    //                      sale_mo day post_mo day  ...description...                  points  amount
    // Date pattern: month abbreviation + day
    const dateRe = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})\s+/i
    const dateMatch = line.match(dateRe)
    if (!dateMatch) continue

    const monthAbbr = dateMatch[1].toLowerCase()
    const day = dateMatch[2].padStart(2, '0')
    const month = MONTH_MAP[monthAbbr]
    if (!month) continue

    let rest = line.slice(dateMatch[0].length)

    // Strip the second date (post date) if present
    const postDateMatch = rest.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})\s+/i)
    if (postDateMatch) rest = rest.slice(postDateMatch[0].length)

    // Find money amounts (with $ prefix)
    // Barclays format: points number (no $) THEN amount with $
    const moneyMatches = [...rest.matchAll(/\$?([\d,]+\.\d{2})/g)]
    if (moneyMatches.length === 0) continue

    // The amount is always the LAST $-prefixed number
    // Filter out point counts (integers without decimals don't match \d+\.\d{2} anyway)
    const rawAmt = moneyMatches[moneyMatches.length - 1][1]
    const amount = parseFloat(rawAmt.replace(/,/g, ''))
    if (!amount || isNaN(amount)) continue

    // Build description: everything except dates, amounts, and standalone integers (points)
    let desc = rest
      .replace(/\$?[\d,]+\.\d{2}/g, ' ')           // remove dollar amounts
      .replace(/(?:^|\s)\d{1,3}(?:,\d{3})*(?=\s|$)/g, ' ')  // remove integer point counts like "1,386" or "33"
      .replace(/\s+/g, ' ')
      .trim()

    if (!desc || desc.length < 2) continue

    let signedAmount: number
    if (section === 'payments') signedAmount = Math.abs(amount)
    else signedAmount = -Math.abs(amount)

    let finalDesc = desc
    if (section === 'fees') finalDesc = `[Fee] ${desc}`
    else if (section === 'interest') finalDesc = `[Interest] ${desc}`

    records.push({
      transaction_date: `${stmtYear}-${month}-${day}`,
      description: finalDesc.slice(0, 200),
      amount: signedAmount,
      account_name: 'Barclays View Mastercard',
    })
  }

  return { records, meta: { rows: records.length, year: stmtYear, fileName: file.name } }
}
