'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); 
  
  // Data States
  const [savedSales, setSavedSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [buyouts, setBuyouts] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [partnerDeductionsList, setPartnerDeductionsList] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');

  // Form States
  const [newSale, setNewSale] = useState({ platform: 'eBay', amount: '' });
  const [newExp, setNewExp] = useState({ name: '', cost: '' });

  const fetchData = useCallback(async () => {
    const currentYear = 2026;
    const [salesRes, expRes, buyoutRes, payrollRes, deductRes] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('created_at', { ascending: false }),
      supabase.from('buyouts').select('*').order('created_at', { ascending: false }),
      supabase.from('payroll').select('*').order('created_at', { ascending: false }),
      supabase.from('partner_deductions').select('*').order('created_at', { ascending: false })
    ]);

    const filterByDate = (data, dateField) => {
      if (!data) return [];
      if (selectedMonth === 13) return data.filter(item => item[dateField]?.includes(`${currentYear}`));
      const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
      return data.filter(item => item[dateField]?.includes(`${currentYear}-${monthStr}`));
    };

    setSavedSales(filterByDate(salesRes.data, 'sale_date'));
    setExpenses(filterByDate(expRes.data, 'purchase_date'));
    setBuyouts(filterByDate(buyoutRes.data, 'created_at'));
    setPayroll(filterByDate(payrollRes.data, 'created_at'));
    setPartnerDeductionsList(filterByDate(deductRes.data, 'created_at'));
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- DELETE & EDIT LOGIC ---
  const handleDelete = async (id, table) => {
    if (confirm("Delete this entry?")) {
      await supabase.from(table).delete().eq('id', id);
      fetchData();
    }
  };

  const handleUpdate = async (id, table, field, value) => {
    const newValue = prompt(`Edit ${field}:`, value);
    if (newValue !== null) {
      const updateObj = {};
      updateObj[field] = field.includes('amount') || field.includes('cost') || field.includes('pay') ? parseFloat(newValue) : newValue;
      await supabase.from(table).update(updateObj).eq('id', id);
      fetchData();
    }
  };

  // --- CALCS ---
  const rev = savedSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const baseExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const bTotal = buyouts.reduce((sum, b) => sum + Number(b.total_cost), 0);
  const pTotal = payroll.reduce((sum, p) => sum + Number(p.gross_pay), 0);
  const netProfit = rev - (baseExp + bTotal + pTotal + (pTotal * 0.0765));

  const cardStyle = { backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '16px' };
  const inputStyle = { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' };
  const listBtnStyle = { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '16px' }}>
      
      {/* Selector */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '18px' }}>MANA SOCIAL</h1>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '8px' }}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
            ))}
            <option value={13}>FULL YEAR 2026</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
        {['summary', 'income', 'expense', 'payroll', 'buyouts', 'taxes'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '10px 0', borderRadius: '10px', border: 'none', fontSize: '11px', fontWeight: 'bold', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b' }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* SUMMARY */}
      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <h2>Net Profit: ${netProfit.toFixed(2)}</h2>
          <div style={{ fontSize: '14px' }}>
            <p>Revenue: ${rev.toFixed(2)}</p>
            <p>Total Costs: -${(baseExp + bTotal + pTotal).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* INCOME TABLE & EDITS */}
      {activeTab === 'income' && (
        <>
          <div style={cardStyle}>
            <h3>Manual Entry</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await supabase.from('sales').insert([{ platform: newSale.platform, amount: parseFloat(newSale.amount), sale_date: `2026-01-01` }]);
              setNewSale({ ...newSale, amount: '' }); fetchData();
            }}>
              <input placeholder="Amount" type="number" style={inputStyle} value={newSale.amount} onChange={e => setNewSale({...newSale, amount: e.target.value})} required />
              <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#2563eb', color: '#fff', border: 'none' }}>Add Sale</button>
            </form>
          </div>
          <div style={cardStyle}>
            <h3>Manage Sales</h3>
            {savedSales.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span onClick={() => handleUpdate(s.id, 'sales', 'platform', s.platform)} style={{ cursor: 'pointer' }}>{s.platform}</span>
                <div>
                  <span onClick={() => handleUpdate(s.id, 'sales', 'amount', s.amount)} style={{ fontWeight: 'bold', marginRight: '15px', cursor: 'pointer' }}>${Number(s.amount).toFixed(2)}</span>
                  <button onClick={() => handleDelete(s.id, 'sales')} style={{ color: '#ef4444', ...listBtnStyle }}>DEL</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* EXPENSE TABLE & EDITS */}
      {activeTab === 'expense' && (
        <>
          <div style={cardStyle}>
            <h3>Manual Expense</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await supabase.from('expenses').insert([{ item_name: newExp.name, cost: parseFloat(newExp.cost), purchase_date: `2026-01-01` }]);
              setNewExp({ name: '', cost: '' }); fetchData();
            }}>
              <input placeholder="Item" style={inputStyle} value={newExp.name} onChange={e => setNewExp({...newExp, name: e.target.value})} required />
              <input placeholder="Cost" type="number" style={inputStyle} value={newExp.cost} onChange={e => setNewExp({...newExp, cost: e.target.value})} required />
              <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#ef4444', color: '#fff', border: 'none' }}>Add Expense</button>
            </form>
          </div>
          <div style={cardStyle}>
            <h3>Manage Expenses</h3>
            {expenses.map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span onClick={() => handleUpdate(e.id, 'expenses', 'item_name', e.item_name)} style={{ cursor: 'pointer' }}>{e.item_name}</span>
                <div>
                  <span onClick={() => handleUpdate(e.id, 'expenses', 'cost', e.cost)} style={{ color: '#ef4444', marginRight: '15px', cursor: 'pointer' }}>-${Number(e.cost).toFixed(2)}</span>
                  <button onClick={() => handleDelete(e.id, 'expenses')} style={{ color: '#ef4444', ...listBtnStyle }}>DEL</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Similar management sections added for Payroll & Buyouts... */}

    </div>
  )
}
