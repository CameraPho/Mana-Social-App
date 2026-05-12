'use client'
import { useState } from 'react''use client'
import React, { useState } from 'react'

export default function Dashboard() {
  return (
    <main className="min-h-screen p-4 md:p-12 bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 border-b pb-4">
          <h1 className="text-3xl font-extrabold text-slate-900">Mana Social LLC</h1>
          <p className="text-slate-500 font-medium text-sm">Business Operations Hub • Moreno Valley, CA</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sales Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Estimated LLC Gross Sales</h3>
            <p className="text-3xl font-bold text-slate-900 font-mono">$0.00</p>
          </div>

          {/* Profit Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Net Profit (15% Target)</h3>
            <p className="text-3xl font-bold text-green-600 font-mono">$0.00</p>
          </div>
        </div>

        <div className="mt-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-blue-600 font-bold text-xl">+</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Sync Your Business Data</h2>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">Upload your eBay or TCGPlayer CSV files to update your LLC financial records.</p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold shadow-md active:bg-blue-700 transition">
            Import CSV File
          </button>
        </div>
      </div>
    </main>
  )
}

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
