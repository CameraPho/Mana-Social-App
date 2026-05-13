'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ManaSocialMasterApp() {
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [activeForm, setActiveForm] = useState(null) // 'buyout', 'receipt', 'payroll', 'sale'
  const [userRole, setUserRole] = useState('partner')

  // Form States
  const [formData, setFormData] = useState({ name: '', amount: '', count: '', tax: '', date: new Date().toISOString().split('T')[0] })

  // Data States
  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [personalPayroll, setPersonalPayroll] = useState([])
  const [buyouts, setBuyouts] = useState([])

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email === 'camerapho@gmail.com') { setUserRole('owner') } // UPDATE THIS EMAIL

    const [sRes, eRes, pRes, bRes] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('personal_payroll').select('*'),
      supabase.from('buyouts').select('*')
    ])

    const filter = (data, dateKey) => {
      if (!data || data.length === 0) return []
      const year = 2026
      if (selectedMonth === 13) return data.filter(i => i[dateKey]?.includes(`${year}`))
      const m = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth
      return data.filter(i => i[dateKey]?.includes(`${year}-${m}`))
    }

    setSales(filter(sRes.data, 'sale_date'))
    setExpenses(filter(eRes.data, 'purchase_date'))
    setPersonalPayroll(filter(pRes.data, 'pay_date'))
    setBuyouts(filter(bRes.data, 'created_at'))
  }, [selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    if (activeForm === 'buyout') {
      await supabase.from('buyouts').insert([{ seller_name: formData.name, total_cost: formData.amount, item_count: formData.count }])
    } else if (activeForm === 'receipt') {
      await supabase.from('expenses').insert([{ item_name: formData.name, cost: formData.amount, purchase_date: formData.date }])
    } else if (activeForm === 'payroll') {
      await supabase.from('personal_payroll').insert([{ employer_name: formData.name, gross_pay: formData.amount, tax_withheld: formData.tax, pay_date: formData.date }])
    } else if (activeForm === 'sale') {
      await supabase.from('sales').insert([{ platform: 'Cash/Local', amount: formData.amount, sale_date: formData.date, notes: formData.name }])
    }
    setFormData({ name: '', amount: '', count: '', tax: '', date: new Date().toISOString().split('T')[0] })
    setActiveForm(null)
    setIsQuickAddOpen(false)
    fetchData()
  }

  // --- MATH ENGINE ---
  const bizRev = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const bizExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0)
  const buyoutTotal = buyouts.reduce((sum, b) => sum + Number(b.total_cost), 0)
  const netOperatingIncome = bizRev - bizExp - buyoutTotal

  const jobGross = personalPayroll.reduce((sum, p) => sum + Number(p.gross_pay), 0)
  const jobTax = personalPayroll.reduce((sum, p) => sum + Number(p.tax_withheld), 0)
  const totalTaxLiability = (netOperatingIncome + jobGross) * 0.15
  const remainingTax = Math.max(0, totalTaxLiability - jobTax)

  // --- UI STYLES ---
  const theme = { fontFamily: '"Segoe UI", sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }
  const card = { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '15px', border: '1px solid #e2e8f0' }
  const input = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }

  return (
    <div style={theme}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', paddingBottom: '120px' }}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '-0.8px' }}>MANA SOCIAL <span style={{fontWeight: 300}}>LLC</span></h1>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '8px' }}>
            <option value={13}>Full Year</option>
            {Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'short'})}</option>)}
          </select>
        </header>

        {activeTab === 'summary' && (
          <>
            <div style={{ ...card, borderLeft: '6px solid #4f46e5' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Net Operating Income</div>
              <div style={{ fontSize: '36px', fontWeight: '900', margin: '8px 0' }}>${netOperatingIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            </div>
            <div style={card}>
                <h4 style={{margin: '0 0 10px 0'}}>Sales Velocity</h4>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span>Total Sales Count:</span>
                    <span style={{fontWeight: 'bold'}}>{sales.length}</span>
                </div>
            </div>
          </>
        )}

        {activeTab === 'tax' && (
          <div style={card}>
            <h3 style={{marginTop: 0}}>Tax Liability Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span>Total Calculated Liability:</span> <span>${totalTaxLiability.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#ef4444' }}>
                <span>W-2 Paid (Eaton):</span> <span>-${jobTax.toLocaleString()}</span>
            </div>
            <div style={{ fontWeight: 'bold', marginTop: '15px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Remaining Due:</span> <span style={{ color: remainingTax > 0 ? '#f59e0b' : '#10b981' }}>${remainingTax.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* --- DYNAMIC FORM OVERLAY --- */}
        {activeForm && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#fff', width: '100%', borderRadius: '20px', padding: '25px' }}>
              <h3 style={{marginTop: 0}}>New {activeForm.toUpperCase()}</h3>
              <input style={input} placeholder="Name/Vendor" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input style={input} type="number" placeholder="Amount ($)" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              {activeForm === 'buyout' && <input style={input} type="number" placeholder="Item Count" value={formData.count} onChange={e => setFormData({...formData, count: e.target.value})} />}
              {activeForm === 'payroll' && <input style={input} type="number" placeholder="Tax Withheld ($)" value={formData.tax} onChange={e => setFormData({...formData, tax: e.target.value})} />}
              <input style={input} type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              <div style={{display: 'flex', gap: '10px'}}>
                <button onClick={handleSave} style={{ flex: 1, padding: '15px', borderRadius: '10px', border: 'none', backgroundColor: '#4f46e5', color: '#fff', fontWeight: 'bold' }}>SAVE</button>
                <button onClick={() => setActiveForm(null)} style={{ flex: 1, padding: '15px', borderRadius: '10px', border: 'none', backgroundColor: '#f1f5f9' }}>CANCEL</button>
              </div>
            </div>
          </div>
        )}

        {/* --- NAVIGATION --- */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', padding: '15px 0', zIndex: 50 }}>
          {['summary', 'income', 'expense', 'tax', 'payroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, border: 'none', background: 'none', color: activeTab === tab ? '#4f46e5' : '#94a3b8', fontWeight: 'bold', fontSize: '10px' }}>{tab.toUpperCase()}</button>
          ))}
        </nav>

        {/* --- QUICK-ADD MENU --- */}
        {isQuickAddOpen && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 99, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ backgroundColor: '#fff', borderTopLeftRadius: '30px', borderTopRightRadius: '30px', padding: '30px', paddingBottom: '140px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <button onClick={() => setActiveForm('buyout')} style={{ padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>📦<br/>Buyout</button>
                <button onClick={() => setActiveForm('receipt')} style={{ padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>📸<br/>Receipt</button>
                {userRole === 'owner' && <button onClick={() => setActiveForm('payroll')} style={{ padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>💼<br/>Paystub</button>}
                <button onClick={() => setActiveForm('sale')} style={{ padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>💵<br/>Cash Sale</button>
              </div>
              <button onClick={() => setIsQuickAddOpen(false)} style={{ width: '100%', marginTop: '20px', padding: '15px', borderRadius: '10px', border: 'none', backgroundColor: '#f1f5f9' }}>CLOSE</button>
            </div>
          </div>
        )}

        <button style={{ position: 'fixed', bottom: '90px', right: '25px', width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', fontSize: '32px', zIndex: 100 }} onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}>
          {isQuickAddOpen ? '×' : '+'}
        </button>
      </div>
    </div>
  )
}
