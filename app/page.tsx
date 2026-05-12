'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// This connects your app to the database you just set up
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [expenses, setExpenses] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Fetch real expenses from Supabase
  useEffect(() => {
    async function getExpenses() {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .filter('purchase_date', 'gte', `2026-${selectedMonth}-01`)
        .filter('purchase_date', 'lt', `2026-${selectedMonth + 1}-01`);
      if (data) setExpenses(data);
    }
    getExpenses();
  }, [selectedMonth]);

  const categories = ['Equipment', 'Subscriptions', 'Postage', 'Supplies', 'Inventory'];
  
  const getCategoryTotal = (cat) => 
    expenses.filter(e => e.category === cat).reduce((sum, item) => sum + Number(item.cost), 0);

  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Calibri, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px' }}>
      
      {/* Header */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo.png" style={{ width: '50px' }} alt="Logo" />
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={() => setActiveTab('summary')} style={{ flex: 1, padding: '12px', borderRadius: '12px', backgroundColor: activeTab === 'summary' ? '#2563eb' : '#e5e7eb', color: activeTab === 'summary' ? 'white' : '#4b5563', border: 'none', fontWeight: 'bold' }}>Summary</button>
        <button onClick={() => setActiveTab('imports')} style={{ flex: 1, padding: '12px', borderRadius: '12px', backgroundColor: activeTab === 'imports' ? '#2563eb' : '#e5e7eb', color: activeTab === 'imports' ? 'white' : '#4b5563', border: 'none', fontWeight: 'bold' }}>Imports</button>
      </div>

      {activeTab === 'summary' ? (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '15px' }}>Expense Details</h3>
          {categories.map(cat => (
            <div key={cat} style={{ borderBottom: '1px solid #f3f4f6', padding: '12px 0' }}>
              <div onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                <span>{cat}</span>
                <span style={{ fontWeight: 'bold' }}>${getCategoryTotal(cat).toFixed(2)}</span>
              </div>
              {expandedCategory === cat && (
                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                  {expenses.filter(e => e.category === cat).map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span>{item.item_name}</span>
                      <span>${Number(item.cost).toFixed(2)}</span>
                    </div>
                  ))}
                  {expenses.filter(e => e.category === cat).length === 0 && <p style={{ fontSize: '12px', color: '#9ca3af' }}>No entries found.</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Import Platform Data</h3>
          <input type="file" accept=".csv" style={{ marginBottom: '10px', width: '100%' }} />
          <p style={{ fontSize: '12px', color: '#6b7280' }}>Select a CSV from TCGplayer or eBay to sync your sales data.</p>
          <button style={{ width: '100%', marginTop: '15px', padding: '12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}>Process File</button>
        </div>
      )}
    </div>
  )
}
