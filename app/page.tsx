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

  // 1. IMPROVED DATABASE FETCHING
  // Uses strict date boundaries so Supabase doesn't reject the query
  const fetchData = async () => {
    const currentMonth = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
    const nextMonthNum = selectedMonth + 1;
    const nextMonth = nextMonthNum < 10 ? `0${nextMonthNum}` : `${nextMonthNum}`;
    
    const startDate = `2026-${currentMonth}-01`;
    const endDate = `2026-${nextMonth}-01`;

    try {
      const { data: expData, error: expErr } = await supabase
        .from('expenses')
        .select('*')
        .gte('purchase_date', startDate)
        .lt('purchase_date', endDate);
      
      if (!expErr && expData) setExpenses(expData);

      const { data: saleData, error: saleErr } = await supabase
        .from('sales')
        .select('*')
        .gte('sale_date', startDate)
        .lt('sale_date', endDate);

      if (!saleErr && saleData) setSavedSales(saleData);
    } catch (err) {
      console.error("Database fetch failed:", err);
    }
  };

  // Triggers whenever the month changes
  useEffect(() => { 
    fetchData(); 
  }, [selectedMonth]);

  // 2. REBUILT FILE PARSER
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus('Analyzing file structure...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target?.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        
        // Convert sheet to a basic array to easily find where the headers actually start
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        let headerRowIndex = -1;
        let platform = 'Unknown';

        // Scan top 15 rows to bypass eBay disclaimers and TCGplayer titles
        for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
          const rowString = (rawRows[i] || []).join(' ').toLowerCase();
          if (rowString.includes('listing title')) { headerRowIndex = i; platform = 'eBay'; break; }
          if (rowString.includes('gross sales')) { headerRowIndex = i; platform = 'TCGplayer'; break; }
          if (rowString.includes('period') && rowString.includes('total')) { headerRowIndex = i; platform = 'ManaPool'; break; }
        }

        if (headerRowIndex === -1) {
          setUploadStatus('Error: Could not find valid platform headers.');
          return;
        }

        // Clean headers and convert the rest of the sheet into highly accurate JSON objects
        const headers = rawRows[headerRowIndex].map(h => String(h || '').trim().toLowerCase());
        const dataObjects = XLSX.utils.sheet_to_json(ws, { header: headers, range: headerRowIndex + 1 });

        let totalAmount = 0;

        dataObjects.forEach((row: any) => {
          let valStr = '';
          
          if (platform === 'eBay') valStr = row['total sales (includes taxes)'];
          if (platform === 'TCGplayer') valStr = row['gross sales'];
          if (platform === 'ManaPool') valStr = row['total'];

          if (valStr) {
            // Strip out '$', ',', and spaces before doing math
            const num = parseFloat(String(valStr).replace(/[$, ]/g, ''));
            if (!isNaN(num)) totalAmount += num;
          }
        });

        if (totalAmount === 0) {
          setUploadStatus('Warning: File processed, but calculated total was $0.00');
          return;
        }

        setUploadStatus(`Saving ${platform} total to database...`);

        // 3. SECURE DATABASE INSERT
        const { error } = await supabase.from('sales').insert([
          { 
            platform, 
            amount: totalAmount, 
            sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` 
          }
        ]);

        if (error) throw error;

        setUploadStatus(`Success! $${totalAmount.toLocaleString()} added for ${platform}.`);
        
        // Force the app to re-download the data so the other tabs update immediately
        await fetchData(); 
        
      } catch (err) {
        setUploadStatus('Error: Upload failed. Check file formatting.');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteSale = async (id: string) => {
    await supabase.from('sales').delete().eq('id', id);
    await fetchData(); // Refresh tabs immediately after deleting
  };

  // State calculations for the Summary Tab
  const totalSales = savedSales.reduce((s, i: any) => s + Number(i.amount), 0);
  const totalExp = expenses.reduce((s, i: any) => s + Number(i.cost), 0);
  const cardStyle = { backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '16px' }}>
      
      {/* Header Panel */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '800', fontSize: '20px', color: '#0f172a', letterSpacing: '-0.5px' }}>MANA SOCIAL</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'imports', 'manage'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: '12px', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
            {t}
          </button>
        ))}
      </div>

      {/* SUMMARY TAB */}
      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#64748b', fontWeight: '500' }}>Gross Sales</span>
            <span style={{ fontWeight: '700', color: '#2563eb' }}>${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ color: '#64748b', fontWeight: '500' }}>Operating Expenses</span>
            <span style={{ fontWeight: '700', color: '#ef4444' }}>-${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ padding: '18px', borderRadius: '16px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between', border: '1px solid #dcfce7' }}>
            <span style={{ fontWeight: '800', color: '#166534' }}>Net Profit</span>
            <span style={{ fontWeight: '800', color: '#166534' }}>${(totalSales - totalExp).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      )}

      {/* IMPORTS TAB */}
      {activeTab === 'imports' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px', color: '#1e293b' }}>Upload Reports</h3>
          <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} style={{ width: '100%', marginBottom: '15px', fontSize: '14px' }} />
          
          {uploadStatus && (
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: uploadStatus.includes('Error') ? '#fef2f2' : '#eff6ff', color: uploadStatus.includes('Error') ? '#991b1b' : '#1e40af', fontSize: '13px', fontWeight: '600', border: '1px solid', borderColor: uploadStatus.includes('Error') ? '#fecaca' : '#bfdbfe' }}>
              {uploadStatus}
            </div>
          )}
        </div>
      )}

      {/* MANAGE TAB */}
      {activeTab === 'manage' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Transaction Ledger</h3>
            <button onClick={fetchData} style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer', fontWeight: 'bold' }}>Refresh</button>
          </div>
          
          {savedSales.length > 0 ? savedSales.map((sale: any) => (
            <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#334155' }}>{sale.platform}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(sale.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>${Number(sale.amount).toLocaleString()}</span>
                <button onClick={() => deleteSale(sale.id)} style={{ backgroundColor: '#fff', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          )) : (
            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px' }}>No records found for this period.</p>
          )}
        </div>
      )}
    </div>
  )
}
