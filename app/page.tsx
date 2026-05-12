'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'

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
      const text = event.target.result;
      const lines = text.split('\n');
      
      // Auto-detect header: Skip eBay notes if present
      const ebayNoteIndex = lines.findIndex(line => line.includes('Transaction creation date'));
      const csvData = ebayNoteIndex !== -1 ? lines.slice(ebayNoteIndex).join('\n') : text;

      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          let totalGross = 0;
          results.data.forEach(row => {
            const amountValue = row['Gross transaction amount'] || row['Total sales (Includes taxes)'] || row['Total price'];
            const isOrder = !row['Type'] || row['Type'] === 'Order';

            if (amountValue && isOrder) {
              const cleanAmount = parseFloat(amountValue.toString().replace(/[$,]/g, ''));
              if (!isNaN(cleanAmount)) {
                totalGross += cleanAmount;
              }
            }
          });
          
          setEbaySales(totalGross);
          setUploadStatus(`Success! Found $${totalGross.toLocaleString(undefined, {minimumFractionDigits: 2})} in sales.`);
        },
        error: () => setUploadStatus('Error parsing CSV.')
      });
    };
    reader.readAsText(file);
  };

  const categories = ['Equipment', 'Subscriptions', 'Postage', 'Supplies', 'Inventory'];
  const getCategoryTotal = (cat) => 
    expenses.filter(e => e.category === cat).reduce((sum, item) => sum + Number(item.cost), 0);
  const totalOut = expenses.reduce((sum, item) => sum + Number(item.cost), 0);

  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Segoe UI, Roboto, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px' }}>
      
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>
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
            <h3 style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px', textTransform: 'uppercase' }}>Platform Revenue</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>eBay Gross Sales</span>
              <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${ebaySales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px', textTransform: 'uppercase' }}>Expense Breakdown</h3>
            {categories.map(cat => (
              <div key={cat} style={{ borderBottom: '1px solid #f3f4f6', padding: '10px 0' }}>
                <div onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight: 'bold' }}>${getCategoryTotal(cat).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                {expandedCategory === cat && (
                  <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '10px', fontSize: '13px' }}>
                    {expenses.filter(e => e.category === cat).map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>{item.item_name}</span>
                        <span>${Number(item.cost).toFixed(2)}</span>
                      </div>
                    ))}
                    {expenses.filter(e => e.category === cat).length === 0 && <span style={{ color: '#9ca3af' }}>No entries found.</span>}
                  </div>
                )}
              </div>
            ))}
            <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '2px solid #eee', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Total Expenses</span>
              <span>${totalOut.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>
        </>
      ) : (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Upload eBay Report</h3>
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{ marginBottom: '15px', width: '100%' }} />
          {uploadStatus && (
            <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: uploadStatus.includes('Success') ? '#f0fdf4' : '#fef2f2', color: uploadStatus.includes('Success') ? '#166534' : '#991b1b', fontWeight: 'bold', fontSize: '14px' }}>
              {uploadStatus}
            </div>
          )}
        </div>
      )}

      <div style={{ backgroundColor: '#fff1f2', padding: '15px', borderRadius: '24px', border: '1px solid #fecaca' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#991b1b', fontWeight: 'bold' }}>LIABILITY: Brett Bruhanski</p>
        <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#991b1b' }}>$1,000.00 Owed</p>
      </div>
    </div>
  )
}
