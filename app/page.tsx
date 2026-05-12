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

  // 1. Fetch data function (reusable)
  const fetchData = async () => {
    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth;
    const startDate = `2026-${monthStr}-01`;
    const endDate = `2026-${monthStr}-31`;

    const { data: expData } = await supabase.from('expenses').select('*').gte('purchase_date', startDate).lte('purchase_date', endDate);
    if (expData) setExpenses(expData);

    const { data: saleData } = await supabase.from('sales').select('*').gte('sale_date', startDate).lte('sale_date', endDate);
    if (saleData) setSavedSales(saleData || []);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]);

  // 2. The Universal Uploader
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Reading file...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const headerRowIndex = rows.findIndex((row: any) => 
          Array.isArray(row) && row.some(cell => {
            const c = String(cell).toLowerCase().trim();
            return c.includes('listing title') || c.includes('gross sales') || c.includes('period') || c.includes('total sales');
          })
        );

        if (headerRowIndex === -1) {
          setUploadStatus('Error: Missing "Listing title" or "Total" headers.');
          return;
        }

        const headers = rows[headerRowIndex].map((h: any) => String(h || '').trim());
        const dataRows = rows.slice(headerRowIndex + 1);
        
        let total = 0;
        dataRows.forEach((row: any) => {
          const rowObj: any = {};
          headers.forEach((header: string, i: number) => { rowObj[header] = row[i]; });

          const val = rowObj['Total sales (Includes taxes)'] || rowObj['Gross Sales'] || rowObj['Total'] || rowObj['Gross transaction amount'] || rowObj['Net Sales'];
          
          if (val !== undefined && val !== null && String(val).trim() !== "") {
            const num = parseFloat(String(val).replace(/[$, ]/g, ''));
            if (!isNaN(num)) total += num;
          }
        });

        let platform = 'eBay';
        if (headers.some(h => h.toLowerCase().includes('period'))) platform = 'ManaPool';
        else if (headers.some(h => h.toLowerCase().includes('channel'))) platform = 'TCGplayer';

        const { error } = await supabase.from('sales').insert([{ platform, amount: total, sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` }]);

        if (error) throw error;
        setUploadStatus(`Success! Added $${total.toFixed(2)}`);
        fetchData();
      } catch (err) {
        setUploadStatus('Upload failed. Try again.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const deleteSale = async (id) => {
    await supabase.from('sales').delete().eq('id', id);
    fetchData();
  };

  // Calculations based on current state
  const totalSalesVal = savedSales.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalExpVal = expenses.reduce((acc, curr) => acc + Number(curr.cost || 0), 0);

  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Calibri, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '16px' }}>
      
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src="/logo.png" style={{ width: '45px' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={fetchData} style={{ background: 'none', border: 'none', fontSize: '18px' }}>🔄</button>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px' }}>
              <option value={3}>March</option>
              <option value={4}>April</option>
              <option value={5}>May</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '5px', marginBottom: '16px' }}>
        {['summary', 'imports', 'manage'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '11px', backgroundColor: activeTab === t ? '#2563eb' : '#e5e7eb', color: activeTab === t ? 'white' : '#4b5563' }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Financials</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '15px 0' }}>
            <span>Total Sales</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${totalSalesVal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span>Expenses</span>
            <span style={{ fontWeight: 'bold', color: '#dc2626' }}>-${totalExpVal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ padding: '15px', borderRadius: '16px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold' }}>Net Profit</span>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>${(totalSalesVal - totalExpVal).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      )}

      {activeTab === 'imports' && (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Universal Importer</h3>
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{ width: '100%', marginBottom: '10px' }} />
          {uploadStatus && <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '14px' }}>{uploadStatus}</div>}
        </div>
      )}

      {activeTab === 'manage' && (
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Records</h3>
          {savedSales.map(sale => (
            <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
              <div><b>{sale.platform}</b><br/><small>{new Date(sale.created_at).toLocaleDateString()}</small></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <b>${Number(sale.amount).toLocaleString()}</b>
                <button onClick={() => deleteSale(sale.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '5px 10px', borderRadius: '8px' }}>X</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
