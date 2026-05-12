'use client'
import { useState } from 'react'

export default function Dashboard() {
  const [platformData, setPlatformData] = useState({
    tcgplayer: 0,
    ebay: 0,
    manapool: 0
  })

  // Tax logic: Deducting Facilitator sales from Gross for CA Form 401-A
  const totalGross = platformData.tcgplayer + platformData.ebay + platformData.manapool
  const facilitatorDeductions = totalGross // Since all 3 are facilitators
  const taxableSales = totalGross - facilitatorDeductions 
  const taxOwed = taxableSales * 0.0875

  return (
    <div className="p-6 font-sans max-w-lg mx-auto">
      <h1 className="text-3xl font-bold mb-6">Mana Social LLC</h1>
      
      <section className="mb-8">
        <h2 className="text-xl font-bold border-b-2 mb-4">Platform Breakdowns</h2>
        <div className="space-y-2">
          <p className="flex justify-between font-mono">TCGplayer <span>${platformData.tcgplayer.toFixed(2)}</span></p>
          <p className="flex justify-between font-mono">eBay <span>${platformData.ebay.toFixed(2)}</span></p>
          <p className="flex justify-between font-mono">ManaPool <span>${platformData.manapool.toFixed(2)}</span></p>
        </div>
      </section>

      <section className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-bold mb-2">CA Sales Tax (8.75%)</h2>
        <p className="text-sm text-gray-500 mb-4">Calculated for Moreno Valley LLC</p>
        <div className="space-y-1">
            <p className="text-sm">Gross Sales: ${totalGross.toFixed(2)}</p>
            <p className="text-sm text-green-600">Facilitator Deduction: -${facilitatorDeductions.toFixed(2)}</p>
            <p className="text-lg font-bold mt-2">${taxOwed.toFixed(2)} Owed</p>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <button className="bg-blue-600 text-white p-3 rounded-lg font-bold">Upload TCGplayer CSV</button>
        <button className="bg-blue-600 text-white p-3 rounded-lg font-bold">Upload eBay CSV</button>
        <button className="bg-blue-600 text-white p-3 rounded-lg font-bold">Upload ManaPool CSV</button>
      </div>
    </div>
  )
}
