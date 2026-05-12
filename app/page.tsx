'use client'
export default function Dashboard() {
  return (
    <div className="p-10 font-sans">
      <h1 className="text-3xl font-bold text-blue-600 text-center">Mana Social LLC</h1>
      <div className="mt-10 p-6 bg-gray-50 border rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-center underline">Mobile Dashboard Live</h2>
        <div className="grid grid-cols-1 gap-4 text-center">
             <p>Welcome, Camera Pho.</p>
             <p className="text-sm text-gray-500">Inventory and Sales syncing coming soon.</p>
        </div>
      </div>
    </div>
  )
}
