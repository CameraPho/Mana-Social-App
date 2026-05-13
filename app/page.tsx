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
  const [isUploading, setIsUploading] = useState(false)

  const [formData, setFormData] = useState({ 
    label: '', amount: '', date: new Date().toISOString().split('T')[0],
    fees: '', shipping: '', notes: '', itemCount: '', file: null 
  })

  // --- 2. DATA ARCHITECTURE ---
  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [buyouts, setBuyouts] = useState([])
  const [payroll, setPayroll] = useState([])
  const [payments, setPayments] = useState([])

  const fetchData = useCallback(async () => {
    const [sRes, eRes, bRes, payRes, pRes] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('buyouts').select('*').order('due_date', { ascending: false }),
      supabase.from('payroll').select('*'),
      supabase.from('payments').select('*') 
    ]);

    const filterByDate = (data, key) => data?.filter(i => {
      const d = new Date(i[key] || i.sale_date || i.purchase_date || i.due_date || i.pay_date);
      return d.getFullYear() === selectedYear && (selectedMonth === 0 || (d.getMonth() + 1) === selectedMonth);
    }) || [];

    setSales(filterByDate(sRes.data, 'sale_date'));
    setExpenses(filterByDate(eRes.data, 'purchase_date'));
    setBuyouts(filterByDate(bRes.data, 'due_date'));
    setPayroll(filterByDate(payRes.data, 'pay_date'));
    setPayments(pRes.data || []);
  }, [selectedYear, selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- 3. CORE ACTIONS (Fixed for TypeScript Deployment) ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('documents').upload(fileName, file);
    if (!error) setFormData({ ...formData, file: fileName });
    setIsUploading(false);
  };

  const handleSave = async () => {
    if (!formData.amount || !formData.label) return alert("Required fields missing.");
    const table = editingItem.table;
    
    // SURGICAL FIX: parseFloat now receives strings only to satisfy the build compiler
    const payload = {
      sales: { 
        platform: formData.label, 
        amount: parseFloat(formData.amount || '0'), 
        fees: parseFloat(formData.fees || '0'), 
        shipping: parseFloat(formData.shipping || '0'), 
        sale_date: formData.date, 
        attachment_url: formData.file 
      },
      buyouts: { 
        seller_name: formData.label, 
        total_cost: parseFloat(formData.amount || '0'), 
        notes: `Count: ${formData.itemCount} | ${formData.notes}`, 
        due_date: formData.date, 
        attachment_url: formData.file 
      },
      expenses: { 
        category: formData.label, 
        cost: parseFloat(formData.amount || '0'), 
        purchase_date: formData.date, 
        attachment_url: formData.file 
      },
      payroll: { 
        employee_name: formData.label, 
        amount: parseFloat(formData.amount || '0'), 
        pay_date: formData.date, 
        status: 'paid' 
      }
    }[table];

    const { error } = await supabase.from(table).insert([payload]);
    if (error) alert(error.message);
    else { 
      setEditingItem(null); 
      setFormData({ label: '', amount: '', date: new Date().toISOString().split('T')[0], fees: '', shipping: '', notes: '', itemCount: '', file: null }); 
      fetchData(); 
    }
  };

  // --- 4. ACCOUNTING ENGINE ---
  const grossRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalFees = sales.reduce((sum, s) => sum + Number(s.fees || 0) + Number(s.shipping || 0), 0);
  const directExpenses = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const totalPayroll = payroll.reduce((sum, p) => sum + Number(p.amount), 0);
  const netCashFlow = grossRevenue - (directExpenses + totalPayroll + totalFees);
  
  const fontStack = 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif';

  return (
    <div style={{ fontFamily: fontStack, backgroundColor: '#f1f5f9', minHeight: '100vh', paddingBottom: '140px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
        
        <header style={{ marginBottom: '25px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a' }}>MANA SOCIAL PRO</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontWeight: '900', fontFamily: fontStack }}><option value={2026}>2026</option></select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 2, padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontFamily: fontStack }}><option value={0}>Full Year View</option>{Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>)}</select>
          </div>
        </header>

        <main>
          {editingItem ? (
            <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
               <h2 style={{ fontWeight: '900', marginBottom: '20px' }}>{editingItem.table.toUpperCase()} ENTRY</h2>
               <div style={{ display: 'grid', gap: '12px' }}>
                  <input type="text" placeholder="Entity / Name" value={formData.label} onChange={(e) => setFormData({...formData, label: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                  <input type="number" placeholder="Gross Amount ($)" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                  
                  {editingItem.table === 'sales' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input type="number" placeholder="Fees ($)" value={formData.fees} onChange={(e) => setFormData({...formData, fees: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                        <input type="number" placeholder="Shipping ($)" value={formData.shipping} onChange={(e) => setFormData({...formData, shipping: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                    </div>
                  )}

                  {editingItem.table === 'buyouts' && (
                    <input type="number" placeholder="Item Count (Total Cards)" value={formData.itemCount} onChange={(e) => setFormData({...formData, itemCount: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                  )}

                  <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                  <textarea placeholder="Internal Notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack, height: '80px' }} />

                  <div style={{ border: '2px dashed #cbd5e1', padding: '15px', borderRadius: '12px', textAlign: 'center', position: 'relative' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>{isUploading ? 'UPLOADING...' : formData.file ? '✅ ATTACHED' : '📷 UPLOAD RECEIPT / PHOTO'}</span>
                    <input type="file" accept="image/*,application/pdf" capture="environment" onChange={handleFileUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                  </div>

                  <button onClick={handleSave} style={{ backgroundColor: '#0f172a', color: '#fff', padding: '18px', borderRadius: '14px', border: 'none', fontWeight: '900', fontSize: '16px', marginTop: '10px' }}>POST TO LEDGER</button>
                  <button onClick={() => setEditingItem(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 'bold' }}>DISCARD</button>
               </div>
            </div>
          ) : (
            <>
              {activeTab === 'summary' && (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ backgroundColor: '#0f172a', padding: '30px', borderRadius: '24px', color: '#fff' }}>
                    <div style={{ opacity: 0.6, fontSize: '12px', fontWeight: '900' }}>NET BUSINESS VALUE</div>
                    <div style={{ fontSize: '42px', fontWeight: '900', color: '#4ade80' }}>${netCashFlow.toLocaleString()}</div>
                    <div style={{ marginTop: '20px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Gross: +${grossRevenue.toLocaleString()}</span>
                        <span style={{ color: '#fda4af' }}>Costs: -${(directExpenses + totalPayroll + totalFees).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'income' && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '15px' }}>REVENUE LEDGER</h3>
                  {sales.map(s => {
                    const net = s.amount - (s.fees || 0) - (s.shipping || 0);
                    const margin = (net / s.amount) * 100;
                    return (
                      <div key={s.id} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '16px', marginBottom: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontWeight: '900' }}>{s.platform} {s.attachment_url && '📎'}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Margin: {margin.toFixed(1)}%</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: '900', color: margin < 15 ? '#f59e0b' : '#10b981' }}>+${Number(s.amount).toLocaleString()}</div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>Net: ${net.toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'payroll' && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '15px' }}>STAFF & PAYROLL LEDGER</h3>
                  {payroll.map(p => (
                    <div key={p.id} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '16px', marginBottom: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                      <div><div style={{ fontWeight: '900' }}>{p.employee_name}</div><div style={{ fontSize: '11px', color: '#64748b' }}>{p.pay_date}</div></div>
                      <div style={{ fontWeight: '900', color: '#0f172a' }}>${Number(p.amount).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        <button style={{ position: 'fixed', bottom: '130px', right: '30px', width: '75px', height: '75px', borderRadius: '38px', backgroundColor: '#0f172a', color: '#fff', border: '4px solid #fff', fontSize: '42px', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', zIndex: 500 }} onClick={() => setIsQuickAddOpen(true)}>+</button>

        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '2px solid #e2e8f0', display: 'flex', height: '110px', zIndex: 400 }}>
          {['summary', 'income', 'expense', 'tax', 'payroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, border: 'none', backgroundColor: activeTab === tab ? '#f8fafc' : 'white', borderTop: activeTab === tab ? '8px solid #0f172a' : '8px solid white', color: activeTab === tab ? '#0f172a' : '#94a3b8', fontWeight: '900', fontSize: '12px', letterSpacing: '0.05em', fontFamily: fontStack }}>{tab.toUpperCase()}</button>
          ))}
        </nav>
      </div>
    </div>
  )
}
