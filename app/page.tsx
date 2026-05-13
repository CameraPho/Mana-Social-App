'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// NOTE: Add MANAPOOL_API_KEY to your Vercel Environment Variables
const MANAPOOL_KEY = process.env.NEXT_PUBLIC_MANAPOOL_API_KEY;

export default function ManaSocialMasterApp() {
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [isSyncing, setIsSyncing] = useState(false)
  const [activeForm, setActiveForm] = useState(null)
  const [userRole, setUserRole] = useState('partner')

  const [sales, setSales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [personalPayroll, setPersonalPayroll] = useState([])
  const [buyouts, setBuyouts] = useState([])

  // --- MANAPOOL AUTO-SYNC LOGIC ---
  const syncManaPool = async () => {
    if (!MANAPOOL_KEY) return;
    setIsSyncing(true);
    try {
      // Fetching recent orders from ManaPool
      const response = await fetch('https://manapool.com/api/v1/seller/orders', {
        headers: { 'Authorization': `Bearer ${MANAPOOL_KEY}` }
      });
      const data = await response.json();

      for (const order of data.orders) {
        // 1. Sync Revenue
        await supabase.from('sales').upsert({
          external_id: `mp_${order.id}`,
          platform: 'ManaPool',
          amount: order.subtotal,
          sale_date: order.created_at,
          notes: `Order #${order.id}`
        }, { onConflict: 'external_id' });

        // 2. Sync Fees & Shipping (COGs)
        const totalFees = Number(order.commission) + Number(order.processing_fee);
        await supabase.from('expenses').upsert({
          external_id: `mp_fee_${order.id}`,
          item_name: `ManaPool Fees (#${order.id})`,
          cost: totalFees,
          purchase_date: order.created_at
        }, { onConflict: 'external_id' });

        if (order.shipping_cost > 0) {
          await supabase.from('expenses').upsert({
            external_id: `mp_ship_${order.id}`,
            item_name: `Shipping COGs (#${order.id})`,
            cost: order.shipping_cost,
            purchase_date: order.created_at
          }, { onConflict: 'external_id' });
        }
      }
    } catch (err) { console.error("ManaPool Sync Failed:", err); }
    setIsSyncing(false);
    fetchData();
  };

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email === 'YOUR_EMAIL_HERE') { setUserRole('owner'); }

    const [sRes, eRes, pRes, bRes] = await Promise.all([
      supabase.from('sales').select('*').order('sale_date', { ascending: false }),
      supabase.from('expenses').select('*').order('purchase_date', { ascending: false }),
      supabase.from('personal_payroll').select('*').order('pay_date', { ascending: false }),
      supabase.from('buyouts').select('*').order('created_at', { ascending: false })
    ]);

    const filter = (data, dateKey) => {
      if (!data || data.length === 0) return []
      const year = 2026
      const m = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth
      return selectedMonth === 13 ? data.filter(i => i[dateKey]?.includes(`${year}`)) : data.filter(i => i[dateKey]?.includes(`${year}-${m}`))
    }

    setSales(filter(sRes.data, 'sale_date'));
    setExpenses(filter(eRes.data, 'purchase_date'));
    setPersonalPayroll(filter(pRes.data, 'pay_date'));
    setBuyouts(filter(bRes.data, 'created_at'));
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- MATH ---
  const bizRev = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const bizExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0)
  const accountsPayable = buyouts.filter(b => b.payment_status === 'unpaid').reduce((sum, b) => sum + Number(b.total_cost), 0)
  const netOperatingIncome = bizRev - bizExp - buyouts.filter(b => b.payment_status === 'paid').reduce((sum, b) => sum + Number(b.total_cost), 0)

  return (
    <div style={{ fontFamily: '"Segoe UI", sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#1e293b' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', paddingBottom: '120px' }}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '900' }}>MANA SOCIAL LLC</h1>
          <button onClick={syncManaPool} disabled={isSyncing} style={{ fontSize: '10px', padding: '8px 12px', borderRadius: '20px', backgroundColor: isSyncing ? '#e2e8f0' : '#4f46e5', color: '#fff', border: 'none', fontWeight: 'bold' }}>
            {isSyncing ? 'SYNCING...' : 'SYNC MANAPOOL'}
          </button>
        </header>

        {activeTab === 'summary' && (
          <>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '12px', borderLeft: '6px solid #4f46e5', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Net Operating Income</div>
              <div style={{ fontSize: '32px', fontWeight: '900' }}>${netOperatingIncome.toLocaleString()}</div>
            </div>
            
            {/* Market Health Indicator */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <div style={{ flex: 1, backgroundColor: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b' }}>GROSS SALES</div>
                <div style={{ fontWeight: 'bold', color: '#10b981' }}>${bizRev.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, backgroundColor: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10px', color: '#64748b' }}>TOTAL FEES/COGS</div>
                <div style={{ fontWeight: 'bold', color: '#ef4444' }}>${bizExp.toLocaleString()}</div>
              </div>
            </div>
          </>
        )}

        {/* --- NAVIGATION --- */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', padding: '15px 0', zIndex: 50 }}>
          {['summary', 'income', 'expense', 'tax', 'payroll'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, border: 'none', background: 'none', color: activeTab === tab ? '#4f46e5' : '#94a3b8', fontWeight: 'bold', fontSize: '10px' }}>{tab.toUpperCase()}</button>
          ))}
        </nav>

        {/* FAB stays for Manual Buyouts */}
        <button style={{ position: 'fixed', bottom: '90px', right: '25px', width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', fontSize: '32px', zIndex: 100 }} onClick={() => setIsQuickAddOpen(true)}>+</button>
      </div>
    </div>
  );
}
