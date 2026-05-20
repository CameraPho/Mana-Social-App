import type { ParseResult } from '@/lib/types'

// Words/phrases that indicate a row is money LEAVING the account.
const DEBIT_HINTS = [
  'payment to', 'online realtime transfer to', 'card online payment',
  'epmt', 'eftpmt', 'eftps', 'cdtfa', 'franchise tax', 'gsbank',
  'withdrawal', 'fee', 'acctverify td',
  'sortswift', 'tcg automate', 'usps', 'stamps.com', 'shopify',
  'google', 'adobe', 'verizon', 'amazon web services', 'aws',
  'vercel', 'supabase', 'bcw', 'ultra pro', 'web id:',
]
// Words/phrases that indicate money ENTERING the account.
const CREDIT_HINTS = [
  'transfer recd', 'real time transfer recd', 'from preferred',
  'tcgplayer inc', 'ebay com', 'mana pool payout', 'payroll',
  'cash redemption', 'cash back', 'deposit', 'real time payment credit',
  'redemption',
]

function classifyAmount(desc: string, rawAmt: string, amount: number): number {
  // Explicit minus sign always wins.
  if (rawAmt.trim().startsWith('-')) return -Math.abs(amount)
  const d = desc.toLowerCase()
  if (DEBIT_HINTS.some(h => d.includes(h))) return -Math.abs(amount)
  if (CREDIT_HINTS.some(h => d.includes(h))) return Math.abs(amount)
  // Unknown — leave positive, user can flip it in the Reconcile tab.
  return Math.abs(amount)
}

export async function parseChaseStatementPDF(file: File): Promise<ParseResult> {
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

  const yearMatch = fullText.match(/through\s+\w+\s+\d{1,2},\s+(\d{4})/)
  const stmtYear = yearMatch ? yearMatch[1] : String(new Date().getFullYear())

  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  // A line that STARTS a transaction row: begins with MM/DD.
  const dateStart = /^(\d{2})\/(\d{2})\s+(.*)$/
  // Any currency-shaped number, e.g. 1,234.56 or -99.95
  const moneyRe = /-?[\d,]+\.\d{2}/g

  const records: any[] = []

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(dateStart)
    if (!m) continue
    const [, mm, dd] = m
    let rest = m[3]

    // If this row has no money value yet, it's a wrapped row —
    // pull in following lines until we find currency numbers.
    let lookahead = 0
    while (!moneyRe.test(rest) && lookahead < 3 && (i + lookahead + 1) < lines.length) {
      moneyRe.lastIndex = 0
      lookahead++
      // stop if the next line starts a new transaction
      if (dateStart.test(lines[i + lookahead])) break
      rest += ' ' + lines[i + lookahead]
    }
    moneyRe.lastIndex = 0

    const nums = rest.match(moneyRe)
    if (!nums || nums.length === 0) continue

    // First currency number = transaction amount.
    // (If two numbers, the second is the running balance — ignore it.)
    const rawAmt = nums[0]
    const amount = parseFloat(rawAmt.replace(/,/g, ''))
    if (!amount || isNaN(amount)) continue

    // Description = everything before the first money number.
    const cutAt = rest.indexOf(rawAmt)
    let desc = (cutAt > 0 ? rest.slice(0, cutAt) : rest).replace(/\s+/g, ' ').trim()
    if (!desc) desc = 'Chase transaction'
    if (/^(beginning|ending)\s+balance/i.test(desc)) continue

    records.push({
      transaction_date: `${stmtYear}-${mm}-${dd}`,
      description: desc.slice(0, 200),
      amount: classifyAmount(desc, rawAmt, amount),
      account_name: 'Chase Business Checking',
    })

    i += lookahead // skip lines we already consumed
  }

  return { records, meta: { rows: records.length, year: stmtYear, fileName: file.name } }
}
