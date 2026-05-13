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
  const [editingItem, setEditingItem] = useState<{table: string} | null>(null) 
  const [isUploading, setIsUploading] = useState(false)

  const [formData, setFormData] = useState({ 
    label: '', amount: '', date: new Date().toISOString().split('T')[0],
    fees: '', shipping: '', notes: '', itemCount: '', file: null as string | null 
  })

  // --- 2. DATA ARCHITECTURE ---
  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [buyouts, setBuyouts] = useState<any[]>([])
  const [payroll, setPayroll] = useState<any[]>([])
  const [disbursements, setDisbursements] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    const [sRes, eRes, bRes, payRes, dRes] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('buyouts').select('*').order('due_date', { ascending: false }),
      supabase.from('payroll').select('*'),
      supabase.from('disbursements').select('*')
    ]);

    const filterByDate = (data: any[] | null, key: string) => data?.filter(i => {
      const dateVal = i[key] || i.sale_date || i.purchase_date || i.due_date || i.pay_date || i.disbursement_date;
      const d = new Date(dateVal);
      return d.getFullYear() === selectedYear && (selectedMonth === 0 || (d.getMonth() + 1) === selectedMonth);
    }) || [];

    setSales(filterByDate(sRes.data, 'sale_date'));
    setExpenses(filterByDate(eRes.data, 'purchase_date'));
    setBuyouts(filterByDate(bRes.data, 'due_date'));
    setPayroll(filterByDate(payRes.data, 'pay_date'));
    setDisbursements(filterByDate(dRes.data, 'disbursement_date'));
  }, [selectedYear, selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- 3. CORE ACTIONS ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('documents').upload(fileName, file);
    if (!error) setFormData(prev => ({ ...prev, file: fileName }));
    setIsUploading(false);
  };

  const handleSave = async () => {
    if (!formData.amount || !formData.label || !editingItem) return alert("Required fields missing.");
    const table = editingItem.table;
    
    // Helper to safely parse numbers and avoid TypeScript string/number errors
    const safeParse = (val: string) => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    const buyoutNotes = formData.itemCount ? `Count: ${formData.itemCount} | ${formData.notes}` : formData.notes;

    const payloadMappings: Record<string, any> = {
      sales: { platform: formData.label, amount: safeParse(formData.amount), fees: safeParse(formData.fees), shipping: safeParse(formData.shipping), sale_date: formData.date, attachment_url: formData.file },
      buyouts: { seller_name: formData.label, total_cost: safeParse(formData.amount), notes: buyoutNotes, due_date: formData.date, attachment_url: formData.file },
      expenses: { category: formData.label, cost: safeParse(formData.amount), purchase_date: formData.date, attachment_url: formData.file },
      payroll: { employee_name: formData.label, amount: safeParse(formData.amount), pay_date: formData.date, status: 'paid' },
      disbursements: { recipient: formData.label, amount: safeParse(formData.amount), notes: formData.notes, disbursement_date: formData.date }
    };

    const { error } = await supabase.from(table).insert([payloadMappings[table]]);
    
    if (error) {
      alert(`Database Error: ${error.message}`);
    } else { 
      setEditingItem(null); 
      setFormData({ label: '', amount: '', date: new Date().toISOString().split('T')[0], fees: '', shipping: '', notes: '', itemCount: '', file: null }); 
      fetchData(); 
    }
  };

  // --- 4. ACCOUNTING ENGINE ---
  const grossRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalFees = sales.reduce((sum, s) => sum + Number(s.fees || 0) + Number(s.shipping || 0), 0);
  const directExpenses = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const totalBuyouts = buyouts.reduce((sum, b) => sum + Number(b.total_cost), 0);
  const totalPayroll = payroll.reduce((sum, p) => sum + Number(p.amount), 0);
  
  const totalExpenses = directExpenses + totalBuyouts + totalPayroll + totalFees;
  const netRevenue = grossRevenue - totalExpenses;
  
  const fontStack = 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif';

  return (
    <div style={{ fontFamily: fontStack, backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '140px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
        
        <header style={{ marginBottom: '25px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>MANA SOCIAL LLC</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid #cbd5e1', fontWeight: '900', fontFamily: fontStack }}><option value={2026}>2026</option></select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 2, padding: '12px', borderRadius: '12px', border: '2px solid #cbd5e1', fontFamily: fontStack }}><option value={0}>Full Year Ledger</option>{Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>)}</select>
          </div>
        </header>

        <main>
          {editingItem ? (
            <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
               <h2 style={{ fontWeight: '900', marginBottom: '20px', color: '#1e293b' }}>ADD {editingItem.table.toUpperCase()}</h2>
               <div style={{ display: 'grid', gap: '15px' }}>
                  <input type="text" placeholder={editingItem.table === 'disbursements' ? 'Recipient Name' : 'Source / Platform / Entity'} value={formData.label} onChange={(e) => setFormData({...formData, label: e.target.value})} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                  <input type="number" placeholder="Total Amount ($)" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                  
                  {editingItem.table === 'sales' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input type="number" placeholder="Fees ($)" value={formData.fees} onChange={(e) => setFormData({...formData, fees: e.target.value})} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                        <input type="number" placeholder="Shipping ($)" value={formData.shipping} onChange={(e) => setFormData({...formData, shipping: e.target.value})} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                    </div>
                  )}

                  {editingItem.table === 'buyouts' && (
                    <input type="number" placeholder="Item Count (Total Cards)" value={formData.itemCount} onChange={(e) => setFormData({...formData, itemCount: e.target.value})} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                  )}

                  <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack }} />
                  
                  {['buyouts', 'disbursements'].includes(editingItem.table) && (
                    <textarea placeholder="Internal Notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #cbd5e1', fontFamily: fontStack, height: '80px' }} />
                  )}

                  {editingItem.table !== 'disbursements' && editingItem.table !== 'payroll' && (
                    <div style={{ border: '2px dashed #cbd5e1', padding: '15px', borderRadius: '12px', textAlign: 'center', position: 'relative' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>{isUploading ? 'UPLOADING...' : formData.file ? '✅ ATTACHED' : '📷 UPLOAD FILE / PHOTO'}</span>
                      <input type="file" accept="image/*,application/pdf" capture="environment" onChange={handleFileUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                    </div>
                  )}

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
                        <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.6 }}>EXPENSES</div>
                        <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#fda4af' }}>-${totalExpenses.toLocaleString()}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.6 }}>NET REVENUE</div>
                        <div style={{ fontSize: '38px', fontWeight: '900', color: '#4ade80' }}>${netRevenue.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'income' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px' }}>REVENUE LEDGER</h3>
                  {sales.map(s => (
                    <div key={s.id} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '16px', marginBottom: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                      <div><strong>{s.platform}</strong> {s.attachment_url && '📎'}</div>
                      <div style={{ fontWeight: '900', color: '#10b981' }}>+${Number(s.amount).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'expense' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px' }}>EXPENSE & BUYOUT LEDGER</h3>
                  {expenses.map(e => (
                    <div key={e.id} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '16px', marginBottom: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                      <div><strong>{e.category}</strong> {e.attachment_url && '📎'}</div>
                      <div style={{ fontWeight: '900', color: '#fda4af' }}>-${Number(e.cost).toLocaleString()}</div>
                    </div>
                  ))}
                  {buyouts.map(b => (
                    <div key={b.id} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '16px', marginBottom: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                      <div><strong>{b.seller_name}</strong> (Buyout) {b.attachment_url && '📎'}</div>
                      <div style={{ fontWeight: '900', color: '#fda4af' }}>-${Number(b.total_cost).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'disburse' && (
                <div>
                   <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px' }}>OWNER DISBURSEMENTS</h3>
                   {disbursements.map(d => (
                    <div key={d.id} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '16px', marginBottom: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: '900' }}>{d.recipient}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{d.disbursement_date}</div>
                      </div>
                      <span style={{ fontWeight: '900', color: '#0f172a' }}>${Number(d.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'payroll' && (
                <div>
                   <h3 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px' }}>STAFF & PAYROLL LEDGER</h3>
                   {payroll.map(p => (
                    <div key={p.id} style={{ backgroundColor: '#fff', padding: '18px', borderRadius: '16px', marginBottom: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{p.employee_name}</strong><span style={{ fontWeight: '900', color: '#0f172a' }}>${Number(p.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        <button style={{ position: 'fixed', bottom: '125px', right: '25px', width: '70px', height: '70px', borderRadius: '35px', backgroundColor: '#4f46e5', color: '#fff', border: '4px solid #fff', fontSize: '40px', fontWeight: 'bold', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 500 }} onClick={() => setIsQuickAddOpen(true)}>+</button>

        {isQuickAddOpen && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#fff', width: '100%', borderRadius: '28px', padding: '30px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '20px', color: '#0f172a' }}>MANA OPERATIONS</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button onClick={() => { setEditingItem({ table: 'sales' }); setIsQuickAddOpen(false); }} style={{ padding: '20px', borderRadius: '15px', border: '2px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '900', fontFamily: fontStack }}>+ SALE</button>
                <button onClick={() => { setEditingItem({ table: 'buyouts' }); setIsQuickAddOpen(false); }} style={{ padding: '20px', borderRadius: '15px', border: '2px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '900', fontFamily: fontStack }}>+ BUYOUT</button>
                <button onClick={() => { setEditingItem({ table: 'expenses' }); setIsQuickAddOpen(false); }} style={{ padding: '20px', borderRadius: '15px', border: '2px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '900', fontFamily: fontStack }}>+ EXPENSE</button>
                <button onClick={() => { setEditingItem({ table: 'payroll' }); setIsQuickAddOpen(false); }} style={{ padding: '20px', borderRadius: '15px', border: '2px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '900', fontFamily: fontStack }}>+ PAYROLL</button>
                <button onClick={() => { setEditingItem({ table: 'disbursements' }); setIsQuickAddOpen(false); }} style={{ padding: '20px', borderRadius: '15px', border: '2px solid #e2e8f0', backgroundColor: '#f0fdf4', color: '#166534', fontWeight: '900', fontFamily: fontStack, gridColumn: 'span 2' }}>+ DISBURSEMENT</button>
              </div>
              <button onClick={() => setIsQuickAddOpen(false)} style={{ width: '100%', marginTop: '20px', padding: '10px', border: 'none', background: 'none', color: '#64748b', fontWeight: 'bold', fontFamily: fontStack }}>CANCEL</button>
            </div>
          </div>
        )}

        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '3px solid #e2e8f0', display: 'flex', height: '110px', zIndex: 400 }}>
          {['summary', 'income', 'expense', 'disburse', 'payroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, border: 'none', backgroundColor: activeTab === tab ? '#f0f4ff' : 'white', borderTop: activeTab === tab ? '8px solid #4f46e5' : '8px solid white', color: activeTab === tab ? '#4f46e5' : '#94a3b8', fontWeight: '900', fontSize: '10px', letterSpacing: '0.05em', fontFamily: fontStack }}>{tab.toUpperCase()}</button>
          ))}
        </nav>
      </div>
    </div>
  )
}
