'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ManaSocialMasterApp() {
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(0)
  const [editingItem, setEditingItem] = useState(null)

  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [buyouts, setBuyouts] = useState([])
  const [payments, setPayments] = useState([])

  const fetchData = useCallback(async () => {
    const [sRes, eRes, bRes, pRes] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('buyouts').select('*').order('due_date', { ascending: false }),
      supabase.from('payments').select('*') 
    ]);

    // Helper for folder filtering
    const filterByDate = (data, key) => data?.filter(i => {
      const d = new Date(i[key]);
      const yMatch = d.getFullYear() === selectedYear;
      const mMatch = selectedMonth === 0 || (d.getMonth() + 1) === selectedMonth;
      return yMatch && mMatch;
    }) || [];

    setSales(filterByDate(sRes.data, 'sale_date'));
    setExpenses(filterByDate(eRes.data, 'purchase_date'));
    setBuyouts(filterByDate(bRes.data, 'due_date'));
    setPayments(pRes.data || []);
  }, [selectedYear, selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- ACCOUNTING ENGINE ---
  
  // 1. Calculate Buyout Balances (Total Cost - All Payments Ever)
  const buyoutsWithStatus = buyouts.map(b => {
    const totalPaidAllTime = payments
      .filter(p => p.parent_id === b.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    return { 
      ...b, 
      remaining: Number(b.total_cost) - totalPaidAllTime,
      percentPaid: (totalPaidAllTime / Number(b.total_cost)) * 100
    };
  });

  // 2. Realize Monthly Cash Outflow (Direct Expenses + Payments made THIS month)
  const monthlyPaymentsOut = payments.filter(p => {
    const d = new Date(p.paid_date);
    return d.getFullYear() === selectedYear && (selectedMonth === 0 || (d.getMonth() + 1) === selectedMonth);
  }).reduce((sum, p) => sum + Number(p.amount), 0);

  const revenue = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const directExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const totalLiabilities = buyoutsWithStatus.reduce((sum, b) => sum + b.remaining, 0);

  return (
    <div style={{ fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '120px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
        
        {/* HEADER */}
        <header style={{ marginBottom: '25px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0 }}>MANA SOCIAL LLC</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid #cbd5e1', fontWeight: '900' }}>
              <option value={2026}>2026</option>
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 2, padding: '12px', borderRadius: '12px', border: '2px solid #cbd5e1' }}>
              <option value={0}>Full Year</option>
              {Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>)}
            </select>
          </div>
        </header>

        {/* SUMMARY TAB - SHOWS CASH POSITION */}
        {activeTab === 'summary' && (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '20px', color: '#fff' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.7 }}>NET CASH FLOW ({selectedMonth === 0 ? 'YTD' : 'MTD'})</div>
              <div style={{ fontSize: '36px', fontWeight: '900' }}>${(revenue - directExp - monthlyPaymentsOut).toLocaleString()}</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '20px', borderLeft: '8px solid #f59e0b', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold' }}>TOTAL OUTSTANDING LIABILITIES</div>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#92400e' }}>${totalLiabilities.toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* EXPENSE TAB - VENDOR LEDGER */}
        {activeTab === 'expense' && (
          <div>
             <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px' }}>VENDOR LEDGER (BY TRANSACTION)</h3>
             {buyoutsWithStatus.map(b => (
               <div key={b.id} onClick={() => setEditingItem({table: 'buyouts', ...b})} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '16px', marginBottom: '12px', border: '1px solid #e2e8f0', borderLeft: b.remaining > 0 ? '6px solid #f59e0b' : '6px solid #10b981' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                   <div>
                     <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>ID: BO-{b.id.toString().slice(-4)}</div>
                     <div style={{ fontWeight: '900', fontSize: '16px' }}>{b.seller_name}</div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                     <div style={{ fontWeight: '900', color: b.remaining > 0 ? '#b45309' : '#10b981' }}>${b.remaining.toLocaleString()}</div>
                     <div style={{ fontSize: '10px' }}>{b.remaining > 0 ? 'OWED' : 'PAID'}</div>
                   </div>
                 </div>
                 <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
                    <div style={{ width: `${b.percentPaid}%`, height: '100%', backgroundColor: b.remaining > 0 ? '#f59e0b' : '#10b981' }}></div>
                 </div>
               </div>
             ))}
          </div>
        )}

        {/* NAVIGATION - 90px HEIGHT */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '2px solid #e2e8f0', display: 'flex', height: '90px', zIndex: 100 }}>
          {['summary', 'income', 'expense', 'payroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} 
              style={{ flex: 1, border: activeTab === tab ? '4px solid #4f46e5' : '1px solid #fff', backgroundColor: activeTab === tab ? '#f0f4ff' : 'white', color: activeTab === tab ? '#4f46e5' : '#94a3b8', fontWeight: '900', fontSize: '11px' }}>
              {tab.toUpperCase()}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
