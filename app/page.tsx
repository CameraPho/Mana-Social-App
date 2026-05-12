'use client'
import React from 'react'

export default function Dashboard() {
  return (
    <div style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }} className="min-h-screen bg-gray-50 p-4">
      
      {/* Branded Header Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-4 flex flex-col items-center">
        <div className="w-32 h-32 mb-4">
           <img 
            src="/logo.png" 
            alt="Mana Social Logo" 
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Mana Social LLC</h1>
        <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">Culture • Community • Games</p>
      </div>

      {/* Main Stats Card */}
      <div className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden">
        <div className="bg-blue-600 p-4">
          <h2 className="text-white font-semibold text-lg">LLC Financial Hub</h2>
        </div>
        
        <div className="p-6 space-y-5">
          <div className="flex justify-between items-end border-b pb-3">
            <span className="text-gray-500 text-sm">Operator</span>
            <span className="text-gray-800 font-bold">Camera Pho</span>
          </div>

          <div className="flex justify-between items-end border-b pb-3">
            <span className="text-gray-500 text-sm">Supabase Status</span>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
               <span className="text-gray-800 font-bold">Connected</span>
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-blue-700 text-sm font-semibold">Moreno Valley Sales Tax</span>
              <span className="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">8.75%</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t">
          <p className="text-[10px] text-center text-gray-400 uppercase tracking-widest font-bold">
            Secure LLC Management Portal
          </p>
        </div>
      </div>
    </div>
  )
}
