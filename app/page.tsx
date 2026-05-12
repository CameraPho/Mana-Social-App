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
    const dateQuery = `2026-${monthStr}`;

    const { data: expData } = await supabase.from('expenses').select('*').like('purchase_date', `%${dateQuery}%`);
    if (expData) setExpenses(expData);

    const { data: saleData } = await supabase.from('sales').select('*').like('sale_date', `%${dateQuery}%`);
    if (saleData) setSavedSales(saleData);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if it's an image (for receipts) or a data file (for reports)
    if (file.type.startsWith('image/')) {
      setUploadStatus('Image detected. Preparing for receipt log...');
      // Logic for handling image uploads/OCR can be added here
      return;
    }

    setUploadStatus('Reading data report...');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let headerRowIndex = -1;
        let platform = 'eBay';

        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const row = rows[i].map(cell => String(cell || '').toLowerCase().trim());
          if (row.includes('listing title')) { headerRowIndex = i; platform = 'eBay'; break; }
          if (row.includes('gross sales')) { headerRowIndex = i; platform = 'TCGplayer'; break; }
          if (row.includes('period')) { headerRowIndex = i; platform = 'ManaPool'; break; }
        }

        const headers = rows[headerRowIndex].map(h => String(h || '').trim().toLowerCase());
        const dataRows = rows.slice(headerRowIndex + 1);
        
        let totalAmount = 0;
        dataRows.forEach((row: any) => {
          headers.forEach((header, colIdx) => {
            if (header === 'total sales (includes taxes)' || header === 'gross sales' || header === 'total') {
              const val = row[colIdx];
              if (val) {
                const num = parseFloat(String(val).replace(/[$, ]/g, ''));
                if (!isNaN(num)) totalAmount += num;
              }
            }
          });
        });

        const { error } = await supabase.from('sales').insert([
          { platform, amount: totalAmount, sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` }
        ]);

        if (error) throw error;
        setUploadStatus(`Success! Added ${platform}: $${totalAmount.toLocaleString()}`);
        fetchData();
      } catch (err) {
        setUploadStatus('Data Error: Ensure file is a CSV or Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const totalSales = savedSales.reduce((s, i) => s + Number(i.amount), 0);
  const totalExp = expenses.reduce((s, i) => s + Number(i.cost), 0);
  const netProfit = totalSales - totalExp;

  const cardStyle = { backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: '16px' };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '16px' }}>
      
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '800', fontSize: '18px', color: '#0f172a' }}>MANA SOCIAL</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'upload', 'income', 'expense', 'taxes'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 14px', borderRadius: '12px', border: 'none', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', backgroundColor: activeTab === tab ? '#2563eb' : '#fff', color: activeTab === tab ? '#fff' : '#64748b' }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'upload' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>Upload or Capture</h3>
          
          {/* THE UNIVERSAL PICKER: No strict restriction on 'accept', allowing Camera/Photos/Files */}
          <input 
            type="file" 
            onChange={handleFileUpload} 
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '2px dashed #e2e8f0', 
              borderRadius: '12px',
              fontSize: '14px' 
            }} 
          />
          
          {uploadStatus && (
            <div style={{ marginTop: '15px', padding: '12px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '13px', fontWeight: '600' }}>
              {uploadStatus}
            </div>
          )}
          
          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '15px', lineHeight: '1.4' }}>
            Select **Take Photo** for receipts or **Choose File** for eBay/TCGplayer/ManaPool CSV reports.
          </p>
        </div>
      )}

      {/* Other tabs follow the previous layout... */}
    </div>
  )
}
