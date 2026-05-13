'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ManaSocialMasterApp() {
  // --- 1. CORE SYSTEM STATE (Locked) ---
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(0)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  // --- 2. DATA ARCHITECTURE ---
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

    const filterByDate = (data, key) => data?.filter(i => {
      const d = new Date(i[key]);
      return d.getFullYear() === selectedYear && (selectedMonth === 0 || (d.getMonth() + 1) === selectedMonth);
    }) || [];

    setSales(filterByDate(sRes.data, 'sale_date'));
    setExpenses(filterByDate(eRes.data, 'purchase_date'));
    setBuyouts(filterByDate(bRes.data, 'due_date'));
    setPayments(pRes.data || []);
  }, [selectedYear, selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- 3. ACCOUNTING ENGINE (Surgical Update: Gross/Expense/Net) ---
  const buyoutsWithStatus = buyouts.map(b => {
    const totalPaidAllTime = payments.filter(p => p.parent_id === b.id).reduce((sum, p) => sum + Number(p.amount), 0);
    return { 
      ...b, 
      remaining: Number(b.total_cost) - totalPaidAllTime, 
      percentPaid: (totalPaidAllTime / Number(b.total_cost)) * 100 
    };
  });

  const monthlyPaymentsOut = payments.filter(p => {
    const d = new Date(p.paid_date);
    return d.getFullYear() === selectedYear && (selectedMonth === 0 || (d.getMonth() + 1) === selectedMonth);
  }).reduce((sum, p) => sum + Number(p.amount), 0);

  const grossRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const directExpenses = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const totalCashOut = directExpenses + monthlyPaymentsOut;
  const netCashFlow = grossRevenue - totalCashOut;
  
  const totalLiabilities = buyoutsWithStatus.reduce((sum, b) => sum + b.remaining, 0);
  const totalTaxCollected = sales.reduce((sum, s) => sum + (Number(s.tax) || 0), 0);

  // --- 4. MASTER RENDERER (Font locked to Calibri-style) ---
  const fontStack = 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif';

  return (
    <div style={{ fontFamily: fontStack, backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '120px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
        
        {/* HEADER BLOCK */}
        <header style={{ marginBottom: '25px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>MANA SOCIAL LLC</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid #cbd5e1', fontWeight: '900', backgroundColor: '#fff', fontFamily: fontStack }}>
              <option value={2026}>2026</option>
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 2, padding: '12px', borderRadius: '12px', border: '2px solid #cbd5e1', backgroundColor: '#fff', fontFamily: fontStack }}>
              <option value={0}>Full Year Ledger</option>
              {Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>)}
            </select>
          </div>
        </header>

        {/* DYNAMIC VIEWPORT */}
        <main>
          {activeTab === 'summary' && (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '20px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.7 }}>GROSS REVENUE</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>+${grossRevenue.toLocaleString()}</div>
                </div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.7 }}>TOTAL EXPENSES (PAID)</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fda4af' }}>-${totalCashOut.toLocaleString()}</div>
                </div>
                <div>
                    <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.7 }}>NET CASH FLOW</div>
                    <div style={{ fontSize: '36px', fontWeight: '900', color: '#4ade80' }}>${netCashFlow.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '20px', borderLeft: '8px solid #f59e0b', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold' }}>OUTSTANDING DEBT (LIABILITIES)</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#92400e' }}>${totalLiabilities.toLocaleString()}</div>
              </div>
            </div>
          )}

          {activeTab === 'income' && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px', color: '#334155' }}>REVENUE LEDGER</h3>
              {sales.map(s => (
                <div key={s.id} onClick={() => setEditingItem({table: 'sales', ...s})} style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '15px', marginBottom: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontWeight: '900', fontSize: '15px' }}>{s.platform}</div><div style={{ fontSize: '10px', color: '#64748b' }}>{s.sale_date}</div></div>
                  <span style={{ color: '#10b981', fontWeight: '900', fontSize: '18px' }}>+${Number(s.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'expense' && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px', color: '#334155' }}>BUSINESS EXPENSES & COLLECTIONS</h3>
              {/* General Expenses Section */}
              {expenses.map(e => (
                <div key={e.id} onClick={() => setEditingItem({table: 'expenses', ...e})} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '10px', border: '1px solid #e2e8f0', borderLeft: '6px solid #ef4444' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                     <div><div style={{ fontWeight: '900' }}>{e.category || 'General Expense'}</div><div style={{ fontSize: '10px', color: '#64748b' }}>{e.purchase_date}</div></div>
                     <div style={{ fontWeight: '900', color: '#ef4444' }}>-${Number(e.cost).toLocaleString()}</div>
                   </div>
                </div>
              ))}
              {/* Buyouts Section */}
              {buyoutsWithStatus.map(b => (
                <div key={b.id} onClick={() => setEditingItem({table: 'buyouts', ...b})} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '18px', marginBottom: '12px', border: '1px solid #e2e8f0', borderLeft: b.remaining > 0 ? '6px solid #f59e0b' : '6px solid #10b981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>REF: BO-{b.id.toString().slice(-4)}</div><div style={{ fontWeight: '900', fontSize: '16px' }}>{b.seller_name}</div></div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontWeight: '900', color: b.remaining > 0 ? '#b45309' : '#10b981', fontSize: '16px' }}>${b.remaining.toLocaleString()}</div><div style={{ fontSize: '10px', fontWeight: 'bold' }}>OWED</div></div>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}><div style={{ width: `${b.percentPaid}%`, height: '100%', backgroundColor: b.remaining > 0 ? '#f59e0b' : '#10b981', transition: 'width 0.5s ease' }}></div></div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tax' && (
            <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '20px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: '900', color: '#64748b', marginBottom: '10px' }}>ESTIMATED SALES TAX LIABILITY</div>
              <div style={{ fontSize: '42px', fontWeight: '900', color: '#4f46e5' }}>${totalTaxCollected.toLocaleString()}</div>
            </div>
          )}
        </main>

        {/* GLOBAL PLUS BUTTON (Locked) */}
        <button style={{ position: 'fixed', bottom: '110px', right: '25px', width: '65px', height: '65px', borderRadius: '35px', backgroundColor: '#4f46e5', color: '#fff', border: '4px solid #fff', fontSize: '36px', fontWeight: 'bold', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', zIndex: 500 }} onClick={() => setIsQuickAddOpen(true)}>+</button>

        {/* QUICK ADD MODAL (Fixed Button Functionality) */}
        {isQuickAddOpen && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#fff', width: '100%', borderRadius: '24px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '20px', color: '#0f172a' }}>ADD RECORD</h2>
              <div style={{ display: 'grid', gap: '10px' }}>
                <button onClick={() => { setEditingItem({ table: 'sales' }); setIsQuickAddOpen(false); }} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', backgroundColor: '#f1f5f9', fontWeight: '900', color: '#0f172a', fontFamily: fontStack }}>New Sale</button>
                <button onClick={() => { setEditingItem({ table: 'buyouts' }); setIsQuickAddOpen(false); }} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', backgroundColor: '#f1f5f9', fontWeight: '900', color: '#0f172a', fontFamily: fontStack }}>New Buyout</button>
                <button onClick={() => { setEditingItem({ table: 'expenses' }); setIsQuickAddOpen(false); }} style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', backgroundColor: '#f1f5f9', fontWeight: '900', color: '#0f172a', fontFamily: fontStack }}>New Expense</button>
              </div>
              <button onClick={() => setIsQuickAddOpen(false)} style={{ width: '100%', marginTop: '15px', padding: '10px', border: 'none', background: 'none', color: '#64748b', fontWeight: 'bold', fontFamily: fontStack }}>CLOSE</button>
            </div>
          </div>
        )}

        {/* NAVIGATION (Locked) */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '2px solid #e2e8f0', display: 'flex', height: '90px', zIndex: 400 }}>
          {['summary', 'income', 'expense', 'tax', 'payroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, border: activeTab === tab ? '4px solid #4f46e5' : '1px solid #fff', backgroundColor: activeTab === tab ? '#f0f4ff' : 'white', color: activeTab === tab ? '#4f46e5' : '#94a3b8', fontWeight: '900', fontSize: '10px', letterSpacing: '0.02em', fontFamily: fontStack }}>{tab.toUpperCase()}</button>
          ))}
        </nav>
      </div>
    </div>
  )
}
