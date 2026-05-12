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
  const [payroll, setPayroll] = useState([])
  const [buyouts, setBuyouts] = useState([])

  const fetchData = useCallback(async () => {
    const year = 2026
    const { data: sData } = await supabase.from('sales').select('*').order('sale_date', { ascending: false })
    const { data: eData } = await supabase.from('expenses').select('*').order('purchase_date', { ascending: false })
    const { data: pData } = await supabase.from('payroll').select('*')
    const { data: bData } = await supabase.from('buyouts').select('*')

    const filter = (arr, field) => {
      if (!arr) return []
      if (selectedMonth === 13) return arr.filter(i => i[field]?.includes(`${year}`))
      const m = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth
      return arr.filter(i => i[field]?.includes(`${year}-${m}`))
    }

    setSales(filter(sData, 'sale_date'))
    setExpenses(filter(eData, 'purchase_date'))
    setPayroll(filter(pData, 'created_at'))
    setBuyouts(filter(bData, 'created_at'))
  }, [selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  // --- CRUD ACTIONS ---
  const handleSync = async () => {
    setIsSyncing(true)
    const res = await fetch('/api/sync-manapool', { method: 'POST' })
    const result = await res.json()
    alert(result.error ? `Error: ${result.error}` : `Synced ${result.count} new orders!`)
    setIsSyncing(false)
    fetchData()
  }

  const handleDelete = async (id, table) => {
    if (confirm("Delete entry?")) {
      await supabase.from(table).delete().eq('id', id)
      fetchData()
    }
  }

  // --- CALCULATIONS ---
  const totalRev = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const totalExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0)
  const totalPay = payroll.reduce((sum, p) => sum + Number(p.gross_pay), 0)
  const totalBuy = buyouts.reduce((sum, b) => sum + Number(b.total_cost), 0)
  const net = totalRev - (totalExp + totalPay + totalBuy)

  // --- STYLES ---
  const card = { backgroundColor: '#fff', borderRadius: '20px', padding: '20px', marginBottom: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }
  const btn = { width: '100%', padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '900' }}>MANA SOCIAL</h1>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ padding: '5px' }}>
            {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>)}
            <option value={13}>Full Year</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', marginBottom: '15px' }}>
        {['summary', 'income', 'expense', 'payroll', 'buyouts'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ ...btn, fontSize: '10px', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b' }}>{t.toUpperCase()}</button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div style={card}>
          <div style={{ fontSize: '28px', fontWeight: '900', color: net >= 0 ? '#16a34a' : '#dc2626' }}>${net.toFixed(2)}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>NET PROFIT ({selectedMonth === 13 ? '2026' : 'Selected Month'})</div>
          <hr style={{ margin: '15px 0', opacity: 0.1 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Revenue</span><span>+${totalRev.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Expenses</span><span>-${totalExp.toFixed(2)}</span></div>
        </div>
      )}

      {activeTab === 'income' && (
        <>
          <div style={card}>
            <button onClick={handleSync} disabled={isSyncing} style={{ ...btn, backgroundColor: '#000', color: '#fff' }}>
              {isSyncing ? 'SYNCING...' : '🔄 SYNC MANAPOOL'}
            </button>
          </div>
          <div style={card}>
            <h3>Sale History</h3>
            {sales.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>{s.platform}</span>
                <div>
                  <span style={{ fontWeight: 'bold', marginRight: '10px' }}>${Number(s.amount).toFixed(2)}</span>
                  <button onClick={() => handleDelete(s.id, 'sales')} style={{ color: '#ef4444', border: 'none', background: 'none' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Expense Tab with similar History list... */}
    </div>
  )
}
