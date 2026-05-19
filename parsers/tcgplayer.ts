import * as XLSX from 'xlsx'
import { LLC_START } from '@/lib/format'
import type { ParseResult } from '@/lib/types'

export function parseTCGplayerXLSX(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const sheetName = wb.SheetNames[0]
        const dateMatch = sheetName.match(/(\d{8})_(\d{8})$/)
        let periodStart = '', periodEnd = '', entity = 'llc'
        if (dateMatch) {
          const s = dateMatch[1], en = dateMatch[2]
          periodStart = `${s.slice(4)}-${s.slice(0,2)}-${s.slice(2,4)}`
          periodEnd = `${en.slice(4)}-${en.slice(0,2)}-${en.slice(2,4)}`
          entity = new Date(periodEnd) < LLC_START ? 'sole_prop' : 'llc'
        }
        const rows: any[] = XLSX.utils.sheet_to_json(ws)
        let grossSales = 0, netSales = 0, netShipping = 0, netTCGTax = 0, numOrders = 0
        for (const row of rows) {
          const state = row['State'] || row['state']
          if (!state || String(state).length !== 2) continue
          grossSales += Number(row['Gross Sales'] || 0)
          netSales += Number(row['Net Sales'] || 0)
          netShipping += Number(row['Net Shipping Amt'] || row['Shipping Amt'] || 0)
          netTCGTax += Number(row['Net TCG Tax Amt'] || row['TCG Tax Amt'] || 0)
          numOrders += Number(row['Number of Orders'] || 0)
        }
        const derivedFees = parseFloat((grossSales - netSales - netTCGTax).toFixed(2))
        const saleDate = periodEnd || new Date().toISOString().split('T')[0]
        resolve({
          records: [{ platform: 'tcgplayer', amount: parseFloat(grossSales.toFixed(2)), fees: derivedFees, shipping: parseFloat(netShipping.toFixed(2)), sale_date: saleDate, period_start: periodStart || saleDate, period_end: periodEnd || saleDate, entity, net_sales: parseFloat(netSales.toFixed(2)), num_orders: numOrders }],
          meta: { periodStart, periodEnd, entity, numOrders, grossSales, derivedFees, netSales, netShipping }
        })
      } catch (err: any) { reject(new Error('TCGplayer parse failed: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsArrayBuffer(file)
  })
}
