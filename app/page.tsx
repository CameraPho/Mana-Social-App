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

  // 1. FETCH ALL DATA
  const fetchData = async () => {
    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth;
    const startDate = `2026-${monthStr}-01`;
    const endDate = `2026-${monthStr}-31`;

    const { data: expData } = await supabase
      .from('expenses')
      .select('*')
      .gte('purchase_date', startDate)
      .lte('purchase_date', endDate);
    if (expData) setExpenses(expData);

    const { data: saleData } = await supabase
      .from('sales')
      .select('*')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);
    if (saleData) setSavedSales(saleData);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]);

  // 2. FILE UPLOADER (eBay, TCGplayer, ManaPool)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Processing & Saving...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Identify the Header Row
        const headerRowIndex = rows.findIndex((row: any) => 
          Array.isArray(row) && row.some(cell => {
            const c = String(cell).toLowerCase();
            return c.includes('listing title') || c.includes('gross sales') || 
                   c.includes('period') || c.includes('total sales');
          })
        );

        if (headerRowIndex === -1) {
          setUploadStatus('Error: Could not find data headers.');
          return;
        }

        const headers: any = rows[headerRowIndex].map((h: any) => String(h).trim());
        const dataRows = rows.slice(headerRowIndex + 1);
        
        let total = 0;
        dataRows.forEach((row: any) => {
          const rowObj: any = {};
          headers.forEach((header: string, i: number) => { rowObj[header] = row[i]; });

          // Catching all known "Money" columns
          const val = rowObj['Total sales (Includes taxes)'] || 
                      rowObj['Gross Sales'] || 
                      rowObj['Total'] || 
                      rowObj['Gross transaction amount'] ||
                      rowObj['Net Sales'];
          
          if (val) {
            const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$, ]/g, ''));
            if (!isNaN(num)) total += num;
          }
        });

        // Smart Platform Detection
        let platform = 'eBay'; // Default
        if (headers.includes('Period')) platform = 'ManaPool';
        else if (headers.includes('Channel')) platform = 'TCGplayer';
        else if (headers.includes('Listing title')) platform = 'eBay';

        // SAVE TO SUPABASE
        const { error } = await supabase.from('sales').insert([
          { 
            platform, 
            amount: total, 
            sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` 
          }
        ]);

        if (error) throw error;
        
        setUploadStatus(`Saved ${platform}: $${total.toLocaleString()}`);
        fetchData(); // Refresh summary and manage tab
      } catch (err) {
        setUploadStatus('Error: Check file format or Supabase connection.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // 3. DELETE FUNCTION (For the Manage Tab)
  const deleteSale = async (id) => {
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (!error) fetchData();
  };

  const totalSales = savedSales.reduce((s, i) => s + Number(i.amount), 0);
  const totalExp = expenses.reduce((s, i) => s + Number(i.cost), 0);
  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Calibri, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px' }}>
      
      {/* Top Navigation & Month Selector */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo.png" style={{ width: '45px' }} />
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #ddd' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '16px' }}>
        {['summary', 'imports', 'manage'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === t ? '#2563eb' : '#e5e7eb', color: activeTab === t ? 'white' : '#4b5563' }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* SUMMARY TAB */}
      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '15px' }}>Financial Snapshot</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#4b5563' }}>Total Revenue</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ color: '#4b5563' }}>Total Expenses</span>
            <span style={{ fontWeight: 'bold', color: '#dc2626' }}>-${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ padding: '15px', borderRadius: '16px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>Estimated Profit</span>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>${(totalSales - totalExp).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      )}

      {/* IMPORTS TAB */}
      {activeTab === 'imports' && (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Upload Reports</h3>
          <input type="file" accept=".csv, .xlsx" onChange={handleFileUpload} style={{ width: '100%', marginBottom: '10px' }} />
          {uploadStatus && (
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 'bold', fontSize: '14px' }}>
              {uploadStatus}
            </div>
          )}
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '20px' }}>
            Cleaned eBay files, ManaPool CSVs, and TCGplayer reports are all supported.
          </p>
        </div>
      )}

      {/* MANAGE TAB */}
      {activeTab === 'manage' && (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Manage Monthly Sales</h3>
          {savedSales.map(sale => (
            <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{sale.platform}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>Uploaded {new Date(sale.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>${Number(sale.amount).toLocaleString()}</span>
                <button onClick={() => deleteSale(sale.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 'bold' }}>Delete</button>
              </div>
            </div>
          ))}
          {savedSales.length === 0 && <p style={{ color: '#6b7280', fontSize: '14px' }}>No sales data saved for this month yet.</p>}
        </div>
      )}

    </div>
  )
}
