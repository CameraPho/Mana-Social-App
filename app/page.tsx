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
  const [expandedCategory, setExpandedCategory] = useState(null);
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
      const text = event.target.result as string;
      // Split by lines and then by commas, handling potential quotes
      const rows = text.split('\n').map(row => row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/));
      
      const headerRowIndex = rows.findIndex(row => 
        row.some(cell => cell.includes('Transaction creation date') || cell.includes('Listing title'))
      );

      if (headerRowIndex === -1) {
        setUploadStatus('Error: Header not found. Use a standard eBay CSV.');
        return;
      }

      const headers = rows[headerRowIndex].map(h => h.trim().replace(/"/g, ''));
      const dataRows = rows.slice(headerRowIndex + 1);
      
      let total = 0;
      dataRows.forEach(row => {
        const rowObj: any = {};
        headers.forEach((header, i) => { rowObj[header] = row[i]; });

        const val = rowObj['Gross transaction amount'] || rowObj['Total sales (Includes taxes)'];
        const type = rowObj['Type'];

        // Only count "Order" types to avoid double-counting payouts
        if (val && (!type || type.includes('Order'))) {
          const num = parseFloat(val.replace(/[$,"]/g, ''));
          if (!isNaN(num)) total += num;
        }
      });

      setEbaySales(total);
      setUploadStatus(`Success! $${total.toLocaleString(undefined, {minimumFractionDigits: 2})} identified.`);
    };
    reader.readAsText(file);
  };

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
        <>
          <div style={cardStyle}>
            <h3 style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '10px' }}>Revenue</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '14px' }}>eBay Gross</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>${ebaySales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '15px' }}>Expense Details</h3>
            {['Equipment', 'Subscriptions', 'Postage', 'Supplies', 'Inventory'].map(cat => (
              <div key={cat} style={{ borderBottom: '1px solid #f3f4f6', padding: '12px 0' }}>
                <div onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight: 'bold' }}>${expenses.filter(e => e.category === cat).reduce((s, i) => s + Number(i.cost), 0).toFixed(2)}</span>
                </div>
                {expandedCategory === cat && (
                  <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    {expenses.filter(e => e.category === cat).map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>{item.item_name}</span>
                        <span>${Number(item.cost).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Import Platform Data</h3>
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{ marginBottom: '10px', width: '100%' }} />
          {uploadStatus && <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#059669', marginTop: '10px' }}>{uploadStatus}</p>}
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '15px' }}>Select an eBay CSV. The app will skip the header notes and calculate the total automatically.</p>
        </div>
      )}
    </div>
  )
}
