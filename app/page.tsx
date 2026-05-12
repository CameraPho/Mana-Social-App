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

  // 1. IMPROVED DATA FETCHING
  const fetchData = async () => {
    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth;
    const datePrefix = `2026-${monthStr}`;

    const { data: expData } = await supabase.from('expenses').select('*').like('purchase_date', `%${datePrefix}%`);
    if (expData) setExpenses(expData);

    const { data: saleData } = await supabase.from('sales').select('*').like('sale_date', `%${datePrefix}%`);
    if (saleData) setSavedSales(saleData);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]);

  // 2. THE "DEEP-SCAN" IMPORTER
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Scanning file contents...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let headerRowIndex = -1;
        let platform = '';
        let moneyColIdx = -1;

        // SCAN THE FIRST 20 ROWS FOR KEYWORDS
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i].map(cell => String(cell || '').toLowerCase().trim());
          
          // Check for eBay
          if (row.includes('listing title') || row.some(c => c.includes('total sales (includes taxes)'))) {
            headerRowIndex = i; platform = 'eBay';
            moneyColIdx = row.findIndex(c => c.includes('total sales (includes taxes)'));
            break;
          }
          // Check for TCGplayer
          if (row.includes('channel') && (row.includes('gross sales') || row.includes('net sales'))) {
            headerRowIndex = i; platform = 'TCGplayer';
            moneyColIdx = row.findIndex(c => c === 'gross sales' || c === 'net sales');
            break;
          }
          // Check for ManaPool
          if (row.includes('period') && row.includes('total')) {
            headerRowIndex = i; platform = 'ManaPool';
            moneyColIdx = row.findIndex(c => c === 'total');
            break;
          }
        }

        if (headerRowIndex === -1 || moneyColIdx === -1) {
          setUploadStatus('Error: Could not identify column headers.');
          return;
        }

        const dataRows = rows.slice(headerRowIndex + 1);
        let totalAmount = 0;

        dataRows.forEach(row => {
          const rawValue = row[moneyColIdx];
          if (rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== "") {
            const cleanNum = parseFloat(String(rawValue).replace(/[$, ]/g, ''));
            if (!isNaN(cleanNum)) totalAmount += cleanNum;
          }
        });

        if (totalAmount === 0) {
          setUploadStatus(`Error: Found ${platform} headers but no sales data.`);
          return;
        }

        // SAVE AND VERIFY
        setUploadStatus(`Pushing $${totalAmount.toFixed(2)} to Database...`);
        
        const { error } = await supabase.from('sales').insert([
          { 
            platform, 
            amount: totalAmount, 
            sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` 
          }
        ]);

        if (error) throw error;

        setUploadStatus(`Saved Successfully!`);
        e.target.value = null; // Clear the input
        await fetchData(); // Refresh UI
        
      } catch (err) {
        setUploadStatus('Critical Error: Could not save to Supabase.');
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
  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Calibri, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px' }}>
      
      {/* Branding */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#1e293b' }}>MANA SOCIAL</h1>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'imports', 'manage'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: '12px', borderRadius: '16px', border: 'none', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Summary View */}
      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#64748b' }}>Gross Sales</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ color: '#64748b' }}>Expenses</span>
            <span style={{ fontWeight: 'bold', color: '#ef4444' }}>-${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>Net Profit</span>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>${(totalSales - totalExp).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      )}

      {/* Import View */}
      {activeTab === 'imports' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '15px' }}>Marketplace Importer</h3>
          <input type="file" onChange={handleFileUpload} style={{ width: '100%', marginBottom: '15px' }} />
          {uploadStatus && (
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: uploadStatus.includes('Error') ? '#fef2f2' : '#eff6ff', color: uploadStatus.includes('Error') ? '#991b1b' : '#1e40af', fontWeight: 'bold', fontSize: '13px' }}>
              {uploadStatus}
            </div>
          )}
        </div>
      )}

      {/* Manage View */}
      {activeTab === 'manage' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Monthly Records</h3>
          {savedSales.map(sale => (
            <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{sale.platform}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Uploaded {new Date(sale.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: 'bold' }}>${Number(sale.amount).toLocaleString()}</span>
                <button onClick={() => deleteSale(sale.id)} style={{ color: '#ef4444', border: 'none', background: 'none', fontWeight: 'bold' }}>Delete</button>
              </div>
            </div>
          ))}
          {savedSales.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No records found for this month.</p>}
        </div>
      )}
    </div>
  )
}
