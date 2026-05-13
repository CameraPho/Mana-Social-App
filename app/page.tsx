'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ManaSocialMasterApp() {
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(0) 
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [activeForm, setActiveForm] = useState(null)
  const [userRole, setUserRole] = useState('partner')
  
  // State for Editing/Deleting
  const [editingItem, setEditingItem] = useState(null)

  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [personalPayroll, setPersonalPayroll] = useState([])
  const [buyouts, setBuyouts] = useState([])

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email === 'camerapho@gmail.com') setUserRole('owner');
    else if (user?.email === 'kensan003@yahoo.com') setUserRole('partner');

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
        return itemDate.getFullYear() === selectedYear && (selectedMonth === 0 || (itemDate.getMonth() + 1) === selectedMonth);
      });
    };

    setSales(filterData(sRes.data, 'sale_date'));
    setExpenses(filterData(eRes.data, 'purchase_date'));
    setPersonalPayroll(filterData(pRes.data, 'pay_date'));
    setBuyouts(filterData(bRes.data, 'created_at'));
  }, [selectedYear, selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- DELETE LOGIC ---
  const deleteItem = async (table, id) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) fetchData();
    setEditingItem(null);
  };

  // --- DYNAMIC CALCULATIONS ---
  const revTotal = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const expTotal = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const apTotal = buyouts.filter(b => b.payment_status === 'unpaid').reduce((sum, b) => sum + Number(b.total_cost), 0);
  const paidBuyouts = buyouts.filter(b => b.payment_status === 'paid').reduce((sum, b) => sum + Number(b.total_cost), 0);
  
  const platformTotal = (p) => sales.filter(s => s.platform === p).reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div style={{ fontFamily: '"Segoe UI", sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#1e293b' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', paddingBottom: '140px' }}>
        
        <header style={{ marginBottom: '25px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '900', textAlign: 'center' }}>MANA SOCIAL LLC</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '2px solid #cbd5e1', fontWeight: '900' }}>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 1.5, padding: '12px', borderRadius: '12px', border: '2px solid #cbd5e1' }}>
              <option value={0}>Full Year</option>
              {Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>)}
            </select>
          </div>
        </header>

        {/* SUMMARY TAB - DYNAMICALLY UPDATES BASED ON FILTERS */}
        {activeTab === 'summary' && (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '20px', borderLeft: '8px solid #10b981' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#10b981' }}>REVENUE ({selectedMonth === 0 ? 'YTD' : 'MTD'})</div>
              <div style={{ fontSize: '28px', fontWeight: '900' }}>${revTotal.toLocaleString()}</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '20px', borderLeft: '8px solid #ef4444' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#ef4444' }}>EXPENSES ({selectedMonth === 0 ? 'YTD' : 'MTD'})</div>
              <div style={{ fontSize: '28px', fontWeight: '900' }}>${(expTotal + paidBuyouts).toLocaleString()}</div>
            </div>
            <div style={{ backgroundColor: '#4f46e5', padding: '25px', borderRadius: '20px', color: '#fff' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', opacity: 0.8 }}>NET OPERATING INCOME</div>
              <div style={{ fontSize: '36px', fontWeight: '900' }}>${(revTotal - expTotal - paidBuyouts).toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* INCOME TAB */}
        {activeTab === 'income' && (
          <div>
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '15px', border: '1px solid #10b981' }}>
              <div style={{ fontSize: '11px', fontWeight: '900' }}>PLATFORM SUMMARY</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                <span style={{ fontSize: '12px' }}>MP: <b>${platformTotal('ManaPool').toLocaleString()}</b></span>
                <span style={{ fontSize: '12px' }}>eBay: <b>${platformTotal('eBay').toLocaleString()}</b></span>
                <span style={{ fontSize: '12px' }}>TCG: <b>${platformTotal('TCGplayer').toLocaleString()}</b></span>
              </div>
            </div>
            {sales.map(s => (
              <div key={s.id} onClick={() => setEditingItem({table: 'sales', ...s})} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{s.platform}</strong> <span style={{ color: '#10b981', fontWeight: '900' }}>+${Number(s.amount).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{s.sale_date} • Tap to Manage</div>
              </div>
            ))}
          </div>
        )}

        {/* EXPENSE TAB */}
        {activeTab === 'expense' && (
          <div>
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '15px', border: '1px solid #ef4444' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#ef4444' }}>ACCOUNTS PAYABLE: ${apTotal.toLocaleString()}</div>
            </div>
            {buyouts.map(b => (
              <div key={b.id} onClick={() => setEditingItem({table: 'buyouts', ...b})} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '8px', borderLeft: b.payment_status === 'unpaid' ? '5px solid #f59e0b' : '5px solid #10b981', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{b.seller_name}</strong> <strong>${Number(b.total_cost).toLocaleString()}</strong>
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{b.payment_status.toUpperCase()} • {b.item_count} Items</div>
              </div>
            ))}
          </div>
        )}

        {/* MANAGEMENT MODAL (Edit/Delete) */}
        {editingItem && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#fff', width: '100%', borderRadius: '20px', padding: '25px' }}>
              <h3 style={{marginTop: 0}}>Manage Transaction</h3>
              <p style={{fontSize: '14px', color: '#64748b'}}>Updating records for: <b>{editingItem.seller_name || editingItem.platform || editingItem.item_name}</b></p>
              <button style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', backgroundColor: '#f1f5f9', fontWeight: 'bold', marginBottom: '10px' }}>EDIT (Coming Soon)</button>
              <button onClick={() => deleteItem(editingItem.table, editingItem.id)} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', backgroundColor: '#fee2e2', color: '#ef4444', fontWeight: 'bold' }}>DELETE TRANSACTION</button>
              <button onClick={() => setEditingItem(null)} style={{ width: '100%', marginTop: '10px', padding: '15px', border: 'none', background: 'none', color: '#64748b' }}>CLOSE</button>
            </div>
          </div>
        )}

        {/* NAVIGATION */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '2px solid #e2e8f0', display: 'flex', height: '85px', zIndex: 100 }}>
          {['summary', 'income', 'expense', 'tax', 'payroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} 
              style={{ flex: 1, border: activeTab === tab ? '3px solid #4f46e5' : '1px solid #f1f5f9', backgroundColor: activeTab === tab ? '#f0f4ff' : 'white', color: activeTab === tab ? '#4f46e5' : '#94a3b8', fontWeight: '900', fontSize: '11px' }}>
              {tab.toUpperCase()}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
