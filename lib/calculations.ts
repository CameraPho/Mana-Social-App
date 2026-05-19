import { USEFUL_LIFE } from './constants'

export function calcDepreciation(cost: number, life: number, purchaseDate: string, year: number) {
  const yearsIn = year - new Date(purchaseDate).getFullYear()
  if (yearsIn < 0 || yearsIn >= life) return { slAnnual: 0, slAccumulated: 0, slBookValue: cost }
  const slAnnual = parseFloat((cost / life).toFixed(2))
  const slAccumulated = parseFloat((slAnnual * (yearsIn + 1)).toFixed(2))
  return { slAnnual, slAccumulated, slBookValue: parseFloat(Math.max(0, cost - slAccumulated).toFixed(2)) }
}

export function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [], cur = new Date(start + 'T12:00:00'), last = new Date(end + 'T12:00:00')
  while (cur <= last) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1) }
  return dates
}
export function getWeekDates(dateStr: string): string[] {
  const d = new Date(dateStr + 'T12:00:00'), day = d.getDay()
  const monday = new Date(d); monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(monday); dd.setDate(monday.getDate() + i); return dd.toISOString().split('T')[0] })
}
export function getMonthDates(dateStr: string): string[] {
  const [y, m] = dateStr.split('-').map(Number)
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`)
}

export function assetTotals(assets: any[], year: number) {
  const totalDepreciation = assets.reduce((a, r) => {
    const life = parseInt(r.useful_life_yrs) || USEFUL_LIFE[r.category] || 5
    return a + calcDepreciation(parseFloat(r.cost), life, r.purchase_date, year).slAnnual
  }, 0)
  const totalAssetCost = assets.reduce((a, r) => a + parseFloat(r.cost || 0), 0)
  const totalAccumulatedDep = assets.reduce((a, r) => {
    const life = parseInt(r.useful_life_yrs) || USEFUL_LIFE[r.category] || 5
    return a + calcDepreciation(parseFloat(r.cost), life, r.purchase_date, year).slAccumulated
  }, 0)
  return { totalDepreciation, totalAssetCost, totalAccumulatedDep, totalBookValue: totalAssetCost - totalAccumulatedDep }
}
