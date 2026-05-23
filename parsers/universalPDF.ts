import type { ParseResult } from '@/lib/types'

const PDFJS_CDN_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs'
const PDFJS_CDN_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs'
const XLSX_CDN_SCRIPT  = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'

const CREDIT_CARD_NAMES = [
  'Costco Citi Visa', 'Citi Diamond Preferred',
  'Amazon Chase Prime Visa', 'Chase Sapphire Preferred',
  'Barclays View Mastercard',
]

function detectBankFromText(text: string): { accountName: string; isCreditCard: boolean } {
  const t = text.toLowerCase()
  if (/wells\s*fargo/.test(t)) return { accountName: 'Wells Fargo', isCreditCard: false }
  if (/barclays/.test(t)) return { accountName: 'Barclays View Mastercard', isCreditCard: true }
  if (/costco\s*anywhere\s*visa|costco.*citi/.test(t)) return { accountName: 'Costco Citi Visa', isCreditCard: true }
  if (/diamond\s*preferred/.test(t)) return { accountName: 'Citi Diamond Preferred', isCreditCard: true }
  if (/amazon.*chase|chase.*amazon|prime\s*visa/.test(t)) return { accountName: 'Amazon Chase Prime Visa', isCreditCard: true }
  if (/sapphire/.test(t)) return { accountName: 'Chase Sapphire Preferred', isCreditCard: true }
  if (/chase/.test(t)) return { accountName: 'Chase Business Checking', isCreditCard: false }
  return { accountName: 'Unknown', isCreditCard: false }
}

function extractBalances(text: string, isCreditCard: boolean): {
  startingBalance: number | null
  endingBalance: number | null
} {
  let startingBalance: number | null = null
  let endingBalance: number | null = null

  if (isCreditCard) {
    const prevMatch = text.match(/previous\s+balance[\s\$]*([\d,]+\.\d{2})/i)
    const newMatch = text.match(/new\s+balance[\s\$\sasof]*([\d,]+\.\d{2})/i)
    if (prevMatch) startingBalance = parseFloat(prevMatch[1].replace(/,/g, ''))
    if (newMatch) endingBalance = parseFloat(newMatch[1].replace(/,/g, ''))
  } else {
    const beginMatch = text.match(/(?:beginning|opening)\s+balance[\s\$]*([\d,]+\.\d{2})/i)
    const endMatch = text.match(/ending\s+balance[\s\$]*([\d,]+\.\d{2})/i)
    if (beginMatch) startingBalance = parseFloat(beginMatch[1].replace(/,/g, ''))
    if (endMatch) endingBalance = parseFloat(endMatch[1].replace(/,/g, ''))
  }

  return { startingBalance, endingBalance }
}

function extractPeriod(text: string): { periodStart: string | null; periodEnd: string | null } {
  // Pattern 1: MM/DD/YY-MM/DD/YY (Citi)
  const m1 = text.match(/(\d{2})\/(\d{2})\/(\d{2})\s*[-–]\s*(\d{2})\/(\d{2})\/(\d{2})/)
  if (m1) {
    return {
      periodStart: `20${m1[3]}-${m1[1]}-${m1[2]}`,
      periodEnd: `20${m1[6]}-${m1[4]}-${m1[5]}`,
    }
  }
  // Pattern 2: MM/DD/YYYY to MM/DD/YYYY (Chase, WF)
  const m2 = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(?:to|through|-|–)\s*(\d{2})\/(\d{2})\/(\d{4})/i)
  if (m2) {
    return {
      periodStart: `${m2[3]}-${m2[1]}-${m2[2]}`,
      periodEnd: `${m2[6]}-${m2[4]}-${m2[5]}`,
    }
  }
  return { periodStart: null, periodEnd: null }
}

const NOISE_PATTERNS = [
  /PREVIOUS BALANCE|NEW BALANCE|MINIMUM PAYMENT|TOTAL PURCHASES/i,
  /ACCOUNT SUMMARY|CARDHOLDER SUMMARY|CREDIT LIMIT/i,
  /BILLING PERIOD|PAYMENT DUE|LATE PAYMENT/i,
  /AVAILABLE CREDIT|CASH ADVANCE LIMIT/i,
  /REWARDS SUMMARY|CASH BACK|EARNED THIS PERIOD/i,
  /TOTAL FEES FOR THIS PERIOD|TOTAL INTEREST FOR THIS PERIOD/i,
  /YEAR-TO-DATE|TOTALS YEAR/i,
  /OPENING.*CLOSING\s*DATE/i,
  /STATEMENT\s*PERIOD/i,
  /BEGINNING\s+BALANCE|ENDING\s+BALANCE/i,
  /^PURCHASES\s*[\+\-]?\s*\$/i,
  /^PAYMENTS\s*[\+\-]?\s*\$/i,
  /^CREDITS\s*[\+\-]?\s*\$/i,
  /^FEES\s*[\+\-]?\s*\$/i,
  /^INTEREST\s*[\+\-]?\s*\$/i,
]

export async function parsePDF(
  file: File,
  accountName: string
): Promise<ParseResult> {
  let textContentLines: string[] = []
  const fileNameUpper = file.name.toUpperCase()
  let stmtYear = String(new Date().getFullYear())

  // PHASE 1: FILE EXTRACTION
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
      throw new Error("Unable to read Excel file.")
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
      throw new Error("Unable to parse PDF file.")
    }
  }

  const lines = textContentLines.map(l => l.trim()).filter(Boolean)

  // PHASE 1.5: DETECT BANK FROM EXTRACTED TEXT
  const headerText = lines.slice(0, 120).join(' ')
  const detected = detectBankFromText(headerText)
  const finalAccountName = detected.accountName !== 'Unknown' ? detected.accountName : accountName
  const isCreditCard = detected.isCreditCard || CREDIT_CARD_NAMES.includes(accountName)

  // Extract balances + period
  const balances = extractBalances(headerText, isCreditCard)
  const period = extractPeriod(headerText)

  // Extract year
  const yearMatch = headerText.match(/\b(202[4-9])\b/)
  if (yearMatch) stmtYear = yearMatch[1]
  const billingMatch = headerText.match(/(\d{2})\/(\d{2})\/(\d{2})\s*[-–]\s*(\d{2})\/(\d{2})\/(\d{2})/)
  if (billingMatch) stmtYear = `20${billingMatch[6]}`

  // PHASE 2: TRANSACTION SCANNING
  const records: any[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (NOISE_PATTERNS.some(p => p.test(line))) continue

    const dateMatch = line.match(/\b(\d{2})\/(\d{2})\b/)
    if (!dateMatch || dateMatch.index === undefined) continue
    const [fullDateStr, mm, dd] = dateMatch

    const monthNum = parseInt(mm)
    const dayNum = parseInt(dd)
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) continue

    const amountMatch = line.match(/([-+]?\s*\$?\s*[\d,]+\.\d{2})\s*$/)
    if (!amountMatch) continue
    const rawAmtStr = amountMatch[1]

    let amount = parseFloat(rawAmtStr.replace(/[^0-9.\-]/g, ''))
    if (isNaN(amount) || amount === 0) continue

    if (rawAmtStr.trim().startsWith('-') && amount > 0) amount = -amount

    const dateEndIndex = (dateMatch.index || 0) + fullDateStr.length
    const amtStartIndex = line.lastIndexOf(rawAmtStr.trim())
    if (amtStartIndex <= dateEndIndex) continue

    let description = line.substring(dateEndIndex, amtStartIndex).trim()
    description = description.replace(/^\s*\d{2}\/\d{2}\s*/, '')
    description = description.replace(/^[\s,;"'$\-]+|[\s,;"'$\-]+$/g, '').trim()
    description = description.replace(/\s+\d{1,3}\s*$/, '').trim()
    description = description.replace(/^[\s,;"'$]+|[\s,;"'$]+$/g, '').trim()

    if (!description || description.length < 3) continue
    if (/^\d+$/.test(description)) continue

    if (isCreditCard) {
      amount = -amount
    }

    const descUpper = description.toUpperCase()
    if (descUpper.includes('FEE') && !/\[Fee\]/.test(description)) {
      description = `[Fee] ${description}`
    } else if (descUpper.includes('INTEREST CHARGED') && !/\[Interest\]/.test(description)) {
      description = `[Interest] ${description}`
    }

    records.push({
      transaction_date: `${stmtYear}-${mm}-${dd}`,
      description: description.slice(0, 200),
      amount,
      account_name: finalAccountName,
    })
  }

  const uniqueRecords = records.filter((v, i, a) =>
    a.findIndex(t => t.transaction_date === v.transaction_date && t.description === v.description && t.amount === v.amount) === i
  )

  return {
    records: uniqueRecords,
    meta: {
      rows: uniqueRecords.length,
      year: stmtYear,
      fileName: file.name,
      detectedAccount: finalAccountName,
      startingBalance: balances.startingBalance,
      endingBalance: balances.endingBalance,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      isCreditCard,
    } as any
  }
}
