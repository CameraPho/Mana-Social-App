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
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = Full Year
  const [userRole, setUserRole] = useState('partner')
  const [editingItem, setEditingItem] = useState(null)

  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [buyouts, setBuyouts] = useState([])

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email === 'camerapho@gmail.com') setUserRole('owner');
    else if (user?.email === 'kensan003@yahoo.com') setUserRole('partner');

    // Fetch EVERYTHING to ensure we didn't lose data
    const [sRes, eRes, bRes] = await Promise.all([
      supabase.from('sales').select('*').order('sale_date', { ascending: false }),
      supabase.from('expenses').select('*').order('purchase_date', { ascending: false }),
      supabase.from('buyouts').select('*').order('due_date', { ascending: false })
    ]);

    const applyFilters = (data, dateKey) => {
      if (!data) return [];
      return data.filter(item => {
        const d = new Date(item[dateKey]);
        const yMatch = d.getFullYear() === selectedYear;
        const mMatch = selectedMonth === 0 || (d.getMonth() + 1) === selectedMonth;
        return yMatch && mMatch;
      });
    };

    setSales(applyFilters(sRes.data, 'sale_date'));
    setExpenses(applyFilters(eRes.data, 'purchase_date'));
    setBuyouts(applyFilters(bRes.data, 'due_date'));
  }, [selectedYear, selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- CATEGORY TOTALS ---
  const revTotal = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const marketplaceFees = expenses.filter(e => e.item_name.toLowerCase().includes('fee')).reduce((sum, e) => sum + Number(e.cost), 0);
  const apTotal = buyouts.filter(b => b.payment_status === 'unpaid').reduce((sum, b) => sum + Number(b.total_cost), 0);
  const paidBuyouts = buyouts.filter(b => b.payment_status === 'paid').reduce((sum, b) => sum + Number(b.total_cost), 0);
  const inventoryTotal = expenses.filter(e => e.item_name.toLowerCase().includes('inventory')).reduce((sum, e) => sum + Number(e.cost), 0) + paidBuyouts;
  
  const platformTotal = (p) => sales.filter(s => s.platform === p).reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div style={{ fontFamily: 'system-ui', backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '120px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
        
        <header style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '900', textAlign: 'center', marginBottom: '15px' }}>MANA SOCIAL LLC</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid #cbd5e1', fontWeight: 'bold' }}>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: '2px solid #cbd5e1' }}>
              <option value={0}>Full Year</option>
              {Array.from({length: 12}, (_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('default', {month: 'long'})}</option>)}
            </select>
          </div>
        </header>

        {/* SUMMARY TAB */}
        {activeTab === 'summary' && (
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', borderLeft: '8px solid #4f46e5', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '11px', fontWeight: '900', color: '#64748b' }}>NET INCOME ({selectedMonth === 0 ? 'YTD' : 'MTD'})</div>
                <div style={{ fontSize: '32px', fontWeight: '900' }}>${(revTotal - marketplaceFees - inventoryTotal).toLocaleString()}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#10b981' }}>REVENUE</div>
                    <div style={{ fontSize: '18px', fontWeight: '900' }}>${revTotal.toLocaleString()}</div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#ef4444' }}>EXPENSES</div>
                    <div style={{ fontSize: '18px', fontWeight: '900' }}>${(marketplaceFees + inventoryTotal).toLocaleString()}</div>
                </div>
            </div>
          </div>
        )}

        {/* INCOME TAB */}
        {activeTab === 'income' && (
          <div>
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '15px', border: '1px solid #10b981' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '12px' }}>PLATFORM BREAKDOWN</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                    <span>ManaPool: ${platformTotal('ManaPool').toLocaleString()}</span>
                    <span>eBay: ${platformTotal('eBay').toLocaleString()}</span>
                    <span>TCGplayer: ${platformTotal('TCGplayer').toLocaleString()}</span>
                    <span>POS: ${platformTotal('Cash/Local').toLocaleString()}</span>
                </div>
            </div>
            {sales.map(s => (
                <div key={s.id} onClick={() => setEditingItem({table: 'sales', ...s})} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span>{s.platform}</span><span style={{ color: '#10b981' }}>+${Number(s.amount).toLocaleString()}</span>
                    </div>
                </div>
            ))}
          </div>
        )}

        {/* EXPENSE TAB - VERIFY BRETT HERE */}
        {activeTab === 'expense' && (
          <div>
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '15px', border: '1px solid #ef4444' }}>
                <div style={{ color: '#ef4444', fontWeight: '900', fontSize: '11px' }}>ACCOUNTS PAYABLE: ${apTotal.toLocaleString()}</div>
                <div style={{ fontSize: '11px', marginTop: '5px' }}>Inventory Total: ${inventoryTotal.toLocaleString()}</div>
            </div>
            
            <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>DETAILED LEDGER</h4>
            {buyouts.length === 0 && <p style={{ fontSize: '12px', color: '#94a3b8' }}>No records found for this filter. Check "Full Year" view.</p>}
            {buyouts.map(b => (
              <div key={b.id} onClick={() => setEditingItem({table: 'buyouts', ...b})} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '8px', borderLeft: b.payment_status === 'unpaid' ? '6px solid #f59e0b' : '6px solid #10b981', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>{b.seller_name} (Buyout)</span>
                  <span>${Number(b.total_cost).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{b.item_count} Cards • Due: {b.due_date} • {b.payment_status.toUpperCase()}</div>
              </div>
            ))}
          </div>
        )}

        {/* ROBUST NAVIGATION */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '2px solid #e2e8f0', display: 'flex', height: '90px', zIndex: 100 }}>
          {['summary', 'income', 'expense', 'payroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} 
              style={{ 
                flex: 1, 
                border: activeTab === tab ? '4px solid #4f46e5' : '1px solid #f1f5f9', 
                backgroundColor: activeTab === tab ? '#f0f4ff' : 'white',
                color: activeTab === tab ? '#4f46e5' : '#94a3b8',
                fontWeight: '900',
                fontSize: '12px',
                textTransform: 'uppercase'
              }}>
              {tab}
            </button>
          ))}
        </nav>

        {/* DELETE/EDIT OVERLAY */}
        {editingItem && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#fff', width: '100%', borderRadius: '20px', padding: '25px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '20px' }}>Manage Record</h2>
              <button onClick={async () => {
                if (confirm("Delete this transaction?")) {
                  await supabase.from(editingItem.table).delete().eq('id', editingItem.id);
                  setEditingItem(null);
                  fetchData();
                }
              }} style={{ width: '100%', padding: '16px', borderRadius: '12px', backgroundColor: '#fee2e2', color: '#ef4444', fontWeight: 'bold', border: 'none' }}>DELETE PERMANENTLY</button>
              <button onClick={() => setEditingItem(null)} style={{ width: '100%', marginTop: '10px', padding: '16px', border: 'none', background: 'none', fontWeight: 'bold' }}>CANCEL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
