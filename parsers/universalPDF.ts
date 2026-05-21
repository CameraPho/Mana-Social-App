import type { ParseResult } from '@/lib/types'

// Dynamic runtime CDN locations for heavy file engines (bypasses local bundler compilation)
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
  // PHASE 1: ROUTE & EXTRACT BY FILE FORMAT
  // ==========================================
  
  if (fileNameUpper.endsWith('.XLSX') || fileNameUpper.endsWith('.XLS')) {
    // A. EXCEL BINARY SPREADSHEETS PARSER CHANNEL
    try {
      // Inject standard script block if SheetJS globally missing in window frame
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
      
      // Parse the primary sheet layer and compile into CSV strings line arrays
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const csvDataString = XLSX.utils.sheet_to_csv(worksheet)
      
      textContentLines = csvDataString.split('\n')
    } catch (err) {
      console.error("Excel Worksheet extraction crash caught:", err)
      throw new Error("Unable to read binary Excel spreadsheet entries safely.")
    }

  } else if (fileNameUpper.endsWith('.CSV') || fileNameUpper.endsWith('.TXT')) {
    // B. RAW NATIVE TEXT/CSV STREAM CHANNEL
    const arrayBuf = await file.arrayBuffer()
    const decoder = new TextDecoder('utf-8')
    const rawText = decoder.decode(arrayBuf)
    textContentLines = rawText.split('\n')

  } else {
    // C. BINARY COMPRESSED PDF PARSER CHANNEL (Via Runtime CDN Proxy)
    let fullPdfText = ''
    try {
      const pdfjsLib = await import(/* @vite-ignore */ /* webpackIgnore: true */ PDFJS_CDN_SCRIPT)
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN_WORKER

      const arrayBuf = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise

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
      console.error("PDF Core stream decoding exception:", err)
      throw new Error("Unable to parse file asset structure safely.")
    }
  }

  // Clean lines of formatting quotes, spaces, and training carriage returns (\r)
  const lines = textContentLines
    .map(l => l.replace(/["']/g, '').trim())
    .filter(Boolean)

  // Try to search entire raw file dump array to isolate matching calendar years
  const compiledRawDump = lines.join(' ')
  const yearMatch = compiledRawDump.match(/\b(202[5-9])\b/)
  if (yearMatch) {
    stmtYear = yearMatch[1]
  }

  // ==========================================
  // PHASE 2: UNIVERSAL SMART SCANNING LEDGER
  // ==========================================
  const records: any[] = []
  let chasePaymentSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const upperLine = line.toUpperCase()

    // Contextual boundary fallback flags for traditional card formats like Chase
    if (upperLine.includes("PAYMENTS") && (upperLine.includes("CREDITS") || upperLine.includes("OTHER"))) {
      chasePaymentSection = true
      continue
    }
    if (upperLine.includes("PURCHASE") && !upperLine.includes("SUMMARY") && !upperLine.includes("TOTALS")) {
      chasePaymentSection = false
      continue
    }

    // --- STEP 1: FIND DATE ANCHOR ---
    // Finds any loose MM/DD sequence (works across spreadsheets or broken strings)
    const dateMatch = line.match(/\b(\d{2})\/(\d{2})\b/)
    if (!dateMatch || dateMatch.index === undefined) continue
    const [fullDateStr, mm, dd] = dateMatch
    
    // --- STEP 2: FIND CURRENCY AMOUNT ---
    // Grabs the trailing numerical value at the end of the data array or CSV row cell
    const amountMatch = line.match(/([-+]?\s*[\d,]+\.\d{2})\s*[-+=]?$/)
    if (!amountMatch) continue
    const rawAmtStr = amountMatch[1]
    const cleanAmtStr = rawAmtStr.replace(/[\s,]/g, '')
    let amount = parseFloat(cleanAmtStr)
    if (isNaN(amount)) continue

    // --- STEP 3: ISOLATE MERCHANT DESCRIPTION ---
    // Traps everything left over in between the date anchor and trailing price tag
    const dateEndIndex = line.indexOf(fullDateStr) + fullDateStr.length
    const amtStartIndex = line.lastIndexOf(rawAmtStr)
    if (amtStartIndex <= dateEndIndex) continue
    
    let description = line.substring(dateEndIndex, amtStartIndex).trim()

    // --- STEP 4: STRIP SPREADSHEET MATRIX NOISE ---
    // Clears formatting commas or extra numbers from rows (e.g., Barclays points, tracking keys)
    if (description.startsWith(',')) description = description.substring(1)
    if (description.endsWith(',')) description = description.slice(0, -1)
    description = description.replace(/^\s*\d{2}\/\d{2}\s+/, '') // Removes redundant duplicate posting dates
    description = description.replace(/\s+\d+\s*$/, '')       // Removes isolated reward token metrics
    description = description.trim()

    if (!description || description.length < 2) continue

    // --- STEP 5: FILTER SYSTEM ACCOUNTS SUMMARY HEADERS ---
    if (/PREVIOUS BALANCE|NEW BALANCE|MINIMUM PAYMENT|TOTAL PURCHASES|CREDIT LINE|INVESTMENT/i.test(description)) {
      continue
    }

    // --- STEP 6: INTELLIGENT MATHEMATICAL SIGN BALANCING ---
    const descUpper = description.toUpperCase()
    const isPaymentKeyword = /PAYMENT|THANK YOU|CREDIT|^CR\s|AUTOPAY/i.test(descUpper)
    const isNegativeSign = rawAmtStr.includes('-') || cleanAmtStr.includes('-')

    if (chasePaymentSection || isPaymentKeyword || isNegativeSign) {
      // Credits or balance reduction transactions are outputted as a negative math balance flow
      amount = -Math.abs(amount)
    } else {
      // Direct charges, card purchases, interest rates, or penalties output as standard positive balance rows
      amount = Math.abs(amount)
      
      if (descUpper.includes("INTEREST") || descUpper.includes("FINANCE CHG")) {
        description = `[Interest] ${description}`
      } else if (descUpper.includes("FEE") || descUpper.includes("LATE CHG")) {
        description = `[Fee] ${description}`
      }
    }

    records.push({
      transaction_date: `${stmtYear}-${mm}-${dd}`,
      description: description.slice(0, 200),
      amount: amount,
      account_name: accountName,
    })
  }

  // Deduplicate overlapping entries across page splits or identical sheet bounds
  const uniqueRecords = records.filter((v, i, a) => 
    a.findIndex(t => t.transaction_date === v.transaction_date && t.description === v.description && t.amount === v.amount) === i
  )

  return {
    records: uniqueRecords,
    meta: {
      rows: uniqueRecords.length,
      year: stmtYear,
      fileName: file.name,
    }
  }
}