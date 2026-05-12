'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

// Replace with your actual credentials from your Supabase Project Settings
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMonth, setSelectedMonth] = useState(4); 
  const [allExpenses, setAllExpenses] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');

  // 1. THE RECOVERY FETCH: Pulls everything to prevent "Transfer" loss
  const fetchAllData = useCallback(async () => {
    const { data: expData, error: expErr } = await supabase.from('expenses').select('*');
    const { data: saleData, error: saleErr } = await supabase.from('sales').select('*');

    if (!expErr) setAllExpenses(expData || []);
    if (!saleErr) setAllSales(saleData || []);
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // 2. CLIENT-SIDE FILTERING: Ensures UI matches the selected month perfectly
  const filteredSales = useMemo(() => {
    return allSales.filter(s => {
      const date = new Date(s.sale_date);
      return date.getMonth() + 1 === selectedMonth;
    });
  }, [allSales, selectedMonth]);

  const filteredExpenses = useMemo(() => {
    return allExpenses.filter(e => {
      const date = new Date(e.purchase_date);
      return date.getMonth() + 1 === selectedMonth;
    });
  }, [allExpenses, selectedMonth]);

  // 3. UPLOAD LOGIC
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Processing...');

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

        // Use a standard YYYY-MM-DD format for Supabase
        const entryDate = `2026-${selectedMonth.toString().padStart(2, '0')}-01`;

        await supabase.from('sales').insert([{ 
          platform, 
          amount: total, 
          sale_date: entryDate 
        }]);

        setUploadStatus(`Success! $${total.toFixed(2)} added.`);
        fetchAllData(); // Refresh the full set
      } catch (err) { setUploadStatus('Error reading report.'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteItem = async (id, table) => {
    await supabase.from(table).delete().eq('id', id);
    fetchAllData();
  };

  // 4. CALCULATIONS
  const totalRev = filteredSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalExp = filteredExpenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const profit = totalRev - totalExp;

  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', color: '#1e293b' }}>
      
      {/* Brand Header */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>MANA SOCIAL</h1>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
        {['summary', 'upload', 'income', 'expense', 'taxes'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: '1 1 auto', padding: '12px', borderRadius: '14px', border: 'none', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab Switcher */}
      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#64748b' }}>Revenue</span>
            <span style={{ fontWeight: '800', color: '#2563eb' }}>${totalRev.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <span style={{ color: '#64748b' }}>Expenses</span>
            <span style={{ fontWeight: '800', color: '#ef4444' }}>-${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ padding: '20px', borderRadius: '18px', backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '900', color: '#166534' }}>NET PROFIT</span>
            <span style={{ fontWeight: '900', color: '#166534' }}>${profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      )}

      {activeTab === 'upload' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Upload Reports</h2>
          <input type="file" onChange={handleFileUpload} style={{ width: '100%', padding: '15px', border: '2px dashed #cbd5e1', borderRadius: '16px' }} />
          {uploadStatus && <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: '700', textAlign: 'center' }}>{uploadStatus}</div>}
          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px' }}>*Supports eBay, TCGplayer, and ManaPool CSV/Excel files.</p>
        </div>
      )}

      {activeTab === 'income' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Income Ledger ({filteredSales.length})</h2>
          {filteredSales.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div><div style={{ fontWeight: '700' }}>{s.platform}</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>{s.sale_date}</div></div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><span style={{ fontWeight: '800' }}>${Number(s.amount).toFixed(2)}</span><button onClick={() => deleteItem(s.id, 'sales')} style={{ color: '#ef4444', background: 'none', border: 'none', fontSize: '10px', fontWeight: '800' }}>DEL</button></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'expense' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Expense Ledger ({filteredExpenses.length})</h2>
          {filteredExpenses.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div><div style={{ fontWeight: '700' }}>{e.item_name}</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>{e.purchase_date}</div></div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><span style={{ fontWeight: '800', color: '#ef4444' }}>-${Number(e.cost).toFixed(2)}</span><button onClick={() => deleteItem(e.id, 'expenses')} style={{ color: '#ef4444', background: 'none', border: 'none', fontSize: '10px', fontWeight: '800' }}>DEL</button></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'taxes' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Tax Estimates</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Federal (15.3%)</span><span style={{ fontWeight: '800' }}>${(profit * 0.153).toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>California (1%)</span><span style={{ fontWeight: '800' }}>${(profit * 0.01).toFixed(2)}</span></div>
        </div>
      )}

    </div>
  )
}
