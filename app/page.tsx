'use client'
import React, { useState } from 'react'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMonth, setSelectedMonth] = useState('April');
  const [cost, setCost] = useState(0);
  const [qty, setQty] = useState(0);
  
  const avgCost = qty > 0 ? (cost / qty).toFixed(2) : "0.00";

  // Data structure matching your "2026 - Mana Social Financials" categories
  const monthlyData = {
    'March': { supplies: 96.62, srv: 265.64, equip: 124.42, postage: 233.25, inventory: 6850.09 },
    'April': { supplies: 187.78, srv: 180.00, equip: 95.00, postage: 77.75, inventory: 1463.00 },
  };

  const current = monthlyData[selectedMonth] || { supplies: 0, srv: 0, equip: 0, postage: 0, inventory: 0 };
  const totalMonthly = Object.values(current).reduce((a, b) => a + b, 0);

  const cardStyle = {
    backgroundColor: 'white', borderRadius: '24px', padding: '20px', 
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '16px'
  };

  return (
    <div style={{ 
      fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif',
      backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px'
    }}>
      
      {/* Header & Month Picker */}
      <div style={cardStyle}>
        <img src="/logo.png" alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain', margin: '0 auto' }} />
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center', marginTop: '8px' }}>Mana Social LLC</h1>
        
        <select 
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{ width: '100%', marginTop: '15px', padding: '10px', borderRadius: '12px', border: '1px solid #ddd', fontWeight: 'bold' }}
        >
          <option>March</option>
          <option>April</option>
          <option>May</option>
        </select>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'buyouts'].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ 
              flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold',
              backgroundColor: activeTab === tab ? '#2563eb' : '#e5e7eb', 
              color: activeTab === tab ? 'white' : '#4b5563',
              textTransform: 'capitalize'
            }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'summary' ? (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginBottom: '15px' }}>{selectedMonth} Expense Breakdown</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <StatRow label="Equipment (Tools/Safety)" value={current.equip} color="#1f2937" />
            <StatRow label="Subscriptions (SaaS)" value={current.srv} color="#1f2937" />
            <StatRow label="Postage & Shipping" value={current.postage} color="#1f2937" />
            <StatRow label="Supplies (Labels/Bags)" value={current.supplies} color="#1f2937" />
            <StatRow label="Inventory Acquisitions" value={current.inventory} color="#059669" />
            
            <div style={{ marginTop: '10px', paddingTop: '15px', borderTop: '2px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 'bold' }}>Total Cash Out</span>
              <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${totalMonthly.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669', marginBottom: '15px' }}>Buyout Calculator</h2>
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
      )}

      {/* Liability Watch (Always Visible) */}
      <div style={{ backgroundColor: '#fff1f2', padding: '15px', borderRadius: '24px', border: '1px solid #fecaca' }}>
        <h3 style={{ fontSize: '12px', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 5px 0' }}>Outstanding Liability</h3>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#991b1b' }}>Brett Bruhanski: $1,000.00</p>
      </div>
    </div>
  )
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 'bold', color: color }}>${value.toLocaleString()}</span>
    </div>
  )
}
