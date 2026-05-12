'use client'
import React, { useState, useEffect } from 'react'
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

  const fetchData = async () => {
    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth;
    const dateQuery = `2026-${monthStr}`;
    const { data: expData } = await supabase.from('expenses').select('*').like('purchase_date', `%${dateQuery}%`);
    if (expData) setExpenses(expData);
    const { data: saleData } = await supabase.from('sales').select('*').like('sale_date', `%${dateQuery}%`);
    if (saleData) setSavedSales(saleData);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Reading...');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });
        let headerRowIndex = -1;
        let platform = 'eBay';
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const row = rows[i].map(cell => String(cell || '').toLowerCase().trim());
          if (row.includes('listing title')) { headerRowIndex = i; platform = 'eBay'; break; }
          if (row.includes('gross sales')) { headerRowIndex = i; platform = 'TCGplayer'; break; }
          if (row.includes('period')) { headerRowIndex = i; platform = 'ManaPool'; break; }
        }
        const headers = rows[headerRowIndex].map(h => String(h || '').trim().toLowerCase());
        const dataRows = rows.slice(headerRowIndex + 1);
        let total = 0;
        dataRows.forEach((row: any) => {
          headers.forEach((h, idx) => {
            if (h === 'total sales (includes taxes)' || h === 'gross sales' || h === 'total') {
              const val = parseFloat(String(row[idx] || 0).replace(/[$, ]/g, ''));
              if (!isNaN(val)) total += val;
            }
          });
        });
        await supabase.from('sales').insert([{ platform, amount: total, sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` }]);
        setUploadStatus(`Success: $${total.toFixed(2)}`);
        fetchData();
      } catch (err) { setUploadStatus('Error processing file.'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteItem = async (id, table) => {
    await supabase.from(table).delete().eq('id', id);
    fetchData();
  };

  const totalSales = savedSales.reduce((s, i) => s + Number(i.amount), 0);
  const totalExp = expenses.reduce((s, i) => s + Number(i.cost), 0);
  const netProfit = totalSales - totalExp;
  const cardStyle = { backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '16px' }}>
      
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '800', fontSize: '18px' }}>MANA SOCIAL</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'upload', 'income', 'expense', 'taxes'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '10px 14px', borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b' }}>
            {t}
          </button>
        ))}
      </div>

      {/* CONTENT AREA - Explicitly rendering based on state */}
      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Revenue</span>
            <span style={{ fontWeight: '700', color: '#2563eb' }}>${totalSales.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span>Expenses</span>
            <span style={{ fontWeight: '700', color: '#ef4444' }}>-${totalExp.toLocaleString()}</span>
          </div>
          <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '800' }}>Net Profit</span>
            <span style={{ fontWeight: '800', color: '#166534' }}>${netProfit.toLocaleString()}</span>
          </div>
        </div>
      )}

      {activeTab === 'upload' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>Upload Reports or Receipts</h3>
          <input type="file" onChange={handleFileUpload} style={{ width: '100%', padding: '10px', border: '2px dashed #e2e8f0', borderRadius: '12px' }} />
          {uploadStatus && <div style={{ marginTop: '10px', fontWeight: '700', color: '#2563eb' }}>{uploadStatus}</div>}
        </div>
      )}

      {activeTab === 'income' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px' }}>Income History</h3>
          {savedSales.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '13px' }}>{s.platform}</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontWeight: '700' }}>${Number(s.amount).toLocaleString()}</span>
                <button onClick={() => deleteItem(s.id, 'sales')} style={{ color: '#ef4444', background: 'none', border: 'none', fontSize: '10px', fontWeight: '700' }}>DEL</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'expense' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px' }}>Expense History</h3>
          {expenses.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '13px' }}>{e.item_name}</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontWeight: '700', color: '#ef4444' }}>-${Number(e.cost).toLocaleString()}</span>
                <button onClick={() => deleteItem(e.id, 'expenses')} style={{ color: '#ef4444', background: 'none', border: 'none', fontSize: '10px', fontWeight: '700' }}>DEL</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'taxes' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px' }}>Tax Liability Estimates</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Federal SE (15.3%)</span>
            <span style={{ fontWeight: '700' }}>${(netProfit * 0.153).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>CA State (1%)</span>
            <span style={{ fontWeight: '700' }}>${(netProfit * 0.01).toFixed(2)}</span>
          </div>
        </div>
      )}

    </div>
  )
}
