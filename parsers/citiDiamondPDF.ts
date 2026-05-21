import type { ParseResult } from '@/lib/types'

// Citi Diamond Preferred uses the same general layout as Costco Citi:
//   "Payments, Credits and Adjustments"
//   "Promo Purchase-Offer X" / "Standard Purchases"
//   "Fees Charged" / "Interest Charged"

const HEADER_PAYMENTS  = /payments,?\s+credits\s+and\s+adjustments/i
const HEADER_CASH_ADV  = /^cash\s+advances$/i
const HEADER_PROMO     = /promo\s+purchase|promotional\s+purchase/i
const HEADER_STANDARD  = /^standard\s+purch/i
const HEADER_PURCHASES = /^purchases?$/i
const HEADER_FEES      = /^fees?\s+charged$/i
const HEADER_INTEREST  = /^interest\s+charged$/i

const END_MARKERS = [/interest\s+charge\s+calculation/i]

type Section = 'payments' | 'cash_advance' | 'purchase' | 'fees' | 'interest' | null

export async function parseCitiDiamondPDF(file: File): Promise<ParseResult> {
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

  const periodMatch = fullText.match(/billing\s+period:?\s*(\d{2})\/(\d{2})\/(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{2})/i)
  const stmtYear = periodMatch ? `20${periodMatch[6]}` : String(new Date().getFullYear())

  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  const records: any[] = []
  let section: Section = null
  let promoLabel: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (END_MARKERS.some(re => re.test(line))) break

    if (HEADER_PAYMENTS.test(line)) { section = 'payments'; continue }
    if (HEADER_CASH_ADV.test(line)) { section = 'cash_advance'; continue }
    if (HEADER_PROMO.test(line)) {
      section = 'purchase'
      const promoMatch = line.match(/(promo\s+purchase[\s\S]*?)$/i)
      promoLabel = promoMatch ? promoMatch[1].trim() : null
      continue
    }
    if (HEADER_STANDARD.test(line) || HEADER_PURCHASES.test(line)) { section = 'purchase'; promoLabel = null; continue }
    if (HEADER_FEES.test(line)) { section = 'fees'; continue }
    if (HEADER_INTEREST.test(line)) { section = 'interest'; continue }

    if (!section) continue

    if (/^total\s+(fees|interest|payments|purchases)/i.test(line)) continue
    if (/^new\s+balance|^previous\s+balance|^minimum\s+payment/i.test(line)) continue

    const dateMatches = [...line.matchAll(/(\d{2})\/(\d{2})/g)]
    if (dateMatches.length === 0) continue

    const moneyMatches = [...line.matchAll(/(-?\$?[\d,]+\.\d{2})/g)]
    if (moneyMatches.length === 0) continue

    const rawAmt = moneyMatches[moneyMatches.length - 1][1]
    const amount = parseFloat(rawAmt.replace(/[$,\-]/g, ''))
    if (!amount || isNaN(amount)) continue

    const mm = dateMatches[0][1]
    const dd = dateMatches[0][2]

    let desc = line
      .replace(/(\d{2})\/(\d{2})/g, ' ')
      .replace(/-?\$?[\d,]+\.\d{2}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!desc || desc.length < 2) continue
    if (/^(sale|post|date|description|amount|trans\.?)$/i.test(desc)) continue

    let signedAmount: number
    if (section === 'payments') signedAmount = Math.abs(amount)
    else signedAmount = -Math.abs(amount)

    let finalDesc = desc
    if (section === 'cash_advance') finalDesc = `[Cash Advance] ${desc}`
    else if (section === 'fees') finalDesc = `[Fee] ${desc}`
    else if (section === 'interest') finalDesc = `[Interest] ${desc}`
    else if (section === 'purchase' && promoLabel) finalDesc = `${desc} (${promoLabel})`

    records.push({
      transaction_date: `${stmtYear}-${mm}-${dd}`,
      description: finalDesc.slice(0, 200),
      amount: signedAmount,
      account_name: 'Citi Diamond Preferred',
    })
  }

  return { records, meta: { rows: records.length, year: stmtYear, fileName: file.name } }
}
