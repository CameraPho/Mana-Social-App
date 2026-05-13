'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [isSyncing, setIsSyncing] = useState(false)

  // Data States
  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [personalPayroll, setPersonalPayroll] = useState([])
  const [userRole, setUserRole] = useState('owner') // Default to owner for now

  const fetchData = useCallback(async () => {
    const year = 2026
    const { data: sData } = await supabase.from('sales').select('*').order('sale_date', { ascending: false })
    const { data: eData } = await supabase.from('expenses').select('*').order('purchase_date', { ascending: false })
    const { data: pData } = await supabase.from('personal_payroll').select('*').order('pay_date', { ascending: false })

    const filter = (arr, dateField) => {
      if (!arr) return []
      if (selectedMonth === 13) return arr.filter(i => i[dateField]?.includes(`${year}`))
      const m = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth
      return arr.filter(i => i[dateField]?.includes(`${year}-${m}`))
    }

    setSales(filter(sData, 'sale_date'))
    setExpenses(filter(eData, 'purchase_date'))
    setPersonalPayroll(filter(pData, 'pay_date'))
  }, [selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  // --- ACTIONS ---
  const runSync = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/sync-manapool', { method: 'POST' })
      const result = await res.json()
      alert(`Success! Synced ${result.count} new orders.`)
      fetchData()
    } catch (err) { alert("Sync failed.") }
    setIsSyncing(false)
  }

  // --- CALCULATIONS (The "Accountant" View) ---
  const totalRev = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const totalExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0)
  const businessNet = totalRev - totalExp
  
  const jobGross = personalPayroll.reduce((sum, p) => sum + Number(p.gross_pay), 0)
  const jobTaxWithheld = personalPayroll.reduce((sum, p) => sum + Number(p.tax_withheld), 0)
  
  const combinedHouseholdNet = businessNet + jobGross
  const irsReserve = combinedHouseholdNet > 0 ? (combinedHouseholdNet * 0.15) - jobTaxWithheld : 0

  // Category Breakdown Logic
  const expenseBreakdown = expenses.reduce((acc, curr) => {
    acc[curr.category || 'Other'] = (acc[curr.category || 'Other'] || 0) + Number(curr.cost)
    return acc
  }, {})

  // --- STYLING (Calibri / Professional Stack) ---
  const calibriStyle = { 
    fontFamily: '"Segoe UI", Candara, "Bitstream Vera Sans", "DejaVu Sans", sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    color: '#1e293b',
    paddingBottom: '80px'
  }
  const card = { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }

  return (
    <div style={calibriStyle}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        
        {/* Header */}
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>MANA SOCIAL HUB</h2>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ padding: '6px', borderRadius: '8px' }}>
            <option value={13}>Full Year 2026</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>)}
          </select>
        </div>

        {/* SUMMARY TAB */}
        {activeTab === 'summary' && (
          <>
            <div style={{ ...card, background: '#1e293b', color: '#fff' }}>
              <div style={{ opacity: 0.8, fontSize: '12px' }}>COMBINED HOUSEHOLD NET (PRE-TAX)</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>${combinedHouseholdNet.toLocaleString()}</div>
              
              <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Remaining Tax Reserve</span>
                  <span style={{ color: irsReserve > 0 ? '#fbbf24' : '#4ade80', fontWeight: 'bold' }}>
                    {irsReserve > 0 ? `-$${irsReserve.toFixed(2)}` : 'COVERED'}
                  </span>
                </div>
              </div>
            </div>

            <div style={card}>
              <h4 style={{ marginTop: 0, borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>Expense Breakdown</h4>
              {Object.entries(expenseBreakdown).map(([cat, val]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight: '600' }}>${Number(val).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* INCOME TAB (With Sync) */}
        {activeTab === 'income' && (
          <>
            <button onClick={runSync} disabled={isSyncing} style={{ ...card, width: '100%', border: 'none', backgroundColor: '#000', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
              {isSyncing ? 'CONNECTING...' : '🔄 SYNC MANAPOOL SALES'}
            </button>
            <div style={card}>
              <h3>Recent Sales</h3>
              {sales.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span>{s.platform}</span>
                  <span style={{ fontWeight: 'bold' }}>${Number(s.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PAYROLL TAB (Personal/Eaton) */}
        {activeTab === 'payroll' && userRole === 'owner' && (
          <div style={card}>
            <h3>Eaton / W-2 Income</h3>
            <p style={{ fontSize: '12px', color: '#64748b' }}>Accountant view for total tax liability.</p>
            {personalPayroll.map(p => (
              <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>{p.employer_name}</span>
                  <span>${Number(p.gross_pay).toFixed(2)}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#ef4444' }}>Tax Withheld: -${Number(p.tax_withheld).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', display: 'flex', padding: '15px', borderTop: '1px solid #e2e8f0' }}>
          {['summary', 'income', 'expense', 'payroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, border: 'none', background: 'none', color: activeTab === tab ? '#2563eb' : '#94a3b8', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase' }}>
              {tab}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
