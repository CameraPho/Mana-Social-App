'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMonth, setSelectedMonth] = useState(4); 
  const [expenses, setExpenses] = useState([]);
  const [savedSales, setSavedSales] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');

  const fetchData = async () => {
    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth;
    const dateQuery = `2026-${monthStr}`;

    const { data: expData } = await supabase.from('expenses').select('*').like('purchase_date', `%${dateQuery}%`);
    if (expData) setExpenses(expData);

    const { data: saleData } = await supabase.from('sales').select('*').like('sale_date', `%${dateQuery}%`);
    if (saleData) setSavedSales(saleData);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]);

  // Calculations for Tax Tab
  const totalSales = savedSales.reduce((s, i) => s + Number(i.amount), 0);
  const totalExp = expenses.reduce((s, i) => s + Number(i.cost), 0);
  const netProfit = totalSales - totalExp;

  // Estimated Federal Self-Employment Tax (Approx 15.3%)
  const estFederal = netProfit > 0 ? netProfit * 0.153 : 0;
  // Estimated CA State Tax (Approx 1% for low brackets or minimum LLC franchise fee considerations)
  const estState = netProfit > 0 ? netProfit * 0.01 : 0;

  const cardStyle = { backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '16px' }}>
      
      {/* Brand Header */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '800', fontSize: '20px', color: '#0f172a' }}>MANA SOCIAL</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '16px', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '5px' }}>
        {['summary', 'analytics', 'upload', 'taxes', 'income', 'expense'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '10px 15px', borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Taxes Tab */}
      {activeTab === 'taxes' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '15px' }}>Tax Estimates (Current Month)</h3>
          
          <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', color: '#475569' }}>Federal (Est. SE Tax)</span>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>${estFederal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#475569' }}>California (Est. State)</span>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>${estState.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Tax Reminders</h4>
            <ul style={{ fontSize: '12px', color: '#475569', paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>CA Franchise Tax Board: Minimum $800 annual tax (if applicable).</li>
              <li>Quarterly Federal Estimates: Due April, June, Sept, Jan.</li>
              <li>Keep all receipts for Ultra PRO and shipping supplies.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Profit/Loss Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Total Revenue</span>
            <span style={{ fontWeight: '700', color: '#2563eb' }}>${totalSales.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span>Total Expenses</span>
            <span style={{ fontWeight: '700', color: '#ef4444' }}>-${totalExp.toLocaleString()}</span>
          </div>
          <div style={{ padding: '15px', borderRadius: '12px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '800' }}>Net Profit</span>
            <span style={{ fontWeight: '800', color: '#166534' }}>${netProfit.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Logic for other tabs remains consistent... */}
    </div>
  )
}
