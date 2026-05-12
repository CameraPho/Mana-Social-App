'use client'
import { useState } from 'react'
import Papa from 'papaparse'

export default function ManaDashboard() {
  const [sales, setSales] = useState({ gross: 0, taxPaidByPlatform: 0, netTaxable: 0 })
  const LLC_START_DATE = new Date('2026-03-18')

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0]
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        let currentGross = 0
        let currentFacilitatorTax = 0

        results.data.forEach((row: any) => {
          // eBay & TCGPlayer logic: We look for "Total" or "Gross" columns
          const amount = parseFloat(row['Total amount'] || row['Total Sales'] || row['Net'] || 0)
          const tax = parseFloat(row['Sales tax collected by eBay'] || row['Marketplace Facilitator Tax'] || 0)
          
          currentGross += amount
          currentFacilitatorTax += tax
        })

        setSales({
          gross: currentGross,
          taxPaidByPlatform: currentFacilitatorTax,
          netTaxable: currentGross - currentFacilitatorTax
        })
      }
    })
  }

  return (
    <div className="p-6 max-w-xl mx-auto font-sans bg-white min-h-screen text-slate-900">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold text-blue-800">Mana Social LLC</h1>
        <p className="text-sm text-slate-500">Moreno Valley Business Hub (8.75% Rate)</p>
      </header>

      <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100 mb-6">
        <label className="block text-sm font-semibold mb-2">Upload Platform CSV (eBay/TCG/ManaPool)</label>
        <input 
          type="file" 
          onChange={handleFileUpload}
          className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-600 file:text-white"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="p-4 border rounded-xl bg-white shadow-sm">
          <p className="text-xs text-slate-400 uppercase font-bold">Total Gross Sales</p>
          <p className="text-2xl font-semibold">${sales.gross.toFixed(2)}</p>
        </div>

        <div className="p-4 border rounded-xl bg-green-50 border-green-100">
          <p className="text-xs text-green-600 uppercase font-bold">Marketplace Tax Deductions</p>
          <p className="text-2xl font-semibold text-green-700">-${sales.taxPaidByPlatform.toFixed(2)}</p>
          <p className="text-[10px] text-green-500 mt-1">Facilitators handled this tax for you.</p>
        </div>

        <div className="p-4 border rounded-xl bg-orange-50 border-orange-100">
          <p className="text-xs text-orange-600 uppercase font-bold">Net Taxable (In-Person/Direct)</p>
          <p className="text-2xl font-semibold text-orange-700">${sales.netTaxable.toFixed(2)}</p>
          <p className="text-[10px] text-orange-400">Apply 8.75% tax only to this amount.</p>
        </div>
      </div>
    </div>
  )
}
