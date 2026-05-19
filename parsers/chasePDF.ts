import type { ParseResult } from '@/lib/types'

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
  const records: any[] = []
  const lines = fullText.split('\n')
  const rowRegex = /^(\d{2})\/(\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/
  for (const line of lines) {
    const m = line.trim().match(rowRegex)
    if (!m) continue
    const [, mm, dd, descRaw, amtRaw] = m
    const desc = descRaw.replace(/\s+/g, ' ').trim()
    if (/Beginning Balance|Ending Balance/i.test(desc)) continue
    const amount = parseFloat(amtRaw.replace(/,/g, ''))
    records.push({ transaction_date: `${stmtYear}-${mm}-${dd}`, description: desc.slice(0, 200), amount, account_name: 'Chase Business Checking' })
  }
  return { records, meta: { rows: records.length, year: stmtYear, fileName: file.name } }
}
