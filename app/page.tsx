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
    setUploadStatus('Processing...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result as string;
      
      // Smart CSV Parsing (Works for eBay and TCGplayer CSVs)
      const rows = text.split('\n').map(row => row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/));
      
      const headerRowIndex = rows.findIndex(row => 
        row.some(cell => {
          const c = cell.toLowerCase();
          return c.includes('transaction creation') || c.includes('total sales') || c.includes('total price');
        })
      );

      if (headerRowIndex === -1) {
        setUploadStatus('Error: File format not recognized.');
        return;
      }

      const headers = rows[headerRowIndex].map(h => h.trim().replace(/"/g, ''));
      const dataRows = rows.slice(headerRowIndex + 1);
      
      let total = 0;
      dataRows.forEach(row => {
        const rowObj: any = {};
        headers.forEach((header, i) => { rowObj[header] = row[i]; });

        const val = rowObj['Gross transaction amount'] || 
                    rowObj['Total sales (Includes taxes)'] || 
                    rowObj['Total price'] || 
                    rowObj['Price Each'];

        if (val && (!rowObj['Type'] || rowObj['Type'].includes('Order'))) {
          const num = parseFloat(val.replace(/[$,"]/g, ''));
          if (!isNaN(num)) total += num;
        }
      });

      setSalesTotal(total);
      setUploadStatus(`Success! $${total.toLocaleString()} found.`);
    };
    reader.readAsText(file);
  };

  const totalExpenses = expenses.reduce((s, i) => s + Number(i.cost), 0);
  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Calibri, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px' }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo.png" style={{ width: '45px' }} />
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
          <h3 style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Financials</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
            <span>Revenue</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${salesTotal.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '10px' }}>
            <span>Expenses</span>
            <span style={{ fontWeight: 'bold', color: '#dc2626' }}>-${totalExpenses.toLocaleString()}</span>
          </div>
          <div style={{ marginTop: '10px', padding: '10px', borderRadius: '12px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold' }}>Net Profit</span>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>${(salesTotal - totalExpenses).toLocaleString()}</span>
          </div>
        </div>
      ) : (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Universal Importer</h3>
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{ width: '100%' }} />
          {uploadStatus && <p style={{ marginTop: '15px', color: '#059669', fontWeight: 'bold' }}>{uploadStatus}</p>}
        </div>
      )}
    </div>
  )
}
