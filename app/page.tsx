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
  const [salesTotal, setSalesTotal] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  useEffect(() => {
    async function getExpenses() {
      const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth;
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .gte('purchase_date', `2026-${monthStr}-01`)
        .lt('purchase_date', `2026-${selectedMonth === 12 ? '01' : monthStr}-31`);
      if (data) setExpenses(data);
    }
    getExpenses();
  }, [selectedMonth]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Scanning TCG/eBay data...');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Expanded detection list for TCGplayer and eBay
        const headerRowIndex = rows.findIndex((row: any) => 
          Array.isArray(row) && row.some(cell => {
            const c = String(cell).toLowerCase();
            return c.includes('transaction creation') || 
                   c.includes('total sales') || 
                   c.includes('total price') || 
                   c.includes('price each') ||
                   c.includes('market price') ||
                   c.includes('order total');
          })
        );

        if (headerRowIndex === -1) {
          // Debugging info if it fails
          const firstRow = rows[0] ? rows[0].join(', ') : 'Empty file';
          setUploadStatus(`Error: Unknown format. Found: ${firstRow.substring(0, 30)}...`);
          return;
        }

        const headers: any = rows[headerRowIndex].map((h: any) => String(h).trim());
        const dataRows = rows.slice(headerRowIndex + 1);
        
        let total = 0;
        dataRows.forEach((row: any) => {
          const rowObj: any = {};
          headers.forEach((header: string, i: number) => { rowObj[header] = row[i]; });

          // Money Column Detection
          const val = rowObj['Gross transaction amount'] || 
                      rowObj['Total sales (Includes taxes)'] || 
                      rowObj['Total price'] || 
                      rowObj['Price Each'] ||
                      rowObj['Market Price'] ||
                      rowObj['Order Total'];
          
          // Only count valid sales (ignore refunds/payouts)
          const type = String(rowObj['Type'] || '').toLowerCase();
          if (val && (type === '' || type.includes('order') || type.includes('sale'))) {
            const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, ''));
            if (!isNaN(num)) total += num;
          }
        });

        setSalesTotal(total);
        setUploadStatus(`Success! $${total.toLocaleString(undefined, {minimumFractionDigits: 2})} identified.`);
      } catch (err) {
        setUploadStatus('Error: Could not read this file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const totalExpenses = expenses.reduce((s, i) => s + Number(i.cost), 0);
  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Calibri, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px' }}>
      
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo.png" style={{ width: '50px' }} alt="Logo" />
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #ddd' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={() => setActiveTab('summary')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', backgroundColor: activeTab === 'summary' ? '#2563eb' : '#e5e7eb', color: activeTab === 'summary' ? 'white' : '#4b5563' }}>Summary</button>
        <button onClick={() => setActiveTab('imports')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', backgroundColor: activeTab === 'imports' ? '#2563eb' : '#e5e7eb', color: activeTab === 'imports' ? 'white' : '#4b5563' }}>Imports</button>
      </div>

      {activeTab === 'summary' ? (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '10px' }}>Dashboard Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Revenue</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${salesTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '10px' }}>
            <span>Expenses</span>
            <span style={{ fontWeight: 'bold', color: '#dc2626' }}>-${totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '16px' }}>
            <span style={{ fontWeight: 'bold' }}>Net Profit</span>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>${(salesTotal - totalExpenses).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      ) : (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Universal Importer</h3>
          <input 
            type="file" 
            accept=".csv, .xlsx, .xls" 
            onChange={handleFileUpload} 
            style={{ width: '100%', marginBottom: '15px' }} 
          />
          {uploadStatus && (
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: uploadStatus.includes('Error') ? '#fef2f2' : '#f0fdf4', color: uploadStatus.includes('Error') ? '#991b1b' : '#166534', fontWeight: 'bold', fontSize: '14px' }}>
              {uploadStatus}
            </div>
          )}
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '20px' }}>
            Works for eBay and TCGplayer files. If it fails, check the error message for the header name it found.
          </p>
        </div>
      )}
    </div>
  )
}
