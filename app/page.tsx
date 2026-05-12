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
    const { data: expData } = await supabase.from('expenses').select('*').like('purchase_date', `%2026-${monthStr}%`);
    if (expData) setExpenses(expData);
    const { data: saleData } = await supabase.from('sales').select('*').like('sale_date', `%2026-${monthStr}%`);
    if (saleData) setSavedSales(saleData);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Scanning file...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // 1. ROBUST HEADER SEARCH
        let headerRowIndex = -1;
        let platform = 'eBay';

        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const cleanRow = rows[i].map(cell => String(cell || '').toLowerCase().replace(/[^a-z]/g, ''));
          if (cleanRow.includes('listingtitle') || cleanRow.includes('totalsalesincludestaxes')) {
            headerRowIndex = i; platform = 'eBay'; break;
          }
          if (cleanRow.includes('grosssales') || cleanRow.includes('netsales')) {
            headerRowIndex = i; platform = 'TCGplayer'; break;
          }
          if (cleanRow.includes('period') && cleanRow.includes('total')) {
            headerRowIndex = i; platform = 'ManaPool'; break;
          }
        }

        if (headerRowIndex === -1) {
          setUploadStatus('Error: Could not find marketplace columns.');
          return;
        }

        const rawHeaders = rows[headerRowIndex];
        const dataRows = rows.slice(headerRowIndex + 1);
        
        // 2. AGGRESSIVE VALUE EXTRACTION
        let totalAmount = 0;
        dataRows.forEach((row: any) => {
          rawHeaders.forEach((h, colIdx) => {
            const head = String(h || '').toLowerCase().replace(/[^a-z]/g, '');
            const val = row[colIdx];
            
            if (
              head === 'totalsalesincludestaxes' || 
              head === 'grosssales' || 
              (platform === 'ManaPool' && head === 'total')
            ) {
              if (val !== undefined && val !== null) {
                const num = parseFloat(String(val).replace(/[^\d.-]/g, ''));
                if (!isNaN(num)) totalAmount += num;
              }
            }
          });
        });

        if (totalAmount === 0) {
          setUploadStatus('Error: File read successfully but total was $0.00');
          return;
        }

        // 3. DATABASE SYNC
        setUploadStatus(`Uploading ${platform} total...`);
        const { error } = await supabase.from('sales').insert([
          { 
            platform, 
            amount: totalAmount, 
            sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` 
          }
        ]);

        if (error) throw error;

        setUploadStatus(`Saved ${platform}: $${totalAmount.toLocaleString()}`);
        e.target.value = null; 
        fetchData(); 
      } catch (err) {
        setUploadStatus('Database Error: Record failed to save.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteSale = async (id) => {
    await supabase.from('sales').delete().eq('id', id);
    fetchData();
  };

  const totalSales = savedSales.reduce((s, i) => s + Number(i.amount), 0);
  const totalExp = expenses.reduce((s, i) => s + Number(i.cost), 0);
  const cardStyle = { backgroundColor: 'white', borderRadius: '18px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f0f4f8', minHeight: '100vh', padding: '16px' }}>
      
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '900', fontSize: '18px', color: '#1e293b' }}>MANA SOCIAL</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'imports', 'manage'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '12px', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b' }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: '#64748b' }}>Gross Revenue</span>
            <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span style={{ color: '#64748b' }}>Total Expenses</span>
            <span style={{ fontWeight: 'bold', color: '#ef4444' }}>-${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div style={{ padding: '20px', borderRadius: '14px', backgroundColor: '#ecfdf5', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold', color: '#065f46' }}>Net Profit</span>
            <span style={{ fontWeight: 'bold', color: '#065f46' }}>${(totalSales - totalExp).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>
      )}

      {activeTab === 'imports' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '15px' }}>Marketplace Importer</h3>
          <input type="file" onChange={handleFileUpload} style={{ width: '100%', marginBottom: '15px' }} />
          {uploadStatus && (
            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: uploadStatus.includes('Error') ? '#fef2f2' : '#eff6ff', color: uploadStatus.includes('Error') ? '#991b1b' : '#1e40af', fontWeight: 'bold', fontSize: '13px' }}>
              {uploadStatus}
            </div>
          )}
        </div>
      )}

      {activeTab === 'manage' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '12px' }}>Monthly Totals</h3>
          {savedSales.map(sale => (
            <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{sale.platform}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(sale.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontWeight: 'bold' }}>${Number(sale.amount).toLocaleString()}</span>
                <button onClick={() => deleteSale(sale.id)} style={{ color: '#ef4444', border: 'none', background: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
