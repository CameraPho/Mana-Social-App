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
  const [newExp, setNewExp] = useState({ name: '', cost: '', category: 'Supplies' });
  const [newBuyout, setNewBuyout] = useState({ name: '', total_cost: '', notes: '' });
  const [newPayroll, setNewPayroll] = useState({ employee: '', gross_pay: '' });
  const [newDeduction, setNewDeduction] = useState({ partner: 'Camera', item: '', amount: '' });

  const fetchData = useCallback(async () => {
    const currentYear = 2026; 
    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
    const yearMonth = `${currentYear}-${monthStr}`;

    // Parallel fetching for performance
    const [salesRes, expRes, buyoutRes, payrollRes, deductRes] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('buyouts').select('*'),
      supabase.from('payroll').select('*'),
      supabase.from('partner_deductions').select('*')
    ]);

    // Apply strict year-month filtering for 2026
    setSavedSales((salesRes.data || []).filter(s => s.sale_date?.includes(yearMonth)));
    setExpenses((expRes.data || []).filter(e => e.purchase_date?.includes(yearMonth)));
    setBuyouts((buyoutRes.data || []).filter(b => b.created_at?.includes(yearMonth)));
    setPayroll((payrollRes.data || []).filter(p => p.created_at?.includes(yearMonth)));
    setPartnerDeductionsList((deductRes.data || []).filter(d => d.created_at?.includes(yearMonth)));
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Submission Handlers ---
  const handleAddSale = async (e) => {
    e.preventDefault();
    const date = `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01`;
    await supabase.from('sales').insert([{ platform: newSale.platform, amount: parseFloat(newSale.amount), sale_date: date }]);
    setNewSale({ ...newSale, amount: '' });
    fetchData();
  };

  const handleAddExp = async (e) => {
    e.preventDefault();
    const date = `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01`;
    await supabase.from('expenses').insert([{ item_name: newExp.name, cost: parseFloat(newExp.cost), category: newExp.category, purchase_date: date }]);
    setNewExp({ ...newExp, name: '', cost: '' });
    fetchData();
  };

  const handleAddBuyout = async (e) => {
    e.preventDefault();
    await supabase.from('buyouts').insert([{ name: newBuyout.name, total_cost: parseFloat(newBuyout.total_cost), notes: newBuyout.notes }]);
    setNewBuyout({ name: '', total_cost: '', notes: '' });
    fetchData();
  };

  const handleAddPayroll = async (e) => {
    e.preventDefault();
    await supabase.from('payroll').insert([{ employee: newPayroll.employee, gross_pay: parseFloat(newPayroll.gross_pay) }]);
    setNewPayroll({ employee: '', gross_pay: '' });
    fetchData();
  };

  const handleAddDeduction = async (e) => {
    e.preventDefault();
    await supabase.from('partner_deductions').insert([{ partner_name: newDeduction.partner, item_name: newDeduction.item, amount: parseFloat(newDeduction.amount) }]);
    setNewDeduction({ ...newDeduction, item: '', amount: '' });
    fetchData();
  };

  // --- Shared Calculations ---
  const rev = savedSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const baseExpenses = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const buyoutTotal = buyouts.reduce((sum, b) => sum + Number(b.total_cost), 0);
  const payTotal = payroll.reduce((sum, p) => sum + Number(p.gross_pay), 0);
  const ficaTax = payTotal * 0.0765;
  
  const totalCosts = baseExpenses + buyoutTotal + payTotal + ficaTax;
  const netProfit = rev - totalCosts;

  const camDeduct = partnerDeductionsList.filter(d => d.partner_name === 'Camera').reduce((sum, d) => sum + Number(d.amount), 0);
  const kennyDeduct = partnerDeductionsList.filter(d => d.partner_name === 'Kenny').reduce((sum, d) => sum + Number(d.amount), 0);

  const cardStyle = { backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '16px' };
  const inputStyle = { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '16px' }}>
      
      {/* Header */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>MANA SOCIAL 2026</h1>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '8px' }}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Persistent Navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
        {['summary', 'income', 'expense', 'payroll', 'buyouts', 'deductions', 'taxes'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '10px 0', borderRadius: '10px', border: 'none', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Summary View */}
      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Gross Sales</span><span style={{ color: '#2563eb', fontWeight: 'bold' }}>+${rev.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}><span>Direct Expenses</span><span>-${baseExpenses.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}><span>Buyouts</span><span>-${buyoutTotal.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}><span>Payroll & Tax</span><span>-${(payTotal + ficaTax).toFixed(2)}</span></div>
          <hr style={{ margin: '15px 0', borderColor: '#f1f5f9' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', color: netProfit >= 0 ? '#16a34a' : '#dc2626' }}>
            <span>NET PROFIT</span><span>${netProfit.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Income Tab */}
      {activeTab === 'income' && (
        <div style={cardStyle}>
          <h3>Log Sale</h3>
          <form onSubmit={handleAddSale}>
            <select style={inputStyle} value={newSale.platform} onChange={e => setNewSale({...newSale, platform: e.target.value})}>
              <option value="eBay">eBay</option>
              <option value="TCGplayer">TCGplayer</option>
              <option value="Direct">Direct/Local</option>
            </select>
            <input placeholder="Amount" type="number" style={inputStyle} value={newSale.amount} onChange={e => setNewSale({...newSale, amount: e.target.value})} required />
            <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#2563eb', color: '#fff', border: 'none' }}>Save Sale</button>
          </form>
          <div style={{ marginTop: '20px' }}>
            {savedSales.map(s => <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}><span>{s.platform}</span><span style={{ fontWeight: 'bold' }}>${Number(s.amount).toFixed(2)}</span></div>)}
          </div>
        </div>
      )}

      {/* Expense Tab */}
      {activeTab === 'expense' && (
        <div style={cardStyle}>
          <h3>Business Expense</h3>
          <form onSubmit={handleAddExp}>
            <input placeholder="Item (Mailing, Sleeves, etc)" style={inputStyle} value={newExp.name} onChange={e => setNewExp({...newExp, name: e.target.value})} required />
            <input placeholder="Amount" type="number" style={inputStyle} value={newExp.cost} onChange={e => setNewExp({...newExp, cost: e.target.value})} required />
            <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#ef4444', color: '#fff', border: 'none' }}>Save Expense</button>
          </form>
          <div style={{ marginTop: '20px' }}>
            {expenses.map(e => <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}><span>{e.item_name}</span><span style={{ color: '#ef4444' }}>-${Number(e.cost).toFixed(2)}</span></div>)}
          </div>
        </div>
      )}

      {/* Payroll Tab */}
      {activeTab === 'payroll' && (
        <div style={cardStyle}>
          <h3>Staff Payroll</h3>
          <form onSubmit={handleAddPayroll}>
            <input placeholder="Employee Name" style={inputStyle} value={newPayroll.employee} onChange={e => setNewPayroll({...newPayroll, employee: e.target.value})} required />
            <input placeholder="Gross Pay" type="number" style={inputStyle} value={newPayroll.gross_pay} onChange={e => setNewPayroll({...newPayroll, gross_pay: e.target.value})} required />
            <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#2563eb', color: '#fff', border: 'none' }}>Log Pay</button>
          </form>
          <div style={{ marginTop: '20px' }}>
            {payroll.map(p => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}><span>{p.employee}</span><span>${Number(p.gross_pay).toFixed(2)}</span></div>)}
          </div>
        </div>
      )}

      {/* Buyouts Tab */}
      {activeTab === 'buyouts' && (
        <div style={cardStyle}>
          <h3>Inventory Buyouts</h3>
          <form onSubmit={handleAddBuyout}>
            <input placeholder="Collection Name" style={inputStyle} value={newBuyout.name} onChange={e => setNewBuyout({...newBuyout, name: e.target.value})} required />
            <input placeholder="Total Purchase Price" type="number" style={inputStyle} value={newBuyout.total_cost} onChange={e => setNewBuyout({...newBuyout, total_cost: e.target.value})} required />
            <textarea placeholder="Notes (Conditions, Payment Plan)" style={inputStyle} value={newBuyout.notes} onChange={e => setNewBuyout({...newBuyout, notes: e.target.value})} />
            <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#2563eb', color: '#fff', border: 'none' }}>Log Buyout</button>
          </form>
          <div style={{ marginTop: '20px' }}>
            {buyouts.map(b => <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}><span>{b.name}</span><span>${Number(b.total_cost).toFixed(2)}</span></div>)}
          </div>
        </div>
      )}

      {/* Deductions Tab */}
      {activeTab === 'deductions' && (
        <div style={cardStyle}>
          <h3>Partner Personal Deductions</h3>
          <form onSubmit={handleAddDeduction}>
            <select style={inputStyle} value={newDeduction.partner} onChange={e => setNewDeduction({...newDeduction, partner: e.target.value})}>
              <option value="Camera">Camera</option>
              <option value="Kenny">Kenny</option>
            </select>
            <input placeholder="Item (Home Office, Mileage, etc)" style={inputStyle} value={newDeduction.item} onChange={e => setNewDeduction({...newDeduction, item: e.target.value})} required />
            <input placeholder="Amount" type="number" style={inputStyle} value={newDeduction.amount} onChange={e => setNewDeduction({...newDeduction, amount: e.target.value})} required />
            <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#2563eb', color: '#fff', border: 'none' }}>Save Deduction</button>
          </form>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
            <div><label style={{ fontSize: '10px' }}>CAMERA</label><div style={{ fontWeight: 'bold' }}>${camDeduct.toFixed(2)}</div></div>
            <div><label style={{ fontSize: '10px' }}>KENNY</label><div style={{ fontWeight: 'bold' }}>${kennyDeduct.toFixed(2)}</div></div>
          </div>
        </div>
      )}

      {/* Taxes Tab */}
      {activeTab === 'taxes' && (
        <div style={cardStyle}>
          <h3>Adjusted Taxable Income</h3>
          <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kenny Adjusted Share</span><span style={{ fontWeight: 'bold' }}>${Math.max(0, (netProfit/2) - kennyDeduct).toFixed(2)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}><span>Camera Adjusted Share</span><span style={{ fontWeight: 'bold' }}>${Math.max(0, (netProfit/2) - camDeduct).toFixed(2)}</span></div>
          </div>
          <p style={{ fontSize: '11px', color: '#64748b' }}>* Calculations assume 50/50 split of net profit before individual partner deductions are applied.</p>
        </div>
      )}

    </div>
  )
}
