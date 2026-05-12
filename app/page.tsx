'use client'
export default function Dashboard() {
  return (
    <div className="p-6 font-sans max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-blue-700 mb-6 text-center">Mana Social LLC</h1>
      
      <div className="space-y-4">
        {/* Marketplace Summary */}
        <div className="p-4 bg-white border rounded-lg shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase">Platform Breakdowns</h2>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between border-b pb-1">
              <span>TCGplayer</span>
              <span className="font-mono font-bold">$0.00</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>eBay</span>
              <span className="font-mono font-bold">$0.00</span>
            </div>
            <div className="flex justify-between text-blue-600 font-bold">
              <span>ManaPool</span>
              <span className="font-mono">$0.00</span>
            </div>
          </div>
        </div>

        {/* Tax Liability - Moreno Valley Logic */}
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <h2 className="text-sm font-bold text-orange-800 uppercase">CA Sales Tax (8.75%)</h2>
          <p className="text-xs text-orange-700 mt-1 italic">Calculated for Moreno Valley LLC</p>
          <p className="text-xl font-bold mt-2 text-orange-900">$0.00 Owed</p>
        </div>
      </div>

      <div className="mt-8">
        <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-md">
          Upload ManaPool CSV
        </button>
      </div>
    </div>
  )
}
