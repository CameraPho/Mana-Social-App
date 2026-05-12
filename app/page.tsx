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
    setUploadStatus('Reading file...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // 1. FIND THE HEADER ROW
        let headerRowIndex = -1;
        let platform = 'eBay';

        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const row = rows[i].map(cell => String(cell || '').toLowerCase().trim());
          if (row.includes('listing title') || row.includes('total sales (includes taxes)')) {
            headerRowIndex = i; platform = 'eBay'; break;
          }
          if (row.includes('gross sales') || row.includes('net sales')) {
            headerRowIndex = i; platform = 'TCGplayer'; break;
          }
          if (row.includes('period') && row.includes('total')) {
            headerRowIndex = i; platform = 'ManaPool'; break;
          }
        }

        if (headerRowIndex === -1) {
          setUploadStatus('Error: Platform headers not found. Check top row.');
          return;
        }

        const headers = rows[headerRowIndex].map(h => String(h || '').trim());
        const dataRows = rows.slice(headerRowIndex + 1);
        
        // 2. EXTRACT THE MONEY
        let totalAmount = 0;
        dataRows.forEach((row: any) => {
          headers.forEach((header, colIdx) => {
            const h = header.toLowerCase();
            if (
              h === 'total sales (includes taxes)' || 
              h === 'gross sales' || 
              (platform === 'ManaPool' && h === 'total')
            ) {
              const val = row[colIdx];
              if (val !== undefined && val !== null) {
                const num = parseFloat(String(val).replace(/[$, ]/g, ''));
                if (!isNaN(num)) totalAmount += num;
              }
            }
          });
        });

        if (totalAmount === 0) {
          setUploadStatus('Warning: Found headers but total was $0.');
          return;
        }

        // 3. SAVE TO SUPABASE
        setUploadStatus(`Saving ${platform} data...`);
        const { error } = await supabase.from('sales').insert([
          { 
            platform, 
            amount: totalAmount, 
            sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` 
          }
        ]);

        if (error) throw error;

        setUploadStatus(`Success! Added ${platform}: $${totalAmount.toLocaleString()}`);
        e.target.value = null; // Reset input
        fetchData(); // Force UI refresh
      } catch (err) {
        setUploadStatus('Database Error: Check connection.');
        console.error(err);
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
    <div style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '16px' }}>
      
      {/* Top Bar */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '800', fontSize: '20px', color: '#0f172a', letterSpacing: '-0.5px' }}>MANA SOCIAL</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '14px', fontWeight: '600' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      {/* Nav Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'imports', 'manage'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: '12px', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
            {t}
          </button>
        ))}
      </div>

      {/* TAB 1: SUMMARY */}
      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', color: '#1e293b' }}>Business Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '500' }}>Total Revenue</span>
            <span style={{ fontWeight: '700', color: '#2563eb' }}>${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ color: '#64748b', fontWeight: '500' }}>Total Expenses</span>
            <span style={{ fontWeight: '700', color: '#ef4444' }}>-${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ padding: '18px', borderRadius: '16px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between', border: '1px solid #dcfce7' }}>
            <span style={{ fontWeight: '800', color: '#166534' }}>Net Profit</span>
            <span style={{ fontWeight: '800', color: '#166534' }}>${(totalSales - totalExp).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      )}

      {/* TAB 2: IMPORTS */}
      {activeTab === 'imports' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px', color: '#1e293b' }}>Universal Importer</h3>
          <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} style={{ width: '100%', marginBottom: '15px', fontSize: '14px' }} />
          {uploadStatus && (
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: uploadStatus.includes('Error') ? '#fef2f2' : '#eff6ff', color: uploadStatus.includes('Error') ? '#991b1b' : '#1e40af', fontSize: '13px', fontWeight: '600', border: '1px solid' }}>
              {uploadStatus}
            </div>
          )}
          <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', fontSize: '11px', color: '#64748b', lineHeight: '1.5' }}>
            <b>Supported Formats:</b><br/>
            • eBay (Manual or Cleaned)<br/>
            • TCGplayer (Direct export)<br/>
            • ManaPool (Period total)
          </div>
        </div>
      )}

      {/* TAB 3: MANAGE */}
      {activeTab === 'manage' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px', color: '#1e293b' }}>Sale Records</h3>
          {savedSales.length > 0 ? savedSales.map(sale => (
            <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#334155' }}>{sale.platform}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(sale.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>${Number(sale.amount).toLocaleString()}</span>
                <button onClick={() => deleteSale(sale.id)} style={{ backgroundColor: '#fff', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          )) : (
            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px' }}>No records for this month yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
