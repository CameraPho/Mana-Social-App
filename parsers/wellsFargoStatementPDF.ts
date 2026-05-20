import type { ParseResult } from '@/lib/types'

// Wells Fargo: deposits and withdrawals are in SEPARATE columns,
// but the PDF text just shows numbers in order. We use description
// keywords to determine sign, same approach as Chase parser.
const DEBIT_HINTS = [
  'online transfer to', 'jpmorgan chase acctverify', 'business to business ach debit',
  'paypal inst xfer', 'tcgplayer inc acctverify', 'withdrawal', 'service charge',
  'monthly fee', 'overdraft', 'wire transfer to',
]
const CREDIT_HINTS = [
  'online transfer from', 'opening deposit', 'instant pmt from', 'instant payment',
  'mobile deposit', 'ach credit', 'wire transfer from', 'interest payment',
  'deposit', 'transfer from',
]

function classifyAmount(desc: string, amount: number): number {
  const d = desc.toLowerCase()
  if (DEBIT_HINTS.some(h => d.includes(h))) return -Math.abs(amount)
  if (CREDIT_HINTS.some(h => d.includes(h))) return Math.abs(amount)
  // Unknown — leave positive, user can flip in Reconcile.
  return Math.abs(amount)
}

export async function parseWellsFargoStatementPDF(file: File): Promise<ParseResult> {
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

  // Year extraction — WF header has "April 30, 2026" style
  const yearMatch = fullText.match(/\b(20\d{2})\b/)
  const stmtYear = yearMatch ? yearMatch[1] : String(new Date().getFullYear())

  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  // WF transaction rows start with M/D (no leading zero, e.g. "4/24" or "12/3")
  const dateStart = /^(\d{1,2})\/(\d{1,2})\s+(.*)$/
  const moneyRe = /[\d,]+\.\d{2}/g

  const records: any[] = []

  // Find the start of the transaction section to avoid parsing summary numbers
  const txnSectionStart = lines.findIndex(l => /transaction history/i.test(l))
  const txnSectionEnd = lines.findIndex((l, idx) => idx > txnSectionStart && /^totals\b/i.test(l))
  const startIdx = txnSectionStart >= 0 ? txnSectionStart + 1 : 0
  const endIdx = txnSectionEnd > 0 ? txnSectionEnd : lines.length

  for (let i = startIdx; i < endIdx; i++) {
    const m = lines[i].match(dateStart)
    if (!m) continue
    const [, mm, dd] = m
    let rest = m[3]

    // If line lacks a money value, pull in next line(s) (wrapped description)
    let lookahead = 0
    while (!moneyRe.test(rest) && lookahead < 3 && (i + lookahead + 1) < endIdx) {
      moneyRe.lastIndex = 0
      lookahead++
      if (dateStart.test(lines[i + lookahead])) break
      rest += ' ' + lines[i + lookahead]
    }
    moneyRe.lastIndex = 0

    const nums = rest.match(moneyRe)
    if (!nums || nums.length === 0) continue

    // WF row structure: [description] [deposit?] [withdrawal?] [ending balance?]
    // Strategy: first money number is the transaction amount.
    // If there are 2+ numbers, the LAST is typically ending balance.
    // For lines with both deposit AND ending balance (or withdrawal AND balance),
    // first number is still the transaction.
    const rawAmt = nums[0]
    const amount = parseFloat(rawAmt.replace(/,/g, ''))
    if (!amount || isNaN(amount)) continue

    // Description = everything before the first money number
    const cutAt = rest.indexOf(rawAmt)
    let desc = (cutAt > 0 ? rest.slice(0, cutAt) : rest).replace(/\s+/g, ' ').trim()
    if (!desc) desc = 'Wells Fargo transaction'

    // Skip summary/header rows that snuck through
    if (/^(beginning|ending|totals)\s+balance/i.test(desc)) continue
    if (/^totals/i.test(desc)) continue

    const mmPadded = mm.padStart(2, '0')
    const ddPadded = dd.padStart(2, '0')

    records.push({
      transaction_date: `${stmtYear}-${mmPadded}-${ddPadded}`,
      description: desc.slice(0, 200),
      amount: classifyAmount(desc, amount),
      account_name: 'Wells Fargo Business Checking',
    })

    i += lookahead
  }

  return { records, meta: { rows: records.length, year: stmtYear, fileName: file.name } }
}
