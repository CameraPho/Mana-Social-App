'use client'
import React, { useState, useEffect, useCallback } from 'react'
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
  const fetchData = useCallback(async () => {
    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth;
    const yearMonth = `2026-${monthStr}`;

    // Fetch Expenses
    const { data: expData, error: expErr } = await supabase
      .from('expenses')
      .select('*')
      .filter('purchase_date', 'gte', `${yearMonth}-01`)
      .filter('purchase_date', 'lte', `${yearMonth}-31`);
    
    if (!expErr) setExpenses(expData || []);

    // Fetch Sales
    const { data: saleData, error: saleErr } = await supabase
      .from('sales')
      .select('*')
      .filter('sale_date', 'gte', `${yearMonth}-01`)
      .filter('sale_date', 'lte', `${yearMonth}-31`);
    
    if (!saleErr) setSavedSales(saleData || []);
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Reading file contents...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Identify Header Row
        let headerRowIndex = -1;
        let platform = 'eBay';

        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const rowStr = rows[i].join(' ').toLowerCase();
          if (rowStr.includes('listing title') || rowStr.includes('total sales')) {
            headerRowIndex = i; platform = 'eBay'; break;
          }
          if (rowStr.includes('gross sales') || rowStr.includes('net sales')) {
            headerRowIndex = i; platform = 'TCGplayer'; break;
          }
          if (rowStr.includes('period') && rowStr.includes('total')) {
            headerRowIndex = i; platform = 'ManaPool'; break;
          }
        }

        if (headerRowIndex === -1) {
          setUploadStatus('Error: Could not find data headers.');
          return;
        }

        const headers = rows[headerRowIndex].map(h => String(h || '').trim());
        const dataRows = rows.slice(headerRowIndex + 1);
        
        let totalAmount = 0;
        dataRows.forEach((row: any) => {
          headers.forEach((header, colIdx) => {
            const h = header.toLowerCase();
            if (h.includes('total sales (includes taxes)') || h === 'gross sales' || (platform === 'ManaPool' && h === 'total')) {
              const val = row[colIdx];
              if (val) {
                const num = parseFloat(String(val).replace(/[$, ]/g, ''));
                if (!isNaN(num)) totalAmount += num;
              }
            }
          });
        });

        if (totalAmount === 0) {
          setUploadStatus('Error: Parsed total was $0.00');
          return;
        }

        // SAVE TO SUPABASE
        setUploadStatus(`Uploading ${platform} total: $${totalAmount.toFixed(2)}...`);
        
        const { error: insertError } = await supabase.from('sales').insert([
          { 
            platform, 
            amount: totalAmount, 
            sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` 
          }
        ]);

        if (insertError) throw insertError;

        setUploadStatus(`Success! Saved ${platform}.`);
        e.target.value = null; 
        
        // Final Refresh
        await fetchData();
        
      } catch (err) {
        setUploadStatus('System Error: Save failed.');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteSale = async (id) => {
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (!error) fetchData();
  };

  const totalSales = savedSales.reduce((s, i) => s + Number(i.amount), 0);
  const totalExp = expenses.reduce((s, i) => s + Number(i.cost), 0);
  const cardStyle = { backgroundColor: '#ffffff', borderRadius: '18px', padding: '20px', marginBottom: '16px', border: '1px solid #e2e8f0' };

  return (
    <div style={{ fontFamily: '-apple-system, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px' }}>
      
      {/* Header & Month */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: 0 }}>MANA SOCIAL</h1>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'imports', 'manage'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#64748b' }}>Total Revenue</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: '#64748b' }}>Total Expenses</span>
            <span style={{ fontWeight: 'bold', color: '#ef4444' }}>-${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between', border: '1px solid #dcfce7' }}>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>Net Profit</span>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>${(totalSales - totalExp).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      )}

      {activeTab === 'imports' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Marketplace Upload</h2>
          <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} style={{ width: '100%', marginBottom: '12px' }} />
          {uploadStatus && (
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '12px', fontWeight: 'bold', border: '1px solid #dbeafe' }}>
              {uploadStatus}
            </div>
          )}
        </div>
      )}

      {activeTab === 'manage' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Monthly Records</h2>
          {savedSales.length > 0 ? savedSales.map(sale => (
            <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{sale.platform}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{sale.sale_date}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>${Number(sale.amount).toLocaleString()}</span>
                <button onClick={() => deleteSale(sale.id)} style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', backgroundColor: '#fee2e2', color: '#ef4444', fontWeight: 'bold', fontSize: '10px' }}>DEL</button>
              </div>
            </div>
          )) : <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>No records found for this month.</p>}
        </div>
      )}
    </div>
  )
}
