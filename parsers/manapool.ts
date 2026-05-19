import * as XLSX from 'xlsx'
import { LLC_START } from '@/lib/format'
import type { ParseResult } from '@/lib/types'

export function parseManaPoolCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string
        const wb = XLSX.read(text, { type: 'string', raw: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws)
        let totalGross = 0, totalFees = 0, totalShipping = 0, totalOrders = 0, minDate = '', maxDate = ''
        for (const row of rows) {
          const period = row['Period'] || row['period']
          if (!period) continue
          let dateStr = typeof period === 'number'
            ? new Date(Math.round((period - 25569) * 86400 * 1000)).toISOString().split('T')[0]
            : String(period).split('T')[0]
          if (!minDate || dateStr < minDate) minDate = dateStr
          if (!maxDate || dateStr > maxDate) maxDate = dateStr
          const subtotal = parseFloat(row['Subtotal'] || 0)
          const total = parseFloat(row['Total'] || 0)
          const shipping = parseFloat(row['Shipping'] || 0)
          const orders = parseInt(row['Order Count'] || 0)
          totalGross += subtotal
          totalFees += parseFloat(((subtotal * 0.05) + (total * 0.029) + (0.30 * orders)).toFixed(2))
          totalShipping += shipping
          totalOrders += orders
        }
        const saleDate = maxDate || new Date().toISOString().split('T')[0]
        resolve({
          records: [{ platform: 'manapool', amount: parseFloat(totalGross.toFixed(2)), fees: parseFloat(totalFees.toFixed(2)), shipping: parseFloat(totalShipping.toFixed(2)), sale_date: saleDate, period_start: minDate || saleDate, period_end: maxDate || saleDate, entity: new Date(saleDate) < LLC_START ? 'sole_prop' : 'llc', net_sales: parseFloat((totalGross - totalFees).toFixed(2)), num_orders: totalOrders }],
          meta: { totalGross, totalFees, totalShipping, totalOrders, periodStart: minDate, periodEnd: maxDate, rows: rows.length }
        })
      } catch (err: any) { reject(new Error('ManaPool parse failed: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsText(file)
  })
}
