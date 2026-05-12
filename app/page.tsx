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
  const [expenses, setExpenses] = useState([]);
  const [savedSales, setSavedSales] = useState([]);
  const [partnerDeductionsList, setPartnerDeductionsList] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');

  // Deduction Form State
  const [newDeduction, setNewDeduction] = useState({ partner: 'Camera', item: '', amount: '' });

  const fetchData = useCallback(async () => {
    const currentYear = new Date().getFullYear();
    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
    const yearMonth = `${currentYear}-${monthStr}`;

    const { data: saleData } = await supabase.from('sales').select('*');
    const { data: expData } = await supabase.from('expenses').select('*');
    const { data: deductData } = await supabase.from('partner_deductions').select('*');

    // Filter data for current month
    setSavedSales((saleData || []).filter(s => s.sale_date?.includes(yearMonth)));
    setExpenses((expData || []).filter(e => e.purchase_date?.includes(yearMonth)));
    setPartnerDeductionsList((deductData || []).filter(d => d.created_at.includes(yearMonth)));
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddDeduction = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('partner_deductions').insert([
      { 
        partner_name: newDeduction.partner, 
        item_name: newDeduction.item, 
        amount: parseFloat(newDeduction.amount) 
      }
    ]);
    if (!error) {
      setNewDeduction({ ...newDeduction, item: '', amount: '' });
      fetchData();
    }
  };

  const deleteDeduction = async (id) => {
    await supabase.from('partner_deductions').delete().eq('id', id);
    fetchData();
  };

  // Calculations
  const totalSales = savedSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const netProfit = totalSales - totalExp;

  const cameraTotalDeduct = partnerDeductionsList
    .filter(d => d.partner_name === 'Camera')
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const kennyTotalDeduct = partnerDeductionsList
    .filter(d => d.partner_name === 'Kenny')
    .reduce((sum, d) => sum + Number(d.amount), 0);

  // Styles
  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '16px' };
  const inputStyle = { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '12px', border: '1px solid #e2e8f0' };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', color: '#1e293b' }}>
      
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '900' }}>MANA SOCIAL TAX HUB</h1>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px' }}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
        {['summary', 'deductions', 'taxes'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: '1', padding: '12px', borderRadius: '12px', border: 'none', fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b' }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'deductions' && (
        <>
          <div style={cardStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>Log Personal Deduction</h2>
            <form onSubmit={handleAddDeduction}>
              <select style={inputStyle} value={newDeduction.partner} onChange={e => setNewDeduction({...newDeduction, partner: e.target.value})}>
                <option value="Camera">Camera</option>
                <option value="Kenny">Kenny</option>
              </select>
              <input placeholder="Expense Item (e.g., Home Office, Gas)" style={inputStyle} value={newDeduction.item} onChange={e => setNewDeduction({...newDeduction, item: e.target.value})} required />
              <input placeholder="Amount ($)" type="number" style={inputStyle} value={newDeduction.amount} onChange={e => setNewDeduction({...newDeduction, amount: e.target.value})} required />
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>* Keep physical/digital receipts for audit safety</div>
              <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: '800' }}>LOG DEDUCTION</button>
            </form>
          </div>

          {/* Individual Breakdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: '14px', color: '#2563eb' }}>Camera's List</h3>
              <div style={{ fontSize: '18px', fontWeight: '900' }}>${cameraTotalDeduct.toFixed(2)}</div>
              {partnerDeductionsList.filter(d => d.partner_name === 'Camera').map(d => (
                <div key={d.id} style={{ fontSize: '11px', padding: '5px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{d.item_name}</span>
                  <button onClick={() => deleteDeduction(d.id)} style={{ border: 'none', background: 'none', color: '#ef4444' }}>x</button>
                </div>
              ))}
            </div>

            <div style={cardStyle}>
              <h3 style={{ fontSize: '14px', color: '#2563eb' }}>Kenny's List</h3>
              <div style={{ fontSize: '18px', fontWeight: '900' }}>${kennyTotalDeduct.toFixed(2)}</div>
              {partnerDeductionsList.filter(d => d.partner_name === 'Kenny').map(d => (
                <div key={d.id} style={{ fontSize: '11px', padding: '5px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{d.item_name}</span>
                  <button onClick={() => deleteDeduction(d.id)} style={{ border: 'none', background: 'none', color: '#ef4444' }}>x</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'taxes' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Adjusted Tax Liability</h2>
          <div style={{ padding: '15px', backgroundColor: '#f8fafc', borderRadius: '16px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Kenny Adj. Income</span>
              <span style={{ fontWeight: '700' }}>${Math.max(0, (netProfit/2) - kennyTotalDeduct).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Camera Adj. Income</span>
              <span style={{ fontWeight: '700' }}>${Math.max(0, (netProfit/2) - cameraTotalDeduct).toFixed(2)}</span>
            </div>
          </div>
          <p style={{ fontSize: '11px', color: '#64748b' }}>* These deductions reduce your individual taxable share of the LLC's net profit.</p>
        </div>
      )}
    </div>
  )
}
