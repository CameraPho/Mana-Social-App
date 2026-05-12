'use client'
import { useState } from 'react'

export default function Dashboard() {
  const [revenue, setRevenue] = useState(0)
  
  // Moreno Valley Tax Rate
  const taxRate = 0.0875 

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-900">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-blue-800">Mana Social LLC</h1>
        <p className="text-sm text-gray-500 uppercase tracking-widest">Business Intelligence Dashboard</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sales Sync Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4">Sync Platform Sales</h2>
          <div className="border-2 border-dashed border-blue-200 rounded-xl p-8 text-center">
            <input 
              type="file" 
              accept=".csv" 
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700"
            />
            <p className="mt-2 text-xs text-gray-400">Upload eBay or TCGPlayer CSV export</p>
          </div>
        </div>

        {/* Profit Tracker Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4">LLC Financial Pulse</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-gray-600">Gross Marketplace Sales</span>
              <span className="font-mono font-bold text-lg">$0.00</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2 text-green-600 font-medium">
              <span>Target Profit (15%)</span>
              <span className="font-mono font-bold text-lg">$0.00</span>
            </div>
            <div className="flex justify-between items-center text-blue-600 font-medium">
              <span>CA Sales Tax Credit (Est)</span>
              <span className="font-mono font-bold text-lg">$0.00</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-12 pt-6 border-t text-center text-xs text-gray-400">
        &copy; 2026 Mana Social LLC • Moreno Valley, CA
      </footer>
    </div>
  )
}
