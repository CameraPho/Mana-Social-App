import type { ParseResult } from '@/lib/types'

// Amazon Chase Prime Visa wrapper
export async function parseAmazonChasePDF(file: File): Promise<ParseResult> {
  return parseChaseConsumerPDF(file, 'Amazon Chase Prime Visa')
}

// Generic Chase consumer parser
export async function parseChaseConsumerPDF(
  file: File,
  accountName: string
): Promise<ParseResult> {

  // FIXED: proper ESM import — no "as any", no global pollution
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs'

  const arrayBuf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise

  let fullText = ''

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    let lastY: number | null = null

    for (const item of content.items as any[]) {
      const y = item.transform[5]

      if (lastY !== null && Math.abs(y - lastY) > 2) {
        fullText += '\n'
      } else if (fullText.length && !fullText.endsWith('\n')) {
        fullText += ' '
      }

      fullText += item.str
      lastY = y
    }

    fullText += '\n'
  }

  // Extract statement year
  const periodMatch = fullText.match(
    /opening\/closing\s+date\s+(\d{2})\/(\d{2})\/(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{2})/i
  )
  const stmtYear = periodMatch
    ? `20${periodMatch[6]}`
    : String(new Date().getFullYear())

  const lines = fullText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const records: any[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip obvious headers/footers
    if (
      /^(sale|post|date|merchant|description|amount|payments|purchase|interest|fees|order\s+number|total|year-to-date)/i
        .test(line)
    ) continue

    // Match transaction lines: MM/DD DESCRIPTION ... AMOUNT
    const match = line.match(/^(\d{2})\/(\d{2})\s+(.+)/)
    if (!match) continue

    const [, mm, dd, rest] = match

    // Extract all currency values
    const moneyMatches = [...rest.matchAll(/([\d,]+\.\d{2})/g)]
    if (moneyMatches.length === 0) continue

    // Last amount = transaction amount
    const rawAmt = moneyMatches[moneyMatches.length - 1][1]
    const amount = parseFloat(rawAmt.replace(/,/g, ''))
    if (!amount || isNaN(amount)) continue

    // Remove amounts from description
    let desc = rest
      .replace(/([\d,]+\.\d{2})/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!desc || desc.length < 2) continue

    // Determine sign
    let signedAmount: number

    if (/payment|thank\s+you|credit/i.test(desc)) {
      signedAmount = Math.abs(amount) // Payment (credit)
    } else if (/interest|fee/i.test(desc)) {
      signedAmount = -Math.abs(amount)
      if (/interest/i.test(desc)) desc = `[Interest] ${desc}`
      if (/fee/i.test(desc)) desc = `[Fee] ${desc}`
    } else {
      signedAmount = -Math.abs(amount) // Purchase (default)
    }

    records.push({
      transaction_date: `${stmtYear}-${mm}-${dd}`,
      description: desc.slice(0, 200),
      amount: signedAmount,
      account_name: accountName,
    })
  }

  return {
    records,
    meta: {
      rows: records.length,
      year: stmtYear,
      fileName: file.name,
    }
  }
}
