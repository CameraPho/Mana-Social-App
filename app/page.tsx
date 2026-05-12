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
    const datePattern = `2026-${monthStr}`;

    const { data: expData } = await supabase.from('expenses').select('*').like('purchase_date', `%${datePattern}%`);
    if (expData) setExpenses(expData);

    const { data: saleData } = await supabase.from('sales').select('*').like('sale_date', `%${datePattern}%`);
    if (saleData) setSavedSales(saleData);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]);

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Scanning for money columns...');

    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let foundHeaderIndex = -1;
        let moneyColIndex = -1;
        let platform = 'Unknown';

        // BRUTE FORCE: Scan first 20 rows for ANY keyword related to sales
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i].map((cell: any) => String(cell || '').toLowerCase().trim());
          
          const colIndex = row.findIndex((cell: string) => 
            cell.includes('total sales (includes taxes)') || 
            cell === 'gross sales' || 
            (cell === 'total' && row.includes('period')) ||
            cell === 'net sales'
          );

          if (colIndex !== -1) {
            foundHeaderIndex = i;
            moneyColIndex = colIndex;
            // Identify platform
            if (row.includes('listing title')) platform = 'eBay';
            else if (row.includes('channel')) platform = 'TCGplayer';
            else if (row.includes('period')) platform = 'ManaPool';
            break;
          }
        }

        if (moneyColIndex === -1) {
          setUploadStatus('Error: Could not find "Total" or "Gross" column.');
          return;
        }

        let totalAmount = 0;
        const dataRows = rows.slice(foundHeaderIndex + 1);

        dataRows.forEach((row: any) => {
          const val = row[moneyColIndex];
          if (val !== undefined && val !== null) {
            const cleanNum = parseFloat(String(val).replace(/[$, ]/g, ''));
            if (!isNaN(cleanNum)) totalAmount += cleanNum;
          }
        });

        if (totalAmount === 0) {
          setUploadStatus('Check file: Found headers but total was $0.');
          return;
        }

        // SAVE TO SUPABASE
        const { error } = await supabase.from('sales').insert([
          { 
            platform, 
            amount: totalAmount, 
            sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` 
          }
        ]);

        if (error) throw error;
        setUploadStatus(`Saved ${platform}: $${totalAmount.toLocaleString()}`);
        fetchData();
        e.target.value = null; // Clear input for next upload
      } catch (err) {
        setUploadStatus('Error: Database write failed.');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteSale = async (id: string) => {
    await supabase.from('sales').delete().eq('id', id);
    fetchData();
  };

  const totalSales = savedSales.reduce((sum, item: any) => sum + Number(item.amount), 0);
  const totalExp = expenses.reduce((sum, item: any) => sum + Number(item.cost), 0);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>MANA SOCIAL</h1>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '6px', borderRadius: '8px' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'imports', 'manage'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', fontWeight: 'bold', backgroundColor: activeTab === tab ? '#2563eb' : '#fff', color: activeTab === tab ? '#fff' : '#64748b' }}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span>Sales</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${totalSales.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span>Expenses</span>
            <span style={{ fontWeight: 'bold', color: '#ef4444' }}>-${totalExp.toLocaleString()}</span>
          </div>
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold' }}>Profit</span>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>${(totalSales - totalExp).toLocaleString()}</span>
          </div>
        </div>
      )}

      {activeTab === 'imports' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '12px' }}>Marketplace Upload</h2>
          <input type="file" onChange={handleFileUpload} style={{ width: '100%', marginBottom: '12px' }} />
          {uploadStatus && <div style={{ padding: '10px', backgroundColor: '#f0f9ff', color: '#0369a1', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' }}>{uploadStatus}</div>}
        </div>
      )}

      {activeTab === 'manage' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '12px' }}>Records</h2>
          {savedSales.map((sale: any) => (
            <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{sale.platform}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(sale.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 'bold' }}>${Number(sale.amount).toLocaleString()}</span>
                <button onClick={() => deleteSale(sale.id)} style={{ color: '#ef4444', background: 'none', border: 'none', fontWeight: 'bold' }}>Del</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
