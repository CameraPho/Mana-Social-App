import type { ParseResult } from '@/lib/types'

// Chase consumer credit card statements (Amazon Prime Visa, Sapphire Preferred, etc.)
// Sections: PAYMENTS AND OTHER CREDITS, PURCHASE, INTEREST CHARGED
// Amounts shown on statement: payments as -XX.XX, charges as XX.XX
// We flip: payments become +XX.XX (credit reducing liability), charges become -XX.XX (outflow)

const HEADER_PAYMENTS = /^payments?\s+and\s+other\s+credits/i
const HEADER_PURCHASE = /^purchase$/i
const HEADER_INTEREST = /^interest\s+charged/i
const HEADER_FEES     = /^fees?\s+charged/i

const END_MARKERS = [
  /total\s+interest\s+for\s+this\s+period/i,
  /year-to-date\s+totals/i,
  /interest\s+charges?$/i,
  /chase\s+pay\s+over\s+time/i,
  /plans?\s+set\s+up\s+after\s+purchase/i,
]

type Section = 'payments' | 'purchase' | 'interest' | 'fees' | null

export async function parseAmazonChasePDF(file: File): Promise<ParseResult> {
  return parseChaseConsumerPDF(file, 'Amazon Chase Prime Visa')
}

export async function parseChaseConsumerPDF(file: File, accountName: string): Promise<ParseResult> {
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

  // Chase shows "Opening/Closing Date 04/05/26 - 05/04/26"
  const periodMatch = fullText.match(/opening\/closing\s+date\s+(\d{2})\/(\d{2})\/(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{2})/i)
  const stmtYear = periodMatch ? `20${periodMatch[6]}` : String(new Date().getFullYear())

  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  const records: any[] = []
  let section: Section = null
  let inActivitySection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Only start parsing after we hit ACCOUNT ACTIVITY
    if (/^account\s+activity$/i.test(line)) { inActivitySection = true; continue }
    if (!inActivitySection) continue

    if (END_MARKERS.some(re => re.test(line))) break

    if (HEADER_PAYMENTS.test(line)) { section = 'payments'; continue }
    if (HEADER_PURCHASE.test(line)) { section = 'purchase'; continue }
    if (HEADER_INTEREST.test(line)) { section = 'interest'; continue }
    if (HEADER_FEES.test(line)) { section = 'fees'; continue }

    if (!section) continue

    if (/^order\s+number/i.test(line)) continue
    if (/^total\s+(interest|fees)/i.test(line)) continue

    // Chase consumer date format: MM/DD at start
    const dateMatch = line.match(/^(\d{2})\/(\d{2})\s+(.+)/)
    if (!dateMatch) continue

    const mm = dateMatch[1]
    const dd = dateMatch[2]
    const rest = dateMatch[3]

    // Find all dollar amounts in rest
    const moneyMatches = [...rest.matchAll(/(-?[\d,]+\.\d{2})/g)]
    if (moneyMatches.length === 0) continue

    const rawAmt = moneyMatches[moneyMatches.length - 1][1]
    const isNegOnStmt = rawAmt.startsWith('-')
    const amount = parseFloat(rawAmt.replace(/[,\-]/g, ''))
    if (!amount || isNaN(amount)) continue

    let desc = rest
      .replace(/(-?[\d,]+\.\d{2})/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!desc || desc.length < 2) continue

    // Sign logic:
    //   payments section: statement shows -XX.XX → flip to +XX.XX (credit)
    //   purchase / interest / fees: statement shows +XX.XX → flip to -XX.XX (charge)
    let signedAmount: number
    if (section === 'payments') {
      signedAmount = Math.abs(amount)  // Positive: payment/credit reduces card balance
    } else {
      signedAmount = -Math.abs(amount) // Negative: charge to the card
    }

    let finalDesc = desc
    if (section === 'interest') finalDesc = `[Interest] ${desc}`
    else if (section === 'fees') finalDesc = `[Fee] ${desc}`

    records.push({
      transaction_date: `${stmtYear}-${mm}-${dd}`,
      description: finalDesc.slice(0, 200),
      amount: signedAmount,
      account_name: accountName,
    })
  }

  return { records, meta: { rows: records.length, year: stmtYear, fileName: file.name } }
}
