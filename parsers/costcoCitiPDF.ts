import type { ParseResult } from '@/lib/types'

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

  const periodMatch = fullText.match(/billing\s+period:\s+(\d{2})\/(\d{2})\/(\d{2})-(\d{2})\/(\d{2})\/(\d{2})/i)
  const stmtYear = periodMatch ? `20${periodMatch[6]}` : String(new Date().getFullYear())

  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)
  const records: any[] = []

  const sectionHeaders = [
    { pattern: /^payments.*credits.*adjustments/i, section: 'payments' },
    { pattern: /^cash\s+advances?$/i, section: 'cash_advance' },
    { pattern: /^promo\s+purchase/i, section: 'purchase' },
    { pattern: /^fees?\s+charged/i, section: 'fees' },
    { pattern: /^interest\s+charged/i, section: 'interest' },
  ]

  let currentSection: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check for section headers
    const matchedSection = sectionHeaders.find(h => h.pattern.test(line))
    if (matchedSection) {
      currentSection = matchedSection.section
      continue
    }

    // End sections at certain markers
    if (/^fees\s+charged/i.test(line) || /^interest\s+charged/i.test(line) || /^2026\s+totals/i.test(line)) {
      if (currentSection === 'purchase') currentSection = null
    }

    if (!currentSection) continue

    // Skip noise lines
    if (/^(sale|post|date|description|amount|account\s+summary|cardholder|total\s+(fees|interest)|new\s+charges)/i.test(line)) continue

    // Match transaction lines: MM/DD MM/DD DESCRIPTION AMOUNT
    const match = line.match(/^(\d{2})\/(\d{2})\s+(\d{2})\/(\d{2})\s+(.+?)\s+([\d,]+\.\d{2})$/)
    if (!match) continue

    const [, saleMonth, saleDay, postMonth, postDay, rawDesc, rawAmount] = match
    const amount = parseFloat(rawAmount.replace(/,/g, ''))
    if (!amount || isNaN(amount)) continue

    let desc = rawDesc.trim()
    let signedAmount: number

    // Apply section-based logic
    if (currentSection === 'payments') {
      signedAmount = Math.abs(amount) // Payments are credits (positive)
    } else if (currentSection === 'cash_advance') {
      signedAmount = -Math.abs(amount)
      desc = `[Cash Advance] ${desc}`
    } else if (currentSection === 'purchase') {
      signedAmount = -Math.abs(amount)
      // Regular purchases — no prefix
    } else if (currentSection === 'fees') {
      signedAmount = -Math.abs(amount)
      desc = `[Fee] ${desc}`
    } else if (currentSection === 'interest') {
      signedAmount = -Math.abs(amount)
      desc = `[Interest] ${desc}`
    } else {
      continue
    }

    records.push({
      transaction_date: `${stmtYear}-${saleMonth}-${saleDay}`,
      description: desc.slice(0, 200),
      amount: signedAmount,
      account_name: 'Costco Citi Visa',
    })
  }

  return { records, meta: { rows: records.length, year: stmtYear, fileName: file.name } }
}
