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
  const [selectedMonth, setSelectedMonth] = useState(4); 
  const [expenses, setExpenses] = useState([]);
  const [savedSales, setSavedSales] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');

  // 1. DATA BRIDGE: Fetches all data and filters locally to prevent "vanishing" data
  const fetchData = useCallback(async () => {
    const { data: expData } = await supabase.from('expenses').select('*');
    const { data: saleData } = await supabase.from('sales').select('*');

    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
    const yearMonth = `2026-${monthStr}`;

    // Filters for both database style (YYYY-MM-DD) and common report styles (MM/DD/YYYY)
    const filteredExpenses = (expData || []).filter(e => 
      e.purchase_date.includes(yearMonth) || e.purchase_date.includes(`${selectedMonth}/`)
    );
    
    const filteredSales = (saleData || []).filter(s => {
      const dbDate = s.sale_date || '';
      const createdAt = s.created_at ? new Date(s.created_at).getMonth() + 1 : null;
      return dbDate.includes(yearMonth) || createdAt === selectedMonth;
    });

    setExpenses(filteredExpenses);
    setSavedSales(filteredSales);
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 2. UPLOAD LOGIC: Recognizes eBay, TCGplayer, and ManaPool automatically
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Syncing with Supabase...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let headerIdx = -1;
        let platform = 'eBay';

        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const r = rows[i].map(c => String(c || '').toLowerCase().trim());
          if (r.includes('listing title')) { headerIdx = i; platform = 'eBay'; break; }
          if (r.includes('gross sales')) { headerIdx = i; platform = 'TCGplayer'; break; }
          if (r.includes('period')) { headerIdx = i; platform = 'ManaPool'; break; }
        }

        const headers = rows[headerIdx].map(h => String(h || '').trim().toLowerCase());
        let total = 0;
        rows.slice(headerIdx + 1).forEach(row => {
          headers.forEach((h, idx) => {
            if (['total sales (includes taxes)', 'gross sales', 'total'].includes(h)) {
              const val = parseFloat(String(row[idx] || 0).replace(/[$, ]/g, ''));
              if (!isNaN(val)) total += val;
            }
          });
        });

        await supabase.from('sales').insert([{ 
          platform, 
          amount: total, 
          sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` 
        }]);

        setUploadStatus(`Success: $${total.toFixed(2)} Added to ${platform}`);
        fetchData(); 
      } catch (err) { 
        setUploadStatus('Error: Ensure file is a valid CSV or Excel report.'); 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteItem = async (id, table) => {
    await supabase.from(table).delete().eq('id', id);
    fetchData();
  };

  // 3. AGGREGATES: Forces the data to "transfer" to the Summary and Tax tabs
  const totalSales = savedSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const netProfit = totalSales - totalExp;

  // 4. UI STYLING
  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '16px' };
  const navBtnStyle = (t) => ({ 
    flex: '1 1 auto', padding: '12px', borderRadius: '14px', border: 'none', fontWeight: '800', fontSize: '11px', 
    textTransform: 'uppercase', backgroundColor: activeTab === t ? '#2563eb' : '#fff', 
    color: activeTab === t ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer' 
  });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', color: '#1e293b' }}>
      
      {/* Brand Header */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '-1px' }}>MANA SOCIAL</h1>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: '600' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
            <option value={6}>June</option>
          </select>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
        {['summary', 'upload', 'income', 'expense', 'taxes'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={navBtnStyle(t)}>{t}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: '350px' }}>
        {activeTab === 'summary' && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', marginBottom: '15px' }}>Monthly Performance</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontWeight: '600' }}>Gross Revenue</span>
              <span style={{ fontWeight: '800', color: '#2563eb' }}>${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontWeight: '600' }}>Business Expenses</span>
              <span style={{ fontWeight: '800', color: '#ef4444' }}>-${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div style={{ padding: '20px', borderRadius: '18px', backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '900', color: '#166534' }}>NET PROFIT</span>
              <span style={{ fontWeight: '900', color: '#166534' }}>${netProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Upload or Take Photo</h2>
            <input type="file" onChange={handleFileUpload} style={{ width: '100%', padding: '20px', border: '2px dashed #cbd5e1', borderRadius: '16px', backgroundColor: '#fdfdfd' }} />
            {uploadStatus && <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: '700', textAlign: 'center' }}>{uploadStatus}</div>}
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '15px', textAlign: 'center' }}>Accepts eBay, TCGplayer, ManaPool CSVs, or receipt photos.</p>
          </div>
        )}

        {activeTab === 'income' && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Marketplace Income</h2>
            {savedSales.length > 0 ? savedSales.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div><div style={{ fontWeight: '700' }}>{s.platform}</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>{new Date(s.created_at).toLocaleDateString()}</div></div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><span style={{ fontWeight: '800' }}>${Number(s.amount).toFixed(2)}</span><button onClick={() => deleteItem(s.id, 'sales')} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '6px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '800' }}>DEL</button></div>
              </div>
            )) : <p style={{ textAlign: 'center', color: '#94a3b8' }}>No sales records for this period.</p>}
          </div>
        )}

        {activeTab === 'expense' && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Expense History</h2>
            {expenses.length > 0 ? expenses.map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div><div style={{ fontWeight: '700' }}>{e.item_name}</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>{e.purchase_date}</div></div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><span style={{ fontWeight: '800', color: '#ef4444' }}>-${Number(e.cost).toFixed(2)}</span><button onClick={() => deleteItem(e.id, 'expenses')} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '6px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '800' }}>DEL</button></div>
              </div>
            )) : <p style={{ textAlign: 'center', color: '#94a3b8' }}>No expenses found for this period.</p>}
          </div>
        )}

        {activeTab === 'taxes' && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Quarterly Tax Liability</h2>
            <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Federal Estimate (15.3%)</span><span style={{ fontWeight: '800' }}>${(netProfit * 0.153).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CA State Estimate (1%)</span><span style={{ fontWeight: '800' }}>${(netProfit * 0.01).toFixed(2)}</span></div>
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '15px' }}>*Based on current net profit for the selected month.</p>
          </div>
        )}
      </div>
    </div>
  )
}
