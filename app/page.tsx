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
  const [userRole, setUserRole] = useState('partner') // Default to restricted access

  // Data States
  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [personalPayroll, setPersonalPayroll] = useState([])

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Role Gate: Replace with your actual email
    if (user?.email === 'your-email@example.com') {
      setUserRole('owner')
    }

    const { data: sData } = await supabase.from('sales').select('*').order('sale_date', { ascending: false })
    const { data: eData } = await supabase.from('expenses').select('*').order('purchase_date', { ascending: false })
    const { data: pData } = await supabase.from('personal_payroll').select('*').order('pay_date', { ascending: false })

    const filterByDate = (arr, field) => {
      if (!arr) return []
      const year = 2026
      if (selectedMonth === 13) return arr.filter(i => i[field]?.includes(`${year}`))
      const m = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth
      return arr.filter(i => i[field]?.includes(`${year}-${m}`))
    }

    setSales(filterByDate(sData, 'sale_date'))
    setExpenses(filterByDate(eData, 'purchase_date'))
    setPersonalPayroll(filterByDate(pData, 'pay_date'))
  }, [selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  // --- CALCULATIONS ---
  const businessRev = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const businessExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0)
  const businessNet = businessRev - businessExp

  const jobGross = personalPayroll.reduce((sum, p) => sum + Number(p.gross_pay), 0)
  const jobTaxWithheld = personalPayroll.reduce((sum, p) => sum + Number(p.tax_withheld), 0)

  const combinedNet = businessNet + jobGross
  const estimatedTaxReserve = combinedNet > 0 ? (combinedNet * 0.15) - jobTaxWithheld : 0

  const expenseCategories = expenses.reduce((acc, curr) => {
    acc[curr.category || 'Other'] = (acc[curr.category || 'Other'] || 0) + Number(curr.cost)
    return acc
  }, {})

  // --- ACTIONS ---
  const runSync = async () => {
    setIsSyncing(true)
    const res = await fetch('/api/sync-manapool', { method: 'POST' })
    const result = await res.json()
    alert(result.message || "Sync Complete")
    fetchData()
    setIsSyncing(false)
  }

  // --- STYLES (Calibri Stack) ---
  const theme = {
    fontFamily: '"Segoe UI", Candara, "Bitstream Vera Sans", sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    color: '#1e293b'
  }
  const card = { backgroundColor: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }

  return (
    <div style={theme}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        
        {/* Header */}
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', letterSpacing: '-0.5px' }}>MANA SOCIAL <span style={{ fontWeight: 300 }}>LLC</span></h2>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ padding: '5px', borderRadius: '5px' }}>
            <option value={13}>Full Year 2026</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>)}
          </select>
        </div>

        {activeTab === 'summary' && (
          <>
            <div style={{ ...card, backgroundColor: '#0f172a', color: '#fff' }}>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>TOTAL COMBINED NET (YTD)</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>${combinedNet.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              <div style={{ marginTop: '15px', borderTop: '1px solid #334155', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Remaining Tax Due:</span>
                  <span style={{ color: estimatedTaxReserve > 0 ? '#fbbf24' : '#4ade80' }}>
                    ${Math.max(0, estimatedTaxReserve).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div style={card}>
              <h4 style={{ marginTop: 0 }}>Expense Breakdown</h4>
              {Object.entries(expenseCategories).map(([cat, val]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span style={{ color: '#64748b' }}>{cat}</span>
                  <span>${Number(val).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'income' && (
          <button onClick={runSync} disabled={isSyncing} style={{ ...card, width: '100%', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
            {isSyncing ? 'SYNCING MANAPOOL...' : '🔄 SYNC RECENT SALES'}
          </button>
        )}

        {/* OWNER ONLY SECTION */}
        {activeTab === 'payroll' && userRole === 'owner' && (
          <div style={card}>
            <h3>Eaton Payroll Records</h3>
            {personalPayroll.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>{p.pay_date}</span>
                <div style={{ textAlign: 'right' }}>
                  <div>${Number(p.gross_pay).toFixed(2)}</div>
                  <div style={{ fontSize: '11px', color: '#ef4444' }}>Withheld: ${Number(p.tax_withheld).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BOTTOM NAV */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', display: 'flex', borderTop: '1px solid #e2e8f0', padding: '10px' }}>
          {['summary', 'income', 'expense', 'payroll'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, background: 'none', border: 'none', color: activeTab === t ? '#2563eb' : '#94a3b8', fontWeight: 'bold', fontSize: '12px' }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
