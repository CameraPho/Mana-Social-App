import * as XLSX from 'xlsx'
import type { ParseResult } from '@/lib/types'

export function parseEbayCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string
        const wb = XLSX.read(text, { type: 'string', raw: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws)
        const pd = (v: any) => parseFloat(String(v || '0').replace(/[$,\s]/g, '')) || 0
        let totalGross = 0, totalFees = 0, totalNet = 0, totalShippingLabels = 0, rowCount = 0
        for (const row of rows) {
          if (!row['Listing title']) continue
          const itemSales = pd(row['Item sales'])
          const totalSellingCost = pd(row['Total selling costs'])
          const shippingLabels = pd(row['Shipping labels cost (Amount you paid to buy shipping labels on eBay)'])
          const netSales = pd(row['Net sales (Net of taxes and selling costs)'])
          if (itemSales === 0 && Number(row['Quantity sold'] || 0) === 0) continue
          totalGross += itemSales
          totalFees += parseFloat((totalSellingCost - shippingLabels).toFixed(2))
          totalNet += netSales
          totalShippingLabels += shippingLabels
          rowCount++
        }
        const saleDate = new Date().toISOString().split('T')[0]
        resolve({
          records: [{ platform: 'ebay', amount: parseFloat(totalGross.toFixed(2)), fees: parseFloat(totalFees.toFixed(2)), shipping: parseFloat(totalShippingLabels.toFixed(2)), sale_date: saleDate, period_start: saleDate, period_end: saleDate, entity: 'llc', net_sales: parseFloat(totalNet.toFixed(2)), num_orders: rowCount }],
          meta: { totalGross, totalFees, totalNet, totalShippingLabels, rows: rowCount }
        })
      } catch (err: any) { reject(new Error('eBay parse failed: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsText(file)
  })
}
