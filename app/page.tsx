'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ManaSocialApp() {
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(0)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<{table: string} | null>(null)
  
  const [formData, setFormData] = useState({ 
    label: '', amount: '', date: new Date().toISOString().split('T')[0],
    fees: '', shipping: '', notes: '', itemCount: ''
  })

  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [buyouts, setBuyouts] = useState<any[]>([])
  const [payroll, setPayroll] = useState<any[]>([])
  const [disbursements, setDisbursements] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    const [s, e, b, p, d] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('buyouts').select('*'),
      supabase.from('payroll').select('*'),
      supabase.from('disbursements').select('*')
    ])

    const filterByDate = (data: any[], key: string) => data?.filter(i => {
      const dDate = new Date(i[key]);
      return dDate.getFullYear() === selectedYear && (selectedMonth === 0 || (dDate.getMonth() + 1) === selectedMonth);
    }) || []

    setSales(filterByDate(s.data || [], 'sale_date'))
    setExpenses(filterByDate(e.data || [], 'purchase_date'))
    setBuyouts(filterByDate(b.data || [], 'due_date'))
    setPayroll(filterByDate(p.data || [], 'pay_date'))
    setDisbursements(filterByDate(d.data || [], 'disbursement_date'))
  }, [selectedYear, selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    if (!formData.amount || !formData.label || !editingItem) return alert("Missing fields")
    
    const table = editingItem.table
    let payload: any = {}

    if (table === 'sales') {
      payload = { platform: formData.label, amount: Number(formData.amount), fees: Number(formData.fees || 0), shipping: Number(formData.shipping || 0), sale_date: formData.date }
    } else if (table === 'buyouts') {
      payload = { seller_name: formData.label, total_cost: Number(formData.amount), notes: `Qty: ${formData.itemCount} | ${formData.notes}`, due_date: formData.date }
    } else if (table === 'expenses') {
      payload = { category: formData.label, cost: Number(formData.amount), purchase_date: formData.date }
    } else if (table === 'payroll') {
      payload = { employee_name: formData.label, amount: Number(formData.amount), pay_date: formData.date }
    } else if (table === 'disbursements') {
      payload = { recipient: formData.label, amount: Number(formData.amount), notes: formData.notes, disbursement_date: formData.date }
    }

    const { error } = await supabase.from(table).insert([payload])
    if (error) alert(error.message)
    else {
      setEditingItem(null)
      setFormData({ label: '', amount: '', date: new Date().toISOString().split('T')[0], fees: '', shipping: '', notes: '', itemCount: '' })
      fetchData()
    }
  }

  // CALCULATION LOGIC
  const gross = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const totalFees = sales.reduce((sum, s) => sum + Number(s.fees || 0) + Number(s.shipping || 0), 0)
  const opExpenses = expenses.reduce((sum, e) => sum + Number(e.cost), 0)
  const inventoryCosts = buyouts.reduce((sum, b) => sum + Number(b.total_cost), 0)
  const staffingCosts = payroll.reduce((sum, p) => sum + Number(p.amount), 0)

  const totalCosts = totalFees + opExpenses + inventoryCosts + staffingCosts
  const netRevenue = gross - totalCosts

  const font = 'Calibri, sans-serif'

  return (
    <div style={{ fontFamily: font, backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '140px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
        <header style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px' }}>MANA SOCIAL LLC</h1>
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: 'bold' }}><option value={2026}>2026</option></select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontWeight: 'bold' }}><option value={0}>Full Year Ledger</option>{Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>)}</select>
          </div>
        </header>

        {editingItem ? (
          <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontWeight: '900', marginBottom: '20px' }}>ADD {editingItem.table.toUpperCase()}</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              <input placeholder="Source / Name" value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd' }} />
              <input type="number" placeholder="Total Amount ($)" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd' }} />
              {editingItem.table === 'sales' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="number" placeholder="Fees" value={formData.fees} onChange={e => setFormData({...formData, fees: e.target.value})} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd' }} />
                  <input type="number" placeholder="Shipping" value={formData.shipping} onChange={e => setFormData({...formData, shipping: e.target.value})} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd' }} />
                </div>
              )}
              {editingItem.table === 'buyouts' && (
                <input type="number" placeholder="Card Count" value={formData.itemCount} onChange={e => setFormData({...formData, itemCount: e.target.value})} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd' }} />
              )}
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd' }} />
              <textarea placeholder="Internal Notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #ddd', height: '80px' }} />
              <button onClick={handleSave} style={{ backgroundColor: '#4f46e5', color: '#fff', padding: '20px', borderRadius: '12px', fontWeight: '900', border: 'none', marginTop: '10px' }}>SAVE RECORD</button>
              <button onClick={() => setEditingItem(null)} style={{ color: '#64748b', border: 'none', background: 'none', fontWeight: 'bold' }}>CANCEL</button>
            </div>
          </div>
        ) : (
          <main>
            {activeTab === 'summary' && (
              <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '30px', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>GROSS REVENUE</div>
                <div style={{ fontSize: '32px', fontWeight: '900', marginBottom: '20px' }}>+${gross.toLocaleString()}</div>
                <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: '20px' }} />
                <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL COSTS</div>
                <div style={{ fontSize: '32px', fontWeight: '900', color: '#fda4af', marginBottom: '20px' }}>-${totalCosts.toLocaleString()}</div>
                <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: '20px' }} />
                <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>NET REVENUE</div>
                <div style={{ fontSize: '48px', fontWeight: '900', color: '#4ade80' }}>${netRevenue.toLocaleString()}</div>
              </div>
            )}
            
            <div style={{ marginTop: '20px' }}>
              {activeTab === 'income' && sales.map(s => <div key={s.id} style={{ background: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}><span>{s.platform}</span><b style={{color: '#10b981'}}>${Number(s.amount).toLocaleString()}</b></div>)}
              {activeTab === 'expense' && (
                <>
                  {expenses.map(e => <div key={e.id} style={{ background: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}><span>{e.category}</span><b style={{color: '#ef4444'}}>-${Number(e.cost).toLocaleString()}</b></div>)}
                  {buyouts.map(b => <div key={b.id} style={{ background: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}><span>{b.seller_name} (Buyout)</span><b style={{color: '#ef4444'}}>-${Number(b.total_cost).toLocaleString()}</b></div>)}
                </>
              )}
              {activeTab === 'tax' && disbursements.map(d => <div key={d.id} style={{ background: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}><span>{d.recipient}</span><b>${Number(d.amount).toLocaleString()}</b></div>)}
              {activeTab === 'payroll' && payroll.map(p => <div key={p.id} style={{ background: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}><span>{p.employee_name}</span><b>${Number(p.amount).toLocaleString()}</b></div>)}
            </div>
          </main>
        )}

        <button onClick={() => setIsQuickAddOpen(true)} style={{ position: 'fixed', bottom: '130px', right: '25px', width: '70px', height: '70px', borderRadius: '35px', backgroundColor: '#4f46e5', color: '#fff', fontSize: '35px', border: '4px solid #fff', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', zIndex: 500 }}>+</button>

        {isQuickAddOpen && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', display: 'flex', alignItems: 'center', padding: '20px', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#fff', width: '100%', borderRadius: '24px', padding: '25px' }}>
              <h2 style={{ fontWeight: '900', marginBottom: '20px' }}>OPERATIONS</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button onClick={() => { setEditingItem({table: 'sales'}); setIsQuickAddOpen(false); }} style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>+ SALE</button>
                <button onClick={() => { setEditingItem({table: 'buyouts'}); setIsQuickAddOpen(false); }} style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>+ BUYOUT</button>
                <button onClick={() => { setEditingItem({table: 'expenses'}); setIsQuickAddOpen(false); }} style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>+ EXPENSE</button>
                <button onClick={() => { setEditingItem({table: 'payroll'}); setIsQuickAddOpen(false); }} style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>+ PAYROLL</button>
                <button onClick={() => { setEditingItem({table: 'disbursements'}); setIsQuickAddOpen(false); }} style={{ gridColumn: 'span 2', padding: '20px', borderRadius: '12px', border: '2px solid #10b981', color: '#10b981', fontWeight: '900' }}>+ OWNER DRAW</button>
              </div>
              <button onClick={() => setIsQuickAddOpen(false)} style={{ width: '100%', marginTop: '20px', border: 'none', background: 'none', color: '#64748b', fontWeight: 'bold' }}>CANCEL</button>
            </div>
          </div>
        )}

        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '110px', backgroundColor: '#fff', borderTop: '2px solid #e2e8f0', display: 'flex', zIndex: 400 }}>
          {['summary', 'income', 'expense', 'tax', 'payroll'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, border: 'none', background: 'none', fontSize: '10px', fontWeight: '900', color: activeTab === t ? '#4f46e5' : '#94a3b8' }}>{t.toUpperCase()}</button>
          ))}
        </nav>
      </div>
    </div>
  )
}
