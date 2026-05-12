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

  // Improved Fetch: Uses GTE/LTE to capture the entire month range
  const fetchData = useCallback(async () => {
    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth;
    const year = 2026;
    const start = `${year}-${monthStr}-01`;
    const end = `${year}-${monthStr}-31`;

    const { data: expData } = await supabase.from('expenses').select('*').gte('purchase_date', start).lte('purchase_date', end);
    if (expData) setExpenses(expData);

    const { data: saleData } = await supabase.from('sales').select('*').gte('sale_date', start).lte('sale_date', end);
    if (saleData) setSavedSales(saleData);
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Processing labels...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let headerRowIndex = -1;
        let platform = 'eBay';

        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i].map(cell => String(cell || '').toLowerCase().trim());
          if (row.includes('listing title') || row.includes('total sales (includes taxes)')) {
            headerRowIndex = i; platform = 'eBay'; break;
          }
          if (row.includes('gross sales')) {
            headerRowIndex = i; platform = 'TCGplayer'; break;
          }
          if (row.includes('period')) {
            headerRowIndex = i; platform = 'ManaPool'; break;
          }
        }

        if (headerRowIndex === -1) {
          setUploadStatus('Error: Could not find data headers.');
          return;
        }

        const headers = rows[headerRowIndex].map(h => String(h || '').trim());
        const dataRows = rows.slice(headerRowIndex + 1);
        
        let totalAmount = 0;
        dataRows.forEach((row: any) => {
          headers.forEach((header, colIdx) => {
            const h = header.toLowerCase();
            if (h === 'total sales (includes taxes)' || h === 'gross sales' || (platform === 'ManaPool' && h === 'total')) {
              const val = row[colIdx];
              if (val !== undefined && val !== null) {
                const num = parseFloat(String(val).replace(/[$, ]/g, ''));
                if (!isNaN(num)) totalAmount += num;
              }
            }
          });
        });

        const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth;
        const { error } = await supabase.from('sales').insert([
          { 
            platform, 
            amount: totalAmount, 
            sale_date: `2026-${monthStr}-01` // Standardized to 1st of month for easy grouping
          }
        ]);

        if (error) throw error;

        setUploadStatus(`Saved $${totalAmount.toLocaleString()} to ${platform}!`);
        e.target.value = null; 
        
        // Wait a beat for Supabase to index, then refresh
        setTimeout(() => fetchData(), 500);
        
      } catch (err) {
        setUploadStatus('Upload failed. Check file content.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteSale = async (id) => {
    await supabase.from('sales').delete().eq('id', id);
    fetchData();
  };

  const totalSales = savedSales.reduce((s, i) => s + Number(i.amount), 0);
  const totalExp = expenses.reduce((s, i) => s + Number(i.cost), 0);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px' }}>
      
      <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#1a365d' }}>MANA SOCIAL</h1>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #ddd' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'imports', 'manage'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === t ? '#2563eb' : 'white', color: activeTab === t ? 'white' : '#64748b' }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#64748b' }}>Gross Revenue</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '18px' }}>${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <span style={{ color: '#64748b' }}>Total Expenses</span>
            <span style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '18px' }}>-${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ padding: '20px', borderRadius: '16px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>Estimated Profit</span>
            <span style={{ fontWeight: '900', color: '#166534', fontSize: '20px' }}>${(totalSales - totalExp).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      )}

      {activeTab === 'imports' && (
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '20px' }}>
          <h3 style={{ marginTop: 0 }}>Import Files</h3>
          <input type="file" onChange={handleFileUpload} style={{ width: '100%', marginBottom: '15px' }} />
          {uploadStatus && <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#1e40af', fontWeight: 'bold' }}>{uploadStatus}</div>}
        </div>
      )}

      {activeTab === 'manage' && (
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '20px' }}>
          <h3 style={{ marginTop: 0 }}>Monthly Records</h3>
          {savedSales.map(sale => (
            <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{sale.platform}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(sale.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontWeight: 'bold' }}>${Number(sale.amount).toLocaleString()}</span>
                <button onClick={() => deleteSale(sale.id)} style={{ color: '#ef4444', border: 'none', background: 'none', fontWeight: 'bold' }}>Delete</button>
              </div>
            </div>
          ))}
          {savedSales.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center' }}>No sales found for this month.</p>}
        </div>
      )}

    </div>
  )
}
