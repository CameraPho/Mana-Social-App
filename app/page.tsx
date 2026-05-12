'use client'
import React from 'react'

export default function Dashboard() {
  return (
    <div style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }} className="p-8">
      
      {/* Logo Section */}
      <div className="flex justify-center mb-6">
        <img 
          src="/logo.png" 
          alt="Mana Social Logo" 
          className="w-48 h-auto"
        />
      </div>

      <h1 className="text-3xl font-bold text-center text-gray-800">Mana Social LLC</h1>
      <p className="text-center text-gray-500 mt-1">Culture • Community • Games</p>
      
      <div className="mt-10 p-6 bg-white border border-gray-200 rounded-2xl shadow-lg">
        <div className="border-b pb-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-700">LLC Financial Hub</h2>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">User:</span>
            <span className="font-medium">Camera Pho</span>
          </div>
          <div className="flex justify-between items-center text-green-600">
            <span className="text-gray-600">Status:</span>
            <span className="font-bold">● Connected to Supabase</span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-dashed">
          <p className="text-xs text-center text-gray-400 italic">
            Moreno Valley Tax Logic (8.75%) Active
          </p>
        </div>
      </div>
    </div>
  )
}
