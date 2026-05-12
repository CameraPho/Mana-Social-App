'use client'
import { useState } from 'react'
import { PlusCircle, TrendingUp, Receipt, Calculator } from 'lucide-react'

export default function Dashboard() {
  const [sales, setSales] = useState(0)

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Mana Social LLC</h1>
        <p className="text-slate-500">Moreno Valley HQ | 8.75% Tax Zone</p>
      </header>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button className="flex flex-col items-center justify-center p-4 bg-blue-600 text-white rounded-2xl shadow-lg">
          <PlusCircle size={24} />
          <span className="text-xs mt-2 font-semibold">Add Sale</span>
        </button>
        <button className="flex flex-col items-center justify-center p-4 bg-white text-slate-700 rounded-2xl shadow-md border border-slate-200">
          <Receipt size={24} />
          <span className="text-xs mt-2 font-semibold">Scan Receipt</span>
        </button>
      </div>

      {/* The Profit Engine */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-slate-500 text-sm font-medium uppercase tracking-wider">Gross Sales</h2>
            <p className="text-4xl font-bold text-slate-900 mt-1">$0.00</p>
          </div>
          <TrendingUp className="text-green-500" />
        </div>
        
        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400">15% Margin Target</p>
            <p className="font-semibold text-blue-600">$0.00</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Est. Tax Credits</p>
            <p className="font-semibold text-slate-700">$0.00</p>
          </div>
        </div>
      </div>

      {/* Tax Alert Logic */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
        <div className="flex gap-3">
          <Calculator className="text-amber-600" />
          <div>
            <h3 className="text-sm font-bold text-amber-800">Marketplace Deduction Logic</h3>
            <p className="text-xs text-amber-700 mt-1">
              The engine is ready to filter eBay/TCGplayer taxes so you don't overpay the CDTFA.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
