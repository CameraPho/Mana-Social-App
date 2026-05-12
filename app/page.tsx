'use client'
import React, { useState } from 'react'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMonth, setSelectedMonth] = useState('April');
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Data mapping from your "2026 - Mana Social Financials"
  const monthlyData = {
    'March': {
      categories: {
        'Equipment': { total: 124.42, items: ['Folding Scissors', 'Plastic Easel', 'Neewer Photo Light Box', 'BCW Sort Tray'] },
        'Subscriptions': { total: 265.64, items: ['Claude', 'eBay Store', 'TCG Automate', 'SortSwift', 'LLC Fee'] },
        'Postage': { total: 233.25, items: ['Costco - Forever Stamps (x2)'] },
        'Supplies': { total: 96.62, items: ['Sticker Labels', 'Pencil Led', 'Shipping Bags'] },
        'Inventory': { total: 6850.09, items: ['Secret Lair - Deadpool', 'Strixhaven', 'Festival in a Box'] }
      },
      platforms: { tcg: 0.00, ebay: 0.00, manapool: 0.00 }
    },
    'April': {
      categories: {
        'Equipment': { total: 95.00, items: ['Epson Scanner Maintenance'] },
        'Subscriptions': { total: 180.00, items: ['Software Renewals'] },
        'Postage': { total: 77.75, items: ['Shipping Supplies'] },
        'Supplies': { total: 187.78, items: ['2000 Semi-Rigid Holders'] }, //
        'Inventory': { total: 1463.00, items: ['Brett Bruhanski Buyout'] } //
      },
      platforms: { tcg: 450.00, ebay: 120.00, manapool: 0.00 }
    }
  };

  const current = monthlyData[selectedMonth] || monthlyData['April'];
  const totalOut = Object.values(current.categories).reduce((acc, cat) => acc + cat.total, 0);

  const cardStyle = {
    backgroundColor: 'white', borderRadius: '24px', padding: '20px', 
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '16px'
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px' }}>
      
      {/* Header & Month Selector */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '8px', borderRadius: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}
          >
            <option>March</option>
            <option>April</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={() => setActiveTab('summary')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', backgroundColor: activeTab === 'summary' ? '#2563eb' : '#e5e7eb', color: activeTab === 'summary' ? 'white' : '#4b5563' }}>Summary</button>
        <button onClick={() => setActiveTab('imports')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', backgroundColor: activeTab === 'imports' ? '#2563eb' : '#e5e7eb', color: activeTab === 'imports' ? 'white' : '#4b5563' }}>Imports</button>
      </div>

      {activeTab === 'summary' ? (
        <>
          {/* Platform Breakdown */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase' }}>Platform Sales</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>TCGplayer</span><span style={{ fontWeight: 'bold' }}>${current.platforms.tcg.toFixed(2)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>eBay</span><span style={{ fontWeight: 'bold' }}>${current.platforms.ebay.toFixed(2)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ManaPool</span><span style={{ fontWeight: 'bold' }}>${current.platforms.manapool.toFixed(2)}</span></div>
          </div>

          {/* Detailed Expenses (Clickable) */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase' }}>Expense Details (Click to Expand)</h3>
            {Object.entries(current.categories).map(([name, data]) => (
              <div key={name} style={{ borderBottom: '1px solid #f3f4f6', padding: '12px 0' }}>
                <div 
                  onClick={() => setExpandedCategory(expandedCategory === name ? null : name)}
                  style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: expandedCategory === name ? 'bold' : 'normal' }}>{name}</span>
                  <span style={{ fontWeight: 'bold', color: name === 'Inventory' ? '#059669' : '#1f2937' }}>${data.total.toLocaleString()}</span>
                </div>
                {expandedCategory === name && (
                  <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '8px', fontSize: '13px', color: '#4b5563' }}>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {data.items.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '2px solid #2563eb', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Total Cash Out</span>
              <span style={{ color: '#2563eb' }}>${totalOut.toLocaleString()}</span>
            </div>
          </div>
        </>
      ) : (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Upload Platform Exports</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button style={uploadBtnStyle}>Upload TCGplayer CSV</button>
            <button style={uploadBtnStyle}>Upload eBay CSV</button>
            <button style={uploadBtnStyle}>Upload ManaPool CSV</button>
          </div>
          <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '20px' }}>
            CSV files will be processed to update your Sales Tax and STR metrics.
          </p>
        </div>
      )}

      {/* Outstanding Debt - */}
      <div style={{ backgroundColor: '#fff1f2', padding: '15px', borderRadius: '24px', border: '1px solid #fecaca' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#991b1b', fontWeight: 'bold' }}>LIABILITY: Brett Bruhanski</p>
        <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#991b1b' }}>$1,000.00 Owed</p>
      </div>
    </div>
  )
}

const uploadBtnStyle = {
  backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', padding: '14px', 
  borderRadius: '12px', fontWeight: '600', color: '#374151', textAlign: 'center'
};
