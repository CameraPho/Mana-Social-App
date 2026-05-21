// Sales tax rate for Mana Social LLC — Moreno Valley, CA
// State: 7.25% + Riverside County district tax: 0.50% = 7.75%
export const DEFAULT_SALES_TAX_RATE = 0.0775

// Compute the tax portion from a tax-inclusive gross sale.
// If buyer paid $54 including tax at 7.75%, the tax portion is:
//   $54 - ($54 / 1.0775) = $54 - $50.12 = $3.88
export function extractTaxFromGross(gross: number, rate: number): { net: number, tax: number } {
  if (rate <= 0) return { net: gross, tax: 0 }
  const net = gross / (1 + rate)
  const tax = gross - net
  return { 
    net: Math.round(net * 100) / 100, 
    tax: Math.round(tax * 100) / 100 
  }
}

// Compute the tax to ADD to a tax-exclusive net sale.
// If seller wants $50 net at 7.75%, gross is $50 * 1.0775 = $53.88
export function addTaxToNet(net: number, rate: number): { gross: number, tax: number } {
  if (rate <= 0) return { gross: net, tax: 0 }
  const tax = net * rate
  const gross = net + tax
  return {
    gross: Math.round(gross * 100) / 100,
    tax: Math.round(tax * 100) / 100
  }
}

// Format a quarter label from a date
export function quarterLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
  const year = d.getFullYear()
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${year}-Q${q}`
}

// Get quarter date range for filtering sales
export function quarterDateRange(quarterYear: string): { start: string, end: string } {
  const [year, qStr] = quarterYear.split('-Q')
  const q = parseInt(qStr)
  const startMonth = (q - 1) * 3
  const start = new Date(parseInt(year), startMonth, 1)
  const end = new Date(parseInt(year), startMonth + 3, 0)  // last day of quarter
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

// CDTFA filing deadlines (CA quarterly returns due last day of month following quarter end)
export function cdtfaDueDate(quarterYear: string): string {
  const [year, qStr] = quarterYear.split('-Q')
  const q = parseInt(qStr)
  const dueMonth = q * 3  // Apr=3, Jul=6, Oct=9, Jan(next year)=0
  const dueYear = q === 4 ? parseInt(year) + 1 : parseInt(year)
  const dueMonthAdjusted = q === 4 ? 0 : dueMonth
  const due = new Date(dueYear, dueMonthAdjusted + 1, 0)  // last day of due month
  return due.toISOString().slice(0, 10)
}
