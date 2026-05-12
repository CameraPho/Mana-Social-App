'use client'
import React from 'react'

export default function Dashboard() {
  return (
    <div className="p-10 font-sans">
      <h1 className="text-3xl font-bold text-blue-600">Mana Social LLC</h1>
      <p className="text-gray-600 mt-2">Mobile Dashboard Live</p>
      
      <div className="mt-10 p-6 bg-gray-50 border rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-center">LLC Financial Hub</h2>
        <div className="grid grid-cols-1 gap-4 text-center">
             <p>Welcome, Camera Pho.</p>
             <p className="text-sm text-gray-400 italic">System is connected to Supabase.</p>
        </div>
      </div>
    </div>
  )
}
