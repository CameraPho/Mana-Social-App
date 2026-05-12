'use client'
import React, { useState } from 'react'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('buyouts');
  const [cost, setCost] = useState(0);
  const [qty, setQty] = useState(0);
  
  const avgCost = qty > 0 ? (cost / qty).toFixed(2) : "0.00";

  return (
    <div style={{ 
      fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif',
      backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px'
    }}>
      
      {/* Header */}
      <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '15px', marginBottom: '16px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain', margin: '0 auto' }} />
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '8px' }}>Mana Social LLC</h1>
      </div>

      {/* Navigation Toggles */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button 
          onClick={() => setActiveTab('buyouts')}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', backgroundColor: activeTab === 'buyouts' ? '#059669' : '#e5e7eb', color: activeTab === 'buyouts' ? 'white' : '#4b5563' }}>
          Buyouts
        </button>
        <button 
          onClick={() => setActiveTab('expenses')}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', backgroundColor: activeTab === 'expenses' ? '#2563eb' : '#e5e7eb', color: activeTab === 'expenses' ? 'white' : '#4b5563' }}>
          Supplies/SaaS
        </button>
      </div>

      {activeTab === 'buyouts' ? (
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669', marginBottom: '15px' }}>Collection Tracker</h2>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280' }}>Acquisition Cost ($)</label>
            <input type="number" onChange={(e) => setCost(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ddd', marginTop: '4px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280' }}>Card Count</label>
            <input type="number" onChange={(e) => setQty(Number(e.target.value))} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #ddd', marginTop: '4px' }} />
          </div>
          <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '15px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#166534' }}>Avg Cost Per Card</p>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#166534' }}>${avgCost}</p>
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb', marginBottom: '15px' }}>Business Expenses</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Example of items from your Financial file */}
            <div style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>TCG Automate / SortSwift</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Monthly SaaS Subscription</p>
            </div>
            <div style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>BCW Supplies</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Toploaders / Team Bags</p>
            </div>
          </div>
        </div>
      )}

      {/* Liability Watch */}
      <div style={{ marginTop: '16px', backgroundColor: '#fff1f2', padding: '15px', borderRadius: '24px', border: '1px solid #fecaca' }}>
        <h3 style={{ fontSize: '14px', color: '#991b1b', margin: '0 0 8px 0' }}>Outstanding Liability</h3>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#991b1b' }}>Brett Bruhanski: $1,000.00</p>
      </div>
    </div>
  )
}
