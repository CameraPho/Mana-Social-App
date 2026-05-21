import type { ParseResult } from '@/lib/types'

const PDFJS_CDN_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs'
const PDFJS_CDN_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs'
const XLSX_CDN_SCRIPT  = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'

export async function parsePDF(
  file: File,
  accountName: string
): Promise<ParseResult> {
  let textContentLines: string[] = []
  const fileNameUpper = file.name.toUpperCase()
  let stmtYear = String(new Date().getFullYear())

  // ==========================================
  // PHASE 1: FILE EXTRACTION ENGINE ROUTING
  // ==========================================
  if (fileNameUpper.endsWith('.XLSX') || fileNameUpper.endsWith('.XLS')) {
    try {
      if (!(window as any).XLSX) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = XLSX_CDN_SCRIPT
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
      }
      const XLSX = (window as any).XLSX
      const arrayBuf = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuf, { type: 'array' })
      const csvDataString = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]])
      textContentLines = csvDataString.split('\n')
    } catch (err) {
      throw new Error("Unable to read binary Excel spreadsheet entries safely.")
    }
  } else if (fileNameUpper.endsWith('.CSV') || fileNameUpper.endsWith('.TXT')) {
    const arrayBuf = await file.arrayBuffer()
    textContentLines = new TextDecoder('utf-8').decode(arrayBuf).split('\n')
  } else {
    try {
      const pdfjsLib = await import(/* @vite-ignore */ /* webpackIgnore: true */ PDFJS_CDN_SCRIPT)
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN_WORKER
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
      let fullPdfText = ''

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const content = await page.getTextContent()
        let lastY: number | null = null
        let pageText = ''

        for (const item of content.items as any[]) {
          const y = item.transform[5]
          if (lastY !== null && Math.abs(y - lastY) > 5) {
            pageText += '\n'
          } else if (pageText.length && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
            pageText += ' '
          }
          pageText += item.str
          lastY = y
        }
        fullPdfText += pageText + '\n'
      }
      textContentLines = fullPdfText.split('\n')
    } catch (err) {
      throw new Error("Unable to parse file asset structure safely.")
    }
  }

  const lines = textContentLines.map(l => l.trim()).filter(Boolean)
  const yearMatch = lines.join(' ').match(/\b(202[5-9])\b/)
  if (yearMatch) stmtYear = yearMatch[1]

  // ==========================================
  // PHASE 2: UNIVERSAL SMART SCANNING LEDGER
  // ==========================================
  const records: any[] = []
  let chasePaymentSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const upperLine = line.toUpperCase()

    if (upperLine.includes("PAYMENTS") && (upperLine.includes("CREDITS") || upperLine.includes("OTHER"))) {
      chasePaymentSection = true
      continue
    }
    if (upperLine.includes("PURCHASE") && !upperLine.includes("SUMMARY") && !upperLine.includes("TOTALS")) {
      chasePaymentSection = false
      continue
    }

    // --- STEP 1: MATCH DATE ---
    const dateMatch = line.match(/\b(\d{2})\/(\d{2})\b/)
    if (!dateMatch || dateMatch.index === undefined) continue
    const [fullDateStr, mm, dd] = dateMatch
    
    // --- STEP 2: MATCH AMOUNT ---
    const amountMatch = line.match(/([-+]?\s*[\d,]+\.\d{2})\s*[-+=]?$/)
    if (!amountMatch) continue
    const rawAmtStr = amountMatch[1]
    let amount = parseFloat(rawAmtStr.replace(/[\s,]/g, ''))
    if (isNaN(amount)) continue

    // --- STEP 3: EXTRACT INITIAL STRING GAP ---
    const dateEndIndex = line.indexOf(fullDateStr) + fullDateStr.length
    const amtStartIndex = line.lastIndexOf(rawAmtStr)
    if (amtStartIndex <= dateEndIndex) continue
    
    let description = line.substring(dateEndIndex, amtStartIndex).trim()

    // --- STEP 4: HARD CLEANUP OF EXTRANEOUS DATA ---
    // Remove formatting commas, structural quotes, or raw text injection boundaries
    description = description.replace(/^[\s,;"']+|[\s,;"']+$/g, '').trim()

    // Clean up secondary duplicate posting dates (e.g. ", 04/06 ,") at the start
    description = description.replace(/^\d{2}\/\d{2}\b[\s,;"']*/, '')

    // Clean up trailing reward points or internal tracking numbers (e.g. ", 100 ,") at the end
    description = description.replace(/[\s,;"']*\b\d+\b\s*$/, '')

    // Do a second quick sweep to remove any remaining edge commas or syntax leaks
    description = description.replace(/^[\s,;"']+|[\s,;"']+$/g, '').trim()

    if (!description || description.length < 2 || /PREVIOUS BALANCE|NEW BALANCE|MINIMUM PAYMENT|TOTAL PURCHASES/i.test(description)) {
      continue
    }

    // --- STEP 5: MATHEMATICAL SIGN BALANCING ---
    const descUpper = description.toUpperCase()
    const isPaymentKeyword = /PAYMENT|THANK YOU|CREDIT|^CR\s|AUTOPAY/i.test(descUpper)
    const isNegativeSign = rawAmtStr.includes('-')

    if (chasePaymentSection || isPaymentKeyword || isNegativeSign) {
      amount = -Math.abs(amount)
    } else {
      amount = Math.abs(amount)
      if (descUpper.includes("INTEREST")) description = `[Interest] ${description}`
      else if (descUpper.includes("FEE")) description = `[Fee] ${description}`
    }

    records.push({
      transaction_date: `${stmtYear}-${mm}-${dd}`,
      description: description.slice(0, 200),
      amount: amount,
      account_name: accountName,
    })
  }

  const uniqueRecords = records.filter((v, i, a) => 
    a.findIndex(t => t.transaction_date === v.transaction_date && t.description === v.description && t.amount === v.amount) === i
  )

  return {
    records: uniqueRecords,
    meta: { rows: uniqueRecords.length, year: stmtYear, fileName: file.name }
  }
}