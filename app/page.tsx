'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MANAPOOL_KEY = process.env.NEXT_PUBLIC_MANAPOOL_API_KEY;

export default function ManaSocialMasterApp() {
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = All Months
  const [isSyncing, setIsSyncing] = useState(false)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [activeForm, setActiveForm] = useState(null)
  const [userRole, setUserRole] = useState('partner')

  const [formData, setFormData] = useState({ name: '', amount: '', count: '', tax: '', date: new Date().toISOString().split('T')[0], status: 'unpaid' })

  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [personalPayroll, setPersonalPayroll] = useState([])
  const [buyouts, setBuyouts] = useState([])

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // PERMISSIONS ENGINE
    if (user?.email === 'camerapho@gmail.com') { 
        setUserRole('owner'); 
    } else if (user?.email === 'kensan003@yahoo.com') {
        setUserRole('partner');
    }

    const [sRes, eRes, pRes, bRes] = await Promise.all([
      supabase.from('sales').select('*').order('sale_date', { ascending: false }),
      supabase.from('expenses').select('*').order('purchase_date', { ascending: false }),
      supabase.from('personal_payroll').select('*').order('pay_date', { ascending: false }),
      supabase.from('buyouts').select('*').order('created_at', { ascending: false })
    ]);

    const filterData = (data, dateKey) => {
      if (!data) return [];
      return data.filter(item => {
        const itemDate = new Date(item[dateKey]);
        const yearMatch = itemDate.getFullYear() === selectedYear;
        const monthMatch = selectedMonth === 0 || (itemDate.getMonth() + 1) === selectedMonth;
        return yearMatch && monthMatch;
      });
    };

    setSales(filterData(sRes.data, 'sale_date'));
    setExpenses(filterData(eRes.data, 'purchase_date'));
    setPersonalPayroll(filterData(pRes.data, 'pay_date'));
    setBuyouts(filterData(bRes.data, 'created_at'));
  }, [selectedYear, selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // MATH ENGINE
  const bizRev = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const bizExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const accountsPayable = buyouts.filter(b => b.payment_status === 'unpaid').reduce((sum, b) => sum + Number(b.total_cost), 0);
  const paidBuyouts = buyouts.filter(b => b.payment_status === 'paid').reduce((sum, b) => sum + Number(b.total_cost), 0);
  const netOperatingIncome = bizRev - bizExp - paidBuyouts;

  return (
    <div style={{ fontFamily: '"Segoe UI", sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#1e293b' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', paddingBottom: '120px' }}>
        
        {/* HEADER & DUAL FILTERS */}
        <header style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: '900' }}>MANA SOCIAL <span style={{fontWeight: 300}}>LLC</span></h1>
            <button onClick={() => {/* ManaPool Sync Call */}} style={{ fontSize: '10px', padding: '8px 12px', borderRadius: '20px', backgroundColor: '#4f46e5', color: '#fff', border: 'none' }}>SYNC</button>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <option value={0}>All Months</option>
              {Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>)}
            </select>
          </div>
        </header>

        {activeTab === 'summary' && (
          <>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '12px', borderLeft: '6px solid #4f46e5', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>NET OPERATING INCOME ({selectedMonth === 0 ? selectedYear : new Date(0, selectedMonth-1).toLocaleString('default', {month: 'short'})})</div>
              <div style={{ fontSize: '32px', fontWeight: '900' }}>${netOperatingIncome.toLocaleString()}</div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '15px', borderLeft: '6px solid #f59e0b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 'bold' }}>ACCOUNTS PAYABLE</div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: '#92400e' }}>${accountsPayable.toLocaleString()}</div>
              </div>
            </div>
          </>
        )}

        {/* LEDGER TABS (INCOME/EXPENSE) - Simplified for briefness */}
        {activeTab === 'income' && (
            <div>
                <h3>{selectedMonth === 0 ? 'Annual' : 'Monthly'} Sales</h3>
                {sales.map(s => (
                    <div key={s.id} style={{backgroundColor: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '8px', border: '1px solid #e2e8f0'}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                            <strong>{s.platform}</strong>
                            <span style={{color:'#10b981'}}>+${Number(s.amount).toLocaleString()}</span>
                        </div>
                        <div style={{fontSize:'12px', color:'#64748b'}}>{s.sale_date}</div>
                    </div>
                ))}
            </div>
        )}

        {/* NAVIGATION BAR */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', padding: '15px 0', zIndex: 50 }}>
          {['summary', 'income', 'expense', 'tax', 'payroll'].map(tab => (
            <button key={tab} 
                    onClick={() => setActiveTab(tab)} 
                    style={{ flex: 1, border: 'none', background: 'none', color: activeTab === tab ? '#4f46e5' : '#94a3b8', fontWeight: 'bold', fontSize: '10px' }}>
                {tab.toUpperCase()}
            </button>
          ))}
        </nav>

        {/* FLOATING ACTION BUTTON */}
        <button style={{ position: 'fixed', bottom: '90px', right: '25px', width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', fontSize: '32px', zIndex: 100 }} 
                onClick={() => setIsQuickAddOpen(true)}>+</button>

      </div>
    </div>
  )
}
