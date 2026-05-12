'use client'
import React, { useState } from 'react'

export default function Dashboard() {
  // Simple state for a quick buyout calculation
  const [cost, setCost] = useState(0);
  const [qty, setQty] = useState(0);
  const avgCost = qty > 0 ? (cost / qty).toFixed(2) : "0.00";

  return (
    <div style={{ 
      fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      padding: '16px'
    }}>
      
      {/* Branded Header */}
      <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '20px', marginBottom: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', margin: '0 auto 12px' }} />
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0' }}>Mana Social LLC</h1>
      </div>

      {/* Collection Buyout Tracker */}
      <div style={{ backgroundColor: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '16px' }}>
        <div style={{ backgroundColor: '#059669', padding: '16px' }}>
          <h2 style={{ color: 'white', fontWeight: '600', fontSize: '18px', margin: '0' }}>Collection Buyout Tools</h2>
        </div>
        
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Total Buyout Price ($)</label>
            <input 
              type="number" 
              onChange={(e) => setCost(Number(e.target.value))}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb' }} 
              placeholder="e.g. 1463"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Total Card Quantity</label>
            <input 
              type="number" 
              onChange={(e) => setQty(Number(e.target.value))}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb' }} 
              placeholder="e.g. 7500"
            />
          </div>

          <div style={{ backgroundColor: '#f0fdf4', borderRadius: '16px', padding: '16px', textAlign: 'center' }}>
            <span style={{ color: '#166534', fontSize: '14px', fontWeight: '600' }}>Average Cost Per Card: </span>
            <span style={{ color: '#166534', fontSize: '24px', fontWeight: 'bold' }}>${avgCost}</span>
          </div>
        </div>
      </div>

      {/* Active Payment Plans (Based on Spreadsheet) */}
      <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>Active Liabilities</h3>
        <div style={{ fontSize: '14px', borderLeft: '4px solid #ef4444', paddingLeft: '12px' }}>
          <p style={{ margin: '0', fontWeight: 'bold' }}>Brett Bruhanski</p>
          <p style={{ margin: '0', color: '#6b7280' }}>Left Over Owed: $1,000.00</p>
        </div>
      </div>

    </div>
  )
}
