'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ManaSocialHub() {
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [isTaxDetailOpen, setIsTaxDetailOpen] = useState(false)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [userRole, setUserRole] = useState('partner') // Default safety
  
  // Data States
  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [personalPayroll, setPersonalPayroll] = useState([])
  const [buyouts, setBuyouts] = useState([])

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    // OWNER GATE - Replace with your actual login email
    if (user?.email === 'your-email@example.com') {
      setUserRole('owner')
    }

    // Safety Handshake: Fetch all data concurrently with error catching
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

  // --- MATH ENGINE ---
  const bizRev = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const bizExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0)
  const buyoutTotal = buyouts.reduce((sum, b) => sum + Number(b.total_cost), 0)
  const businessNet = bizRev - bizExp - buyoutTotal

  const jobGross = personalPayroll.reduce((sum, p) => sum + Number(p.gross_pay), 0)
  const jobTax = personalPayroll.reduce((sum, p) => sum + Number(p.tax_withheld), 0)
  
  const combinedNet = businessNet + jobGross
  const totalTaxLiability = combinedNet * 0.15 
  const remainingTax = Math.max(0, totalTaxLiability - jobTax)

  // --- STYLES (Professional Calibri Stack) ---
  const theme = { fontFamily: '"Segoe UI", Candara, sans-serif', backgroundColor: '#f4f7f9', minHeight: '100vh', color: '#1a1f36' }
  const card = { backgroundColor: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', border: '1px solid #e3e8ee' }

  return (
    <div style={theme}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', paddingBottom: '120px' }}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>MANA SOCIAL <span style={{fontWeight: 300}}>LLC</span></h1>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #dcdfe4' }}>
            <option value={13}>All 2026</option>
            {Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'short'})}</option>)}
          </select>
        </header>

        {activeTab === 'summary' && (
          <>
            <div style={{ ...card, borderLeft: '5px solid #635bff', background: '#fff' }}>
              <div style={{ fontSize: '11px', color: '#697386', fontWeight: 'bold', textTransform: 'uppercase' }}>Combined Household Net</div>
              <div style={{ fontSize: '32px', fontWeight: '800', margin: '5px 0' }}>${combinedNet.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            </div>

            <div style={card} onClick={() => setIsTaxDetailOpen(!isTaxDetailOpen)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', fontSize: '14px' }}>Tax Reserve Hub</span>
                <span style={{ color: remainingTax > 0 ? '#ff9800' : '#4caf50', fontWeight: 'bold' }}>
                  {isTaxDetailOpen ? '▲' : '▼'} ${remainingTax.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </span>
              </div>
              {isTaxDetailOpen && (
                <div style={{ marginTop: '15px', fontSize: '13px', borderTop: '1px solid #f1f1f1', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Self-Employment Tax Est (15%):</span> <span>${totalTaxLiability.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>W-2 Paid (Eaton):</span> <span style={{ color: '#ef4444' }}>-${jobTax.toLocaleString()}</span>
                  </div>
                  <div style={{ fontWeight: 'bold', marginTop: '8px', display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #eee', paddingTop: '8px' }}>
                    <span>Estimated Remaining:</span> <span>${remainingTax.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={card}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Operations Overview</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                <span style={{ color: '#697386' }}>Card Buyouts (Cash):</span> <span style={{ color: '#ef4444' }}>-${buyoutTotal.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#697386' }}>Marketplace Fees:</span> <span style={{ color: '#ef4444' }}>-${bizExp.toLocaleString()}</span>
              </div>
            </div>
          </>
        )}

        {/* --- NAVIGATION --- */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '1px solid #e3e8ee', display: 'flex', padding: '12px 0', zIndex: 10 }}>
          {['summary', 'income', 'expense', 'payroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ 
              flex: 1, border: 'none', background: 'none', 
              color: activeTab === tab ? '#635bff' : '#94a3b8', 
              fontWeight: '800', fontSize: '10px', textTransform: 'uppercase' 
            }}>
              {tab}
            </button>
          ))}
        </nav>

        {/* --- QUICK-ADD DRAWER --- */}
        {isQuickAddOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 99, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ backgroundColor: '#fff', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', paddingBottom: '120px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '18px' }}>New Transaction</h3>
                <button onClick={() => setIsQuickAddOpen(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button style={{ padding: '20px', borderRadius: '16px', border: '1px solid #e3e8ee', backgroundColor: '#f8fafc', textAlign: 'center' }}>📦<br/><strong>Buyout</strong></button>
                <button style={{ padding: '20px', borderRadius: '16px', border: '1px solid #e3e8ee', backgroundColor: '#f8fafc', textAlign: 'center' }}>📸<br/><strong>Receipt</strong></button>
                {userRole === 'owner' && <button style={{ padding: '20px', borderRadius: '16px', border: '1px solid #e3e8ee', backgroundColor: '#f8fafc', textAlign: 'center' }}>💼<br/><strong>Paystub</strong></button>}
                <button style={{ padding: '20px', borderRadius: '16px', border: '1px solid #e3e8ee', backgroundColor: '#f8fafc', textAlign: 'center' }}>💵<br/><strong>Cash Sale</strong></button>
              </div>
            </div>
          </div>
        )}

        {/* FLOATING ACTION BUTTON */}
        <button style={{ 
          position: 'fixed', bottom: '80px', right: '20px', 
          width: '60px', height: '60px', borderRadius: '30px', 
          backgroundColor: '#635bff', color: '#fff', border: 'none', 
          fontSize: '28px', boxShadow: '0 8px 16px rgba(99,91,255,0.4)', cursor: 'pointer', zIndex: 100 
        }} onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}>
          {isQuickAddOpen ? '×' : '+'}
        </button>
      </div>
    </div>
  )
}
