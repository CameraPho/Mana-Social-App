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
    const { data: expData } = await supabase.from('expenses').select('*').gte('purchase_date', `2026-${monthStr}-01`).lte('purchase_date', `2026-${monthStr}-31`);
    if (expData) setExpenses(expData);
    const { data: saleData } = await supabase.from('sales').select('*').gte('sale_date', `2026-${monthStr}-01`).lte('sale_date', `2026-${monthStr}-31`);
    if (saleData) setSavedSales(saleData);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Analyzing structure...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const wb = XLSX.read(data, { type: 'array' }); // Changed to 'array' for better CSV/Excel compatibility
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // FIND HEADER ROW: Resilient "fuzzy" matching
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const rowStr = JSON.stringify(rows[i]).toLowerCase();
          if (rowStr.includes('listing title') || rowStr.includes('gross sales') || rowStr.includes('period') || rowStr.includes('total sales')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          setUploadStatus('Error: Header not recognized. Check the first row.');
          return;
        }

        const rawHeaders = rows[headerRowIndex];
        const dataRows = rows.slice(headerRowIndex + 1);
        
        let total = 0;
        let platform = 'eBay'; // Default

        dataRows.forEach((row: any) => {
          rawHeaders.forEach((h: any, colIdx: number) => {
            const header = String(h || '').toLowerCase().trim();
            const val = row[colIdx];
            
            // Check for any known "Money" columns
            if (
              header.includes('total sales (includes taxes)') || 
              header === 'gross sales' || 
              header === 'total' || 
              header === 'gross transaction amount' ||
              header === 'net sales'
            ) {
              if (val !== undefined && val !== null && String(val).trim() !== "") {
                const num = parseFloat(String(val).replace(/[$, ]/g, ''));
                if (!isNaN(num)) total += num;
              }
            }

            // Set platform based on unique headers
            if (header.includes('period')) platform = 'ManaPool';
            if (header.includes('channel')) platform = 'TCGplayer';
          });
        });

        // SAVE TO DATABASE
        const { error } = await supabase.from('sales').insert([
          { 
            platform, 
            amount: total, 
            sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` 
          }
        ]);

        if (error) throw error;
        setUploadStatus(`Success! Saved ${platform}: $${total.toLocaleString()}`);
        fetchData();
      } catch (err) {
        setUploadStatus('Error: Failed to process or save data.');
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
  const cardStyle = { backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px' }}>
      
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#1e293b' }}>Mana Social</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'imports', 'manage'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#64748b' }}>Revenue</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ color: '#64748b' }}>Expenses</span>
            <span style={{ fontWeight: 'bold', color: '#ef4444' }}>-${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ padding: '16px', borderRadius: '12px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>Net Profit</span>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>${(totalSales - totalExp).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      )}

      {activeTab === 'imports' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Marketplace Upload</h3>
          <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} style={{ width: '100%', marginBottom: '12px' }} />
          {uploadStatus && <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '13px', fontWeight: 'bold' }}>{uploadStatus}</div>}
          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '15px' }}>Compatible with eBay (Cleaned), ManaPool, and TCGplayer reports.</p>
        </div>
      )}

      {activeTab === 'manage' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Monthly Records</h3>
          {savedSales.map(sale => (
            <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{sale.platform}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(sale.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>${Number(sale.amount).toLocaleString()}</span>
                <button onClick={() => deleteSale(sale.id)} style={{ color: '#ef4444', background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
