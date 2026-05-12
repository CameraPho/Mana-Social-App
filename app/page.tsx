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
    setUploadStatus('Reading File...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // UNIVERSAL DETECTOR
        const headerRowIndex = rows.findIndex((row: any) => 
          Array.isArray(row) && row.some(cell => {
            const c = String(cell).toLowerCase();
            return c === 'total' || c.includes('gross sales') || c.includes('period') || c.includes('transaction creation');
          })
        );

        if (headerRowIndex === -1) {
          setUploadStatus('Error: Could not find data headers.');
          return;
        }

        const headers = rows[headerRowIndex].map((h: any) => String(h).trim());
        const dataRows = rows.slice(headerRowIndex + 1);
        
        let total = 0;
        dataRows.forEach((row: any) => {
          const rowObj: any = {};
          headers.forEach((header, i) => { rowObj[header] = row[i]; });

          // Priority order for money columns
          const val = rowObj['Total'] || rowObj['Gross Sales'] || rowObj['Gross transaction amount'] || rowObj['Net Sales'];
          
          if (val) {
            const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, ''));
            if (!isNaN(num)) total += num;
          }
        });

        if (total === 0) {
          setUploadStatus('Error: Total calculated as $0. Check file.');
          return;
        }

        let platform = headers.includes('Period') ? 'ManaPool' : headers.includes('Channel') ? 'TCGplayer' : 'eBay';

        await supabase.from('sales').insert([{ 
          platform, 
          amount: total, 
          sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` 
        }]);

        setUploadStatus(`Success! Saved ${platform}: $${total.toFixed(2)}`);
        fetchData();
      } catch (err) {
        setUploadStatus('System Error.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const deleteSale = async (id) => {
    await supabase.from('sales').delete().eq('id', id);
    fetchData();
  };

  const totalSales = savedSales.reduce((s, i) => s + Number(i.amount), 0);
  const totalExp = expenses.reduce((s, i) => s + Number(i.cost), 0);
  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Calibri, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px' }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo.png" style={{ width: '45px' }} />
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '5px', marginBottom: '16px' }}>
        {['summary', 'imports', 'manage'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '11px', backgroundColor: activeTab === tab ? '#2563eb' : '#e5e7eb', color: activeTab === tab ? 'white' : '#4b5563' }}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Profit & Loss</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '15px 0' }}>
            <span>Revenue</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${totalSales.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span>Expenses</span>
            <span style={{ fontWeight: 'bold', color: '#dc2626' }}>-${totalExp.toLocaleString()}</span>
          </div>
          <div style={{ padding: '15px', borderRadius: '16px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold' }}>Net Profit</span>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>${(totalSales - totalExp).toLocaleString()}</span>
          </div>
        </div>
      )}

      {activeTab === 'imports' && (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Import Sales</h3>
          <input type="file" accept=".csv, .xlsx" onChange={handleFileUpload} style={{ width: '100%' }} />
          {uploadStatus && <div style={{ marginTop: '15px', padding: '10px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 'bold' }}>{uploadStatus}</div>}
        </div>
      )}

      {activeTab === 'manage' && (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Database Records</h3>
          {savedSales.map(sale => (
            <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{sale.platform}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>ID: {sale.id.slice(0,8)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 'bold' }}>${Number(sale.amount).toFixed(2)}</span>
                <button onClick={() => deleteSale(sale.id)} style={{ color: '#dc2626', border: 'none', background: 'none', fontSize: '12px' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
