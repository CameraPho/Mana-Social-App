import type { ParseResult } from '@/lib/types'

const PDFJS_CDN_SCRIPT = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs'
const PDFJS_CDN_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs'
const XLSX_CDN_SCRIPT  = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'

const CREDIT_CARD_NAMES = [
  'Cam | Costco Citi Visa', 'Cam | Citi Diamond Preferred',
  'Cam | Amazon Chase Prime Visa', 'Cam | Chase Sapphire Preferred',
  'Cam | Barclays View Mastercard', 'Cam | Apple Card',
  'Mana Social | WF Signify Mastercard',
]

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
}

const PLATFORM_HINTS = new Set(['eBay', 'TCGplayer', 'TCGplayer-tax', 'ManaPool'])

function detectBankFromText(text: string): { accountName: string; isCreditCard: boolean } {
  const t = text.toLowerCase()
  if (/wells\s*fargo/.test(t)) {
    const isBusiness = /business\s+(checking|market|advantage|choice|platinum)|initiate\s+business|optimize\s+business/.test(t)
    return { accountName: isBusiness ? 'Mana Social | WF Business Checking' : 'Cam | WF Personal Checking', isCreditCard: false }
  }
  if (/barclays/.test(t)) return { accountName: 'Cam | Barclays View Mastercard', isCreditCard: true }
  if (/costco\s*anywhere\s*visa|costco.*citi/.test(t)) return { accountName: 'Cam | Costco Citi Visa', isCreditCard: true }
  if (/diamond\s*preferred/.test(t)) return { accountName: 'Cam | Citi Diamond Preferred', isCreditCard: true }
  if (/amazon.*chase|chase.*amazon|prime\s*visa/.test(t)) return { accountName: 'Cam | Amazon Chase Prime Visa', isCreditCard: true }
  if (/sapphire/.test(t)) return { accountName: 'Cam | Chase Sapphire Preferred', isCreditCard: true }
  if (/chase/.test(t)) return { accountName: 'Cam | Chase Personal Checking', isCreditCard: false }
  return { accountName: 'Unknown', isCreditCard: false }
}

function extractBalances(text: string, isCreditCard: boolean): { startingBalance: number | null; endingBalance: number | null } {
  let startingBalance: number | null = null
  let endingBalance: number | null = null
  if (isCreditCard) {
    const prevMatch = text.match(/previous\s+balance[\s\$]*([\d,]+\.\d{2})/i)
    const newMatch = text.match(/new\s+balance[\s\$\sasof]*([\d,]+\.\d{2})/i)
    const stmtMatch = text.match(/statement\s+balance[^$]*\$([\d,]+\.\d{2})/i)
    if (prevMatch) startingBalance = parseFloat(prevMatch[1].replace(/,/g, ''))
    if (newMatch) endingBalance = parseFloat(newMatch[1].replace(/,/g, ''))
    if (endingBalance == null && stmtMatch) endingBalance = parseFloat(stmtMatch[1].replace(/,/g, ''))
  } else {
    const beginMatch = text.match(/(?:beginning|opening)\s+balance[\s:\$]*([\d,]+\.\d{2})/i)
    const endMatch = text.match(/ending\s+balance[\s:\$]*([\d,]+\.\d{2})/i)
    if (beginMatch) startingBalance = parseFloat(beginMatch[1].replace(/,/g, ''))
    if (endMatch) endingBalance = parseFloat(endMatch[1].replace(/,/g, ''))
  }
  return { startingBalance, endingBalance }
}

function extractPeriod(text: string): { periodStart: string | null; periodEnd: string | null } {
  const m1 = text.match(/(\d{2})\/(\d{2})\/(\d{2})\s*[-–]\s*(\d{2})\/(\d{2})\/(\d{2})/)
  if (m1) return { periodStart: `20${m1[3]}-${m1[1]}-${m1[2]}`, periodEnd: `20${m1[6]}-${m1[4]}-${m1[5]}` }
  const m2 = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(?:to|through|-|–)\s*(\d{2})\/(\d{2})\/(\d{4})/i)
  if (m2) return { periodStart: `${m2[3]}-${m2[1]}-${m2[2]}`, periodEnd: `${m2[6]}-${m2[4]}-${m2[5]}` }
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const m3 = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\s*(?:to|through|-|–)\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i)
  if (m3) {
    const sm = String(monthNames.indexOf(m3[1].toLowerCase()) + 1).padStart(2, '0')
    const sd = String(m3[2]).padStart(2, '0')
    const em = String(monthNames.indexOf(m3[4].toLowerCase()) + 1).padStart(2, '0')
    const ed = String(m3[5]).padStart(2, '0')
    return { periodStart: `${m3[3]}-${sm}-${sd}`, periodEnd: `${m3[6]}-${em}-${ed}` }
  }
  return { periodStart: null, periodEnd: null }
}

const NOISE_PATTERNS = [
  /PREVIOUS BALANCE|NEW BALANCE|STATEMENT BALANCE|MINIMUM PAYMENT|TOTAL PURCHASES/i,
  /ACCOUNT SUMMARY|CARDHOLDER SUMMARY|CREDIT LIMIT/i,
  /BILLING PERIOD|PAYMENT DUE|LATE PAYMENT/i,
  /AVAILABLE CREDIT|CASH ADVANCE LIMIT/i,
  /REWARDS SUMMARY|CASH BACK|EARNED THIS PERIOD/i,
  /TOTAL FEES FOR THIS PERIOD|TOTAL INTEREST FOR THIS PERIOD/i,
  /YEAR-TO-DATE|TOTALS YEAR/i,
  /OPENING.*CLOSING\s*DATE/i,
  /STATEMENT\s*PERIOD/i,
  /BEGINNING\s+BALANCE|ENDING\s+BALANCE/i,
  /^DEPOSITS\s+AND\s+ADDITIONS/i,
  /^ELECTRONIC\s+WITHDRAWALS/i,
  /^CHECKING\s+SUMMARY/i,
  /^TRANSACTION\s+DETAIL/i,
  /CHASE\s+TOTAL\s+CHECKING/i,
  /TOTAL\s+(PURCHASE|PAYMENT|FEES|INTEREST)\s+ACTIVITY/i,
  /POINTS\s+(SUMMARY|EARNED|DETAILS|BALANCE)/i,
  /TOTAL\s+POINTS/i,
  /STANDARD\s+(PURCHASES|BALANCE\s+TRANSFERS|CASH\s+ADVANCE)/i,
  /PROMOTIONAL\s+PURCHASE/i,
  /^TOTAL\s*\$/i,
]

function cleanDesc(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function parseCheckingByBalanceDelta(lines: string[], stmtYear: string, accountName: string, beginningBalance: number): any[] {
  const records: any[] = []
  let runningBalance = beginningBalance

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const dateMatch = line.match(/^\s*(\d{2})\/(\d{2})\s+/)
    if (!dateMatch) continue
    const mm = dateMatch[1]
    const dd = dateMatch[2]
    const monthNum = parseInt(mm)
    const dayNum = parseInt(dd)
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) continue

    const restOfLine = line.substring(dateMatch[0].length)
    const twoNumMatch = restOfLine.match(/(.+?)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/)
    if (twoNumMatch) {
      const desc = cleanDesc(twoNumMatch[1])
      const amount = parseFloat(twoNumMatch[2].replace(/,/g, ''))
      const newBalance = parseFloat(twoNumMatch[3].replace(/,/g, ''))
      if (desc.length >= 3 && amount !== 0) {
        records.push({ transaction_date: `${stmtYear}-${mm}-${dd}`, description: desc.slice(0, 200), amount, account_name: accountName })
        runningBalance = newBalance
      }
      continue
    }

    const oneNumMatch = restOfLine.match(/(.+?)\s+(-?[\d,]+\.\d{2})\s*$/)
    if (oneNumMatch) {
      const desc = cleanDesc(oneNumMatch[1])
      const newBalance = parseFloat(oneNumMatch[2].replace(/,/g, ''))
      const amount = parseFloat((newBalance - runningBalance).toFixed(2))
      if (desc.length >= 3 && Math.abs(amount) > 0.001) {
        records.push({ transaction_date: `${stmtYear}-${mm}-${dd}`, description: desc.slice(0, 200), amount, account_name: accountName })
        runningBalance = newBalance
      }
      continue
    }

    let description = restOfLine
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const nextLine = lines[j]
      const lineAmtBal = nextLine.match(/^\s*(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/)
      if (lineAmtBal) {
        const desc = cleanDesc(description)
        const amount = parseFloat(lineAmtBal[1].replace(/,/g, ''))
        const newBalance = parseFloat(lineAmtBal[2].replace(/,/g, ''))
        if (desc.length >= 3 && amount !== 0) {
          records.push({ transaction_date: `${stmtYear}-${mm}-${dd}`, description: desc.slice(0, 200), amount, account_name: accountName })
          runningBalance = newBalance
        }
        i = j
        break
      }
      const lineBal = nextLine.match(/^\s*(-?[\d,]+\.\d{2})\s*$/)
      if (lineBal) {
        const desc = cleanDesc(description)
        const newBalance = parseFloat(lineBal[1].replace(/,/g, ''))
        const amount = parseFloat((newBalance - runningBalance).toFixed(2))
        if (desc.length >= 3 && Math.abs(amount) > 0.001) {
          records.push({ transaction_date: `${stmtYear}-${mm}-${dd}`, description: desc.slice(0, 200), amount, account_name: accountName })
          runningBalance = newBalance
        }
        i = j
        break
      }
      description += ' ' + nextLine
    }
  }
  return records.filter((v, i, a) => a.findIndex(t => t.transaction_date === v.transaction_date && t.description === v.description && t.amount === v.amount) === i)
}

function parseCreditCard(lines: string[], stmtYear: string, accountName: string): any[] {
  const records: any[] = []
  const monthRe = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (NOISE_PATTERNS.some(p => p.test(line))) continue

    const dollarCount = (line.match(/[\d,]+\.\d{2}/g) || []).length
    if (dollarCount >= 3) continue

    let mm = '', dd = '', dateEndIndex = -1

    // Pattern A: MM/DD (Chase, Citi, Amazon Chase)
    const mmddMatch = line.match(/(?<![\/\d])(\d{2})\/(\d{2})(?!\d|\/)/)
    if (mmddMatch && mmddMatch.index !== undefined) {
      const monthNum = parseInt(mmddMatch[1])
      const dayNum = parseInt(mmddMatch[2])
      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
        mm = mmddMatch[1]
        dd = mmddMatch[2]
        dateEndIndex = mmddMatch.index + mmddMatch[0].length
      }
    }

    // Pattern B: "Mon DD" at start (Barclays, Apple Card)
    if (dateEndIndex === -1) {
      const monMatch = line.match(/^\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}))?/i)
      if (monMatch && monMatch.index !== undefined) {
        const monKey = monMatch[1].toLowerCase()
        const mmCandidate = MONTH_MAP[monKey]
        if (mmCandidate) {
          const dayNum = parseInt(monMatch[2])
          if (dayNum >= 1 && dayNum <= 31) {
            mm = mmCandidate
            dd = String(dayNum).padStart(2, '0')
            dateEndIndex = monMatch.index + monMatch[0].length
          }
        }
      }
    }

    if (dateEndIndex === -1) continue
    if (!monthRe.test(line) && !mmddMatch) continue

    const amountMatch = line.match(/([-+]?\s*\$?\s*[\d,]+\.\d{2})\s*$/)
    if (!amountMatch) continue
    const rawAmtStr = amountMatch[1]

    let amount = parseFloat(rawAmtStr.replace(/[^0-9.\-]/g, ''))
    if (isNaN(amount) || amount === 0) continue
    if (rawAmtStr.trim().startsWith('-') && amount > 0) amount = -amount

    const amtStartIndex = line.lastIndexOf(rawAmtStr.trim())
    if (amtStartIndex <= dateEndIndex) continue

    let description = line.substring(dateEndIndex, amtStartIndex).trim()
    description = description.replace(/^\s*\d{2}\/\d{2}\s*/, '')
    description = description.replace(/^\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s*/i, '')
    description = description.replace(/^[\s,;"'$\-]+|[\s,;"'$\-]+$/g, '').trim()
    // Strip trailing points/zip/ref number (1+ digits with optional commas)
    description = description.replace(/\s+[\d,]+\s*$/, '').trim()
    description = description.replace(/^[\s,;"'$]+|[\s,;"'$]+$/g, '').trim()

    if (!description || description.length < 3) continue
    if (/^\d+$/.test(description)) continue

    amount = -amount  // Flip sign: purchases negative, payments positive

    const descUpper = description.toUpperCase()
    if (descUpper.includes('FEE') && !/\[Fee\]/.test(description)) description = `[Fee] ${description}`
    else if (descUpper.includes('INTEREST CHARGED') && !/\[Interest\]/.test(description)) description = `[Interest] ${description}`

    records.push({ transaction_date: `${stmtYear}-${mm}-${dd}`, description: description.slice(0, 200), amount, account_name: accountName })
  }

  return records.filter((v, i, a) => a.findIndex(t => t.transaction_date === v.transaction_date && t.description === v.description && t.amount === v.amount) === i)
}

// ============================================
// PLATFORM SALES PARSERS
// ============================================

function csvSplit(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"'
      i++
    } else if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function moneyParse(s: string | undefined): number {
  if (!s) return 0
  const cleaned = s.replace(/[$,\s]/g, '')
  const n = parseFloat(cleaned)
  return isFinite(n) ? n : 0
}

function findHeaderRow(lines: string[], requiredCols: string[]): { idx: number; headers: string[] } {
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = csvSplit(lines[i]).map(c => c.replace(/^\ufeff/, '').toLowerCase().trim())
    if (requiredCols.every(req => cols.some(c => c === req.toLowerCase() || c.includes(req.toLowerCase())))) {
      return { idx: i, headers: cols }
    }
  }
  return { idx: -1, headers: [] }
}

function parseTcgSummary(lines: string[], fileName: string): ParseResult {
  const { idx, headers } = findHeaderRow(lines, ['period', 'subtotal'])
  if (idx === -1) throw new Error('TCGplayer summary: expected columns Period, Total, Subtotal, Shipping, Order Count')

  const cPeriod = headers.findIndex(h => h === 'period')
  const cSub = headers.findIndex(h => h === 'subtotal')
  const cShip = headers.findIndex(h => h === 'shipping')
  const cOrders = headers.findIndex(h => h === 'order count')

  const records: any[] = []
  let grossSales = 0, totalShipping = 0, totalOrders = 0
  let minDate = '9999-12-31', maxDate = '0000-01-01'

  for (let i = idx + 1; i < lines.length; i++) {
    const cols = csvSplit(lines[i])
    if (cols.length < 3) continue
    const period = (cols[cPeriod] || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) continue
    const amount = moneyParse(cols[cSub])
    const ship = cShip >= 0 ? moneyParse(cols[cShip]) : 0
    const orders = cOrders >= 0 ? (parseInt(cols[cOrders]) || 0) : 0
    if (amount === 0 && ship === 0) continue

    records.push({
      platform: 'TCGplayer',
      amount,
      shipping: ship,
      fees: 0,
      ca_sales_tax: 0,
      other_domestic_sales_tax: 0,
      international_sales_tax: 0,
      sale_date: period,
      period_start: period,
      period_end: period,
      num_orders: orders,
      account_name: 'TCGplayer',
    })
    grossSales += amount
    totalShipping += ship
    totalOrders += orders
    if (period < minDate) minDate = period
    if (period > maxDate) maxDate = period
  }

  return {
    records,
    meta: {
      rows: records.length,
      fileName,
      detectedAccount: 'TCGplayer',
      periodStart: minDate === '9999-12-31' ? null : minDate,
      periodEnd: maxDate === '0000-01-01' ? null : maxDate,
      grossSales,
      numOrders: totalOrders,
      totalShipping,
    } as any,
  }
}

function parseTcgTax(lines: string[], fileName: string): ParseResult {
  let periodStart: string | null = null
  let periodEnd: string | null = null
  const fnMatch = fileName.match(/(\d{2})(\d{2})(\d{4})_(\d{2})(\d{2})(\d{4})/)
  if (fnMatch) {
    periodStart = `${fnMatch[3]}-${fnMatch[1]}-${fnMatch[2]}`
    periodEnd = `${fnMatch[6]}-${fnMatch[4]}-${fnMatch[5]}`
  }

  const { idx, headers } = findHeaderRow(lines, ['state', 'gross sales'])
  if (idx === -1) throw new Error('TCGplayer tax: expected columns State, Channel, Gross Sales, Seller Tax Amt, TCG Tax Amt')

  const cState = headers.findIndex(h => h === 'state')
  const cGross = headers.findIndex(h => h === 'gross sales')
  const cShip = headers.findIndex(h => h === 'shipping amt')
  const cSellerTax = headers.findIndex(h => h === 'seller tax amt')
  const cTcgTax = headers.findIndex(h => h === 'tcg tax amt')
  const cOrders = headers.findIndex(h => h === 'number of orders')

  let totalGross = 0, totalShip = 0, totalOrders = 0, caTax = 0, otherTax = 0
  const statesSeen = new Set<string>()

  for (let i = idx + 1; i < lines.length; i++) {
    const cols = csvSplit(lines[i])
    if (cols.length < 3) continue
    const state = (cols[cState] || '').trim().toUpperCase()
    if (!state || state.startsWith('TOTAL')) continue
    const gross = moneyParse(cols[cGross])
    const ship = cShip >= 0 ? moneyParse(cols[cShip]) : 0
    const sellerTax = cSellerTax >= 0 ? moneyParse(cols[cSellerTax]) : 0
    const tcgTax = cTcgTax >= 0 ? moneyParse(cols[cTcgTax]) : 0
    const orders = cOrders >= 0 ? (parseInt(cols[cOrders]) || 0) : 0
    const taxTotal = sellerTax + tcgTax

    totalGross += gross
    totalShip += ship
    totalOrders += orders
    statesSeen.add(state)
    if (state === 'CA') caTax += taxTotal
    else otherTax += taxTotal
  }

  const recordDate = periodEnd ?? new Date().toISOString().split('T')[0]
  const records: any[] = totalGross > 0 ? [{
    platform: 'TCGplayer',
    amount: totalGross,
    shipping: totalShip,
    fees: 0,
    ca_sales_tax: caTax,
    other_domestic_sales_tax: otherTax,
    international_sales_tax: 0,
    sale_date: recordDate,
    period_start: periodStart ?? recordDate,
    period_end: periodEnd ?? recordDate,
    num_orders: totalOrders,
    account_name: 'TCGplayer',
  }] : []

  return {
    records,
    meta: {
      rows: records.length,
      fileName,
      detectedAccount: 'TCGplayer',
      periodStart,
      periodEnd,
      totalGross,
      numStates: statesSeen.size,
      numOrders: totalOrders,
    } as any,
  }
}

function parseEbayListings(lines: string[], fileName: string): ParseResult {
  const { idx, headers } = findHeaderRow(lines, ['listing title', 'item sales'])
  if (idx === -1) throw new Error('eBay listings: expected columns Listing title, Item sales, Final value fees, etc.')

  const find = (name: string) => headers.findIndex(h => h === name.toLowerCase())
  const cQty = find('quantity sold')
  const cItem = find('item sales')
  const cTaxYou = find('taxes and government fees paid by buyer to you')
  const cTaxEbay = find('taxes and government fees paid by buyer to ebay')
  const cShip = find('shipping and handling paid by buyer to you')
  const cInsertion = find('insertion fees')
  const cOptional = find('optional listing upgrade fees')
  const cFvf = find('final value fees')
  const cPromoted = find('promoted listings - general fees')
  const cOther = find('other ebay fees')
  const cDeposit = find('deposit processing fees')
  const cFeeCredits = find('fee credits')
  const cLabels = find('shipping labels cost (amount you paid to buy shipping labels on ebay)')

  let gross = 0, ship = 0, fees = 0, labels = 0, taxToEbay = 0, taxToYou = 0, qty = 0
  let rowCount = 0

  for (let i = idx + 1; i < lines.length; i++) {
    const cols = csvSplit(lines[i])
    if (cols.length < 5) continue
    const title = (cols[0] || '').trim()
    if (!title || title.toLowerCase().startsWith('total')) continue
    qty += parseInt(cols[cQty]) || 0
    gross += moneyParse(cols[cItem])
    if (cShip >= 0) ship += moneyParse(cols[cShip])
    if (cTaxEbay >= 0) taxToEbay += moneyParse(cols[cTaxEbay])
    if (cTaxYou >= 0) taxToYou += moneyParse(cols[cTaxYou])
    if (cLabels >= 0) labels += moneyParse(cols[cLabels])
    const fvf = cFvf >= 0 ? moneyParse(cols[cFvf]) : 0
    const promo = cPromoted >= 0 ? moneyParse(cols[cPromoted]) : 0
    const other = cOther >= 0 ? moneyParse(cols[cOther]) : 0
    const deposit = cDeposit >= 0 ? moneyParse(cols[cDeposit]) : 0
    const insertion = cInsertion >= 0 ? moneyParse(cols[cInsertion]) : 0
    const optional = cOptional >= 0 ? moneyParse(cols[cOptional]) : 0
    const credits = cFeeCredits >= 0 ? moneyParse(cols[cFeeCredits]) : 0
    fees += fvf + promo + other + deposit + insertion + optional - credits
    rowCount++
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const periodStart = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0]

  const records: any[] = gross > 0 ? [{
    platform: 'eBay',
    amount: gross,
    shipping: ship,
    fees,
    ca_sales_tax: 0,
    other_domestic_sales_tax: taxToYou,
    international_sales_tax: 0,
    sale_date: todayStr,
    period_start: periodStart,
    period_end: todayStr,
    num_orders: qty,
    account_name: 'eBay',
  }] : []

  return {
    records,
    meta: {
      rows: rowCount,
      fileName,
      detectedAccount: 'eBay',
      periodStart,
      periodEnd: todayStr,
      totalGross: gross,
      totalShipping: ship,
      totalFees: fees,
      totalLabelsCost: labels,
      totalTaxRemittedByPlatform: taxToEbay,
      totalTaxOwedByYou: taxToYou,
      numListings: rowCount,
    } as any,
  }
}

function parseManaPool(lines: string[], fileName: string): ParseResult {
  const { idx, headers } = findHeaderRow(lines, ['total'])
  if (idx === -1) throw new Error('ManaPool: header row not found. Expected a Total column.')

  const find = (...names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex(h => h === n.toLowerCase() || h.includes(n.toLowerCase()))
      if (i >= 0) return i
    }
    return -1
  }
  const cDate = find('date', 'order date', 'sale date', 'period')
  const cTotal = find('total', 'gross', 'amount')
  const cSub = find('subtotal', 'item total', 'items')
  const cShip = find('shipping', 'ship')
  const cFees = find('fees', 'fee', 'commission')
  const cOrders = find('orders', 'order count', 'order id')

  const records: any[] = []
  let totalGross = 0, totalShip = 0, totalFees = 0, totalOrders = 0
  let minDate = '9999-12-31', maxDate = '0000-01-01'

  for (let i = idx + 1; i < lines.length; i++) {
    const cols = csvSplit(lines[i])
    if (cols.length < 2) continue
    const rawDate = cDate >= 0 ? (cols[cDate] || '').trim() : ''
    if (!rawDate) continue
    let date = rawDate
    const dMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/) || rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (!dMatch) continue
    if (dMatch[0].includes('/')) date = `${dMatch[3]}-${dMatch[1]}-${dMatch[2]}`
    else date = `${dMatch[1]}-${dMatch[2]}-${dMatch[3]}`

    const total = cTotal >= 0 ? moneyParse(cols[cTotal]) : 0
    const sub = cSub >= 0 ? moneyParse(cols[cSub]) : total
    const ship = cShip >= 0 ? moneyParse(cols[cShip]) : 0
    const fees = cFees >= 0 ? moneyParse(cols[cFees]) : 0
    const orders = cOrders >= 0 ? (parseInt(cols[cOrders]) || 1) : 1
    if (sub === 0 && ship === 0) continue

    records.push({
      platform: 'ManaPool',
      amount: sub,
      shipping: ship,
      fees,
      ca_sales_tax: 0,
      other_domestic_sales_tax: 0,
      international_sales_tax: 0,
      sale_date: date,
      period_start: date,
      period_end: date,
      num_orders: orders,
      account_name: 'ManaPool',
    })
    totalGross += sub
    totalShip += ship
    totalFees += fees
    totalOrders += orders
    if (date < minDate) minDate = date
    if (date > maxDate) maxDate = date
  }

  return {
    records,
    meta: {
      rows: records.length,
      fileName,
      detectedAccount: 'ManaPool',
      periodStart: minDate === '9999-12-31' ? null : minDate,
      periodEnd: maxDate === '0000-01-01' ? null : maxDate,
      totalGross,
      totalShipping: totalShip,
      totalFees,
      totalOrders,
    } as any,
  }
}

// ============================================
// MAIN PARSER ENTRY POINT
// ============================================
export async function parsePDF(file: File, accountName: string): Promise<ParseResult> {
  let textContentLines: string[] = []
  const fileNameUpper = file.name.toUpperCase()
  let stmtYear = String(new Date().getFullYear())

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

  // Dispatch platform sales parsers BEFORE bank-statement logic
  if (PLATFORM_HINTS.has(accountName)) {
    if (accountName === 'TCGplayer') return parseTcgSummary(lines, file.name)
    if (accountName === 'TCGplayer-tax') return parseTcgTax(lines, file.name)
    if (accountName === 'eBay') return parseEbayListings(lines, file.name)
    if (accountName === 'ManaPool') return parseManaPool(lines, file.name)
  }

  const headerText = lines.slice(0, 150).join(' ')
  const detected = detectBankFromText(headerText)
  const finalAccountName = detected.accountName !== 'Unknown' ? detected.accountName : accountName
  const isCreditCard = detected.isCreditCard || CREDIT_CARD_NAMES.includes(accountName)
  const isChecking = !isCreditCard

  const balances = extractBalances(headerText, isCreditCard)
  const period = extractPeriod(headerText)

  const yearMatch = headerText.match(/\b(202[4-9])\b/)
  if (yearMatch) stmtYear = yearMatch[1]
  const billingMatch = headerText.match(/(\d{2})\/(\d{2})\/(\d{2})\s*[-–]\s*(\d{2})\/(\d{2})\/(\d{2})/)
  if (billingMatch) stmtYear = `20${billingMatch[6]}`

  let uniqueRecords: any[]
  if (isChecking && balances.startingBalance != null) {
    uniqueRecords = parseCheckingByBalanceDelta(lines, stmtYear, finalAccountName, balances.startingBalance)
  } else {
    uniqueRecords = parseCreditCard(lines, stmtYear, finalAccountName)
  }

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
    } as any,
  }
}
