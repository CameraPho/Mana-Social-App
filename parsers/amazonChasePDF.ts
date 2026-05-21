import type { ParseResult } from '@/lib/types'

const HEADER_PAYMENTS = /payments?\s+and\s+other\s+credits/i
const HEADER_PURCHASE = /^purchase$/i
const HEADER_INTEREST = /^interest\s+charged/i
const HEADER_FEES     = /^fees?\s+charged/i

const END_MARKERS = [
  /total\s+interest\s+for\s+this\s+period/i,
  /year-to-date\s+totals/i,
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

  const periodMatch = fullText.match(/opening\/closing\s+date\s+(\d{2})\/(\d{2})\/(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{2})/i)
  const stmtYear = periodMatch ? `20${periodMatch[6]}` : String(new Date().getFullYear())

  // TEMPORARY DEBUG — remove after parser confirmed working
  console.log('=== Chase Consumer Parser Debug ===')
  console.log('Account:', accountName)
  console.log('Year:', stmtYear)
  console.log('Lines count:', fullText.split('\n').length)
  console.log('First 80 lines:')
  fullText.split('\n').slice(0, 80).forEach((l, i) => console.log(`  ${i}: "${l.trim()}"`))
  console.log('=== End Debug ===')

  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  const records: any[] = []
  let section: Section = null
  let inActivitySection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Looser activity detection — match anywhere in line
    if (/account\s+activity/i.test(line) && !inActivitySection) {
      inActivitySection = true
      continue
    }
    if (!inActivitySection) continue

    if (END_MARKERS.some(re => re.test(line))) break

    if (HEADER_PAYMENTS.test(line)) { section = 'payments'; continue }
    if (HEADER_PURCHASE.test(line)) { section = 'purchase'; continue }
    if (HEADER_INTEREST.test(line)) { section = 'interest'; continue }
    if (HEADER_FEES.test(line)) { section = 'fees'; continue }

    if (!section) continue

    if (/^order\s+number/i.test(line)) continue
    if (/^total\s+(interest|fees)/i.test(line)) continue
    if (/^date\s+of/i.test(line)) continue
    if (/^merchant\s+name/i.test(line)) continue

    // Looser date match: find MM/DD anywhere at start (allow leading spaces)
    const dateMatch = line.match(/(?:^|\s)(\d{2})\/(\d{2})\s+(.+)/)
    if (!dateMatch) continue

    const mm = dateMatch[1]
    const dd = dateMatch[2]
    const rest = dateMatch[3]

    const moneyMatches = [...rest.matchAll(/(-?[\d,]+\.\d{2})/g)]
    if (moneyMatches.length === 0) continue

    const rawAmt = moneyMatches[moneyMatches.length - 1][1]
    const amount = parseFloat(rawAmt.replace(/[,\-]/g, ''))
    if (!amount || isNaN(amount)) continue

    let desc = rest
      .replace(/(-?[\d,]+\.\d{2})/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!desc || desc.length < 2) continue

    let signedAmount: number
    if (section === 'payments') signedAmount = Math.abs(amount)
    else signedAmount = -Math.abs(amount)

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
