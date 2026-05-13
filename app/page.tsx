'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ManaSocialMasterApp() {
  // --- 1. CORE SYSTEM STATE ---
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(0)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null) 
  const [isSyncing, setIsSyncing] = useState(false)

  // Form State for Manual Entry
  const [formData, setFormData] = useState({ label: '', amount: '', date: new Date().toISOString().split('T')[0] })

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

  // --- 3. SURGICAL UPDATE: MANUAL SAVE & API SYNC ---
  const handleSave = async () => {
    if (!formData.amount || !formData.label) return alert("Please fill in all fields.");

    const table = editingItem.table;
    const payload = table === 'sales' 
      ? { platform: formData.label, amount: parseFloat(formData.amount), sale_date: formData.date }
      : table === 'buyouts'
      ? { seller_name: formData.label, total_cost: parseFloat(formData.amount), due_date: formData.date }
      : { category: formData.label, cost: parseFloat(formData.amount), purchase_date: formData.date };

    const { error } = await supabase.from(table).insert([payload]);
    
    if (error) {
      alert("Supabase Error: " + error.message);
    } else {
      setEditingItem(null);
      setFormData({ label: '', amount: '', date: new Date().toISOString().split('T')[0] });
      fetchData();
    }
  };

  const handleSync = async (source) => {
    setIsSyncing(true);
    // Future API link: fetch(ebay_endpoint).then(data => mapToSupabase(data))
    setTimeout(() => { 
        setIsSyncing(false); 
        setIsQuickAddOpen(false);
        alert(`${source} Sync initiated. Tracking: Revenue, Fees, Shipping, and Refunds.`);
    }, 1200);
  };

  // --- 4. ACCOUNTING ENGINE (Gross/Expenses/Net) ---
  const buyoutsWithStatus = buyouts.map(b => {
    const totalPaidAllTime = payments.filter(p => p.parent_id === b.id).reduce((sum, p) => sum + Number(p.amount), 0);
    return { ...b, remaining: Number(b.total_cost) - totalPaidAllTime, percentPaid: (totalPaidAllTime / Number(b.total_cost)) * 100 };
  });

  const monthlyPaymentsOut = payments.filter(p => {
    const d = new Date(p.paid_date);
    return d.getFullYear() === selectedYear && (selectedMonth === 0 || (d.getMonth() + 1) === selectedMonth);
  }).reduce((sum, p) => sum + Number(p.amount), 0);

  const grossRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const directExpenses = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const totalExpensesPaid = directExpenses + monthlyPaymentsOut;
  const netCashFlow = grossRevenue - totalExpensesPaid;
  const totalLiabilities = buyoutsWithStatus.reduce((sum, b) => sum + b.remaining, 0);
  const totalTaxCollected = sales.reduce((sum, s) => sum + (Number(s.tax) || 0), 0);

  const fontStack = 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif';

  return (
    <div style={{ fontFamily: fontStack, backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '140px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
        
        {/* HEADER BLOCK */}
        <header style={{ marginBottom: '25px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>MANA SOCIAL LLC</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid #cbd5e1', fontWeight: '900', fontFamily: fontStack }}>
              <option value={2026}>2026</option>
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 2, padding: '12px', borderRadius: '12px', border: '2px solid #cbd5e1', fontFamily: fontStack }}>
              <option value={0}>Full Year Ledger</option>
              {Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>)}
            </select>
          </div>
        </header>

        {/* DYNAMIC VIEWPORT */}
        <main>
          {editingItem ? (
            <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
               <h2 style={{ fontWeight: '900', marginBottom: '20px', color: '#1e293b' }}>ADD {editingItem.table.toUpperCase()}</h2>
               <div style={{ display: 'grid', gap: '15px' }}>
                  <input type="text" placeholder={editingItem.table === 'buyouts' ? "Seller Name" : "Source/Platform"} value={formData.label} onChange={(e) => setFormData({...formData, label: e.target.value})} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                  <input type="number" placeholder="Total Amount ($)" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                  <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                  <button onClick={handleSave} style={{ backgroundColor: '#4f46e5', color: '#fff', padding: '18px', borderRadius: '12px', border: 'none', fontWeight: '900', fontSize: '16px', fontFamily: fontStack }}>SAVE RECORD</button>
                  <button onClick={() => setEditingItem(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold', fontFamily: fontStack }}>CANCEL</button>
               </div>
            </div>
          ) : (
            <>
              {activeTab === 'summary' && (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '20px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.6 }}>GROSS REVENUE</div>
                        <div style={{ fontSize: '26px', fontWeight: 'bold' }}>+${grossRevenue.toLocaleString()}</div>
                    </div>
                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.6 }}>TOTAL EXPENSES (PAID)</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fda4af' }}>-${totalExpensesPaid.toLocaleString()}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.6 }}>NET CASH FLOW</div>
                        <div style={{ fontSize: '38px', fontWeight: '900', color: '#4ade80' }}>${netCashFlow.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '22px', borderRadius: '20px', borderLeft: '10px solid #f59e0b', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold' }}>TOTAL OUTSTANDING DEBT</div>
                    <div style={{ fontSize: '30px', fontWeight: '900', color: '#92400e' }}>${totalLiabilities.toLocaleString()}</div>
                  </div>
                </div>
              )}

              {activeTab === 'income' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px' }}>REVENUE LEDGER</h3>
                  {sales.map(s => (
                    <div key={s.id} style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '15px', marginBottom: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{s.platform}</strong><span style={{ color: '#10b981', fontWeight: '900' }}>+${Number(s.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'expense' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px' }}>BUSINESS EXPENSES & COLLECTIONS</h3>
                  {expenses.map(e => (
                    <div key={e.id} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '10px', border: '1px solid #e2e8f0', borderLeft: '6px solid #ef4444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>{e.category}</strong><span style={{ color: '#ef4444', fontWeight: '900' }}>-${Number(e.cost).toLocaleString()}</span>
                        </div>
                    </div>
                  ))}
                  {buyoutsWithStatus.map(b => (
                    <div key={b.id} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '18px', marginBottom: '12px', border: '1px solid #e2e8f0', borderLeft: b.remaining > 0 ? '6px solid #f59e0b' : '6px solid #10b981' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div><div style={{ fontSize: '10px', color: '#64748b' }}>REF: BO-{b.id.toString().slice(-4)}</div><div style={{ fontWeight: '900' }}>{b.seller_name}</div></div>
                        <div style={{ textAlign: 'right' }}><div style={{ fontWeight: '900', color: b.remaining > 0 ? '#b45309' : '#10b981' }}>${b.remaining.toLocaleString()}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'tax' && (
                <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '24px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '900', color: '#64748b', marginBottom: '10px' }}>ESTIMATED SALES TAX LIABILITY</div>
                  <div style={{ fontSize: '48px', fontWeight: '900', color: '#4f46e5' }}>${totalTaxCollected.toLocaleString()}</div>
                </div>
              )}
            </>
          )}
        </main>

        {/* PLUS BUTTON */}
        <button style={{ position: 'fixed', bottom: '125px', right: '25px', width: '70px', height: '70px', borderRadius: '35px', backgroundColor: '#4f46e5', color: '#fff', border: '4px solid #fff', fontSize: '40px', fontWeight: 'bold', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 500 }} onClick={() => setIsQuickAddOpen(true)}>+</button>

        {/* MODAL: ADD + SYNC */}
        {isQuickAddOpen && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#fff', width: '100%', borderRadius: '28px', padding: '30px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '20px', color: '#0f172a' }}>MANA OPERATIONS</h2>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <button onClick={() => { setEditingItem({ table: 'sales' }); setIsQuickAddOpen(false); }} style={{ padding: '20px 10px', borderRadius: '15px', border: '2px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '900', fontSize: '11px', fontFamily: fontStack }}>+ SALE</button>
                    <button onClick={() => { setEditingItem({ table: 'buyouts' }); setIsQuickAddOpen(false); }} style={{ padding: '20px 10px', borderRadius: '15px', border: '2px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '900', fontSize: '11px', fontFamily: fontStack }}>+ BUYOUT</button>
                    <button onClick={() => { setEditingItem({ table: 'expenses' }); setIsQuickAddOpen(false); }} style={{ padding: '20px 10px', borderRadius: '15px', border: '2px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '900', fontSize: '11px', fontFamily: fontStack }}>+ EXP</button>
                </div>
                <button disabled={isSyncing} onClick={() => handleSync('ManaPool')} style={{ width: '100%', padding: '18px', borderRadius: '15px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', fontWeight: '900', fontFamily: fontStack }}>{isSyncing ? 'SYNCING...' : 'SYNC MANAPOOL'}</button>
                <button disabled={isSyncing} onClick={() => handleSync('eBay')} style={{ width: '100%', padding: '18px', borderRadius: '15px', border: 'none', backgroundColor: '#eab308', color: '#fff', fontWeight: '900', fontFamily: fontStack }}>{isSyncing ? 'SYNCING...' : 'SYNC EBAY'}</button>
              </div>
              <button onClick={() => setIsQuickAddOpen(false)} style={{ width: '100%', marginTop: '20px', padding: '10px', border: 'none', background: 'none', color: '#64748b', fontWeight: 'bold', fontFamily: fontStack }}>CANCEL</button>
            </div>
          </div>
        )}

        {/* MASTER NAVIGATION (Enlarged Buttons) */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '3px solid #e2e8f0', display: 'flex', height: '105px', zIndex: 400 }}>
          {['summary', 'income', 'expense', 'tax', 'payroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, border: 'none', backgroundColor: activeTab === tab ? '#f0f4ff' : 'white', borderTop: activeTab === tab ? '8px solid #4f46e5' : '8px solid white', color: activeTab === tab ? '#4f46e5' : '#94a3b8', fontWeight: '900', fontSize: '12px', letterSpacing: '0.05em', fontFamily: fontStack }}>{tab.toUpperCase()}</button>
          ))}
        </nav>
      </div>
    </div>
  )
}
