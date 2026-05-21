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
  let section: Section = null
  let inActivitySection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect start of activity section
    if (/account\s+activity/i.test
