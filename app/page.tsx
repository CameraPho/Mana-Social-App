'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMonth, setSelectedMonth] = useState(4); 
  const [expenses, setExpenses] = useState([]);
  const [ebaySales, setEbaySales] = useState(0);
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

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Processing...');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n').map(row => row.split(','));
      
      // Finds the header row by searching for key eBay terms
      const headerRowIndex = rows.findIndex(row => 
        row.some(cell => cell.includes('Transaction creation date') || cell.includes('Total sales'))
      );

      if (headerRowIndex === -1) {
        setUploadStatus('Error: Header not found.');
        return;
      }

      const headers = rows[headerRowIndex].map(h => h.trim().replace(/"/g, ''));
      const dataRows = rows.slice(headerRowIndex + 1);
      
      let total = 0;
      dataRows.forEach(row => {
        const rowObj = {};
        headers.forEach((header, i) => { rowObj[header] = row[i]; });

        const val = rowObj['Gross transaction amount'] || rowObj['Total sales (Includes taxes)'];
        const type = rowObj['Type'];

        if (val && (!type || type.includes('Order'))) {
          const num = parseFloat(val.replace(/[$,"]/g, ''));
          if (!isNaN(num)) total += num;
        }
      });

      setEbaySales(total);
      setUploadStatus(`Success! $${total.toLocaleString(undefined, {minimumFractionDigits: 2})} found.`);
    };
    reader.readAsText(file);
  };

  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px' }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo.png" style={{ width: '45px' }} alt="Logo" />
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={() => setActiveTab('summary')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', backgroundColor: activeTab === 'summary' ? '#2563eb' : '#e5e7eb', color: activeTab === 'summary' ? 'white' : '#4b5563' }}>Summary</button>
        <button onClick={() => setActiveTab('imports')} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', backgroundColor: activeTab === 'imports' ? '#2563eb' : '#e5e7eb', color: activeTab === 'imports' ? 'white' : '#4b5563' }}>Imports</button>
      </div>

      {activeTab === 'summary' ? (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>eBay Revenue</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>${ebaySales.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
          <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
            <h3 style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Expenses</h3>
            <p style={{ fontSize: '20px', fontWeight: 'bold' }}>${expenses.reduce((s, i) => s + Number(i.cost), 0).toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>eBay CSV Import</h3>
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{ width: '100%' }} />
          {uploadStatus && <p style={{ marginTop: '15px', color: '#059669', fontWeight: 'bold' }}>{uploadStatus}</p>}
        </div>
      )}
    </div>
  )
}
