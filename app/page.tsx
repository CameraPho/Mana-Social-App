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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); 
  const [expenses, setExpenses] = useState([]);
  const [savedSales, setSavedSales] = useState([]);
  const [buyouts, setBuyouts] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');

  // New Buyout Form State
  const [newBuyout, setNewBuyout] = useState({ name: '', total_cost: '', notes: '' });

  const fetchData = useCallback(async () => {
    const { data: expData } = await supabase.from('expenses').select('*');
    const { data: saleData } = await supabase.from('sales').select('*');
    const { data: buyoutData } = await supabase.from('buyouts').select('*');

    const currentYear = new Date().getFullYear();
    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
    const yearMonth = `${currentYear}-${monthStr}`;

    // Filter Sales
    const filteredSales = (saleData || []).filter(s => {
      const dbDate = s.sale_date || '';
      const createdAt = s.created_at ? new Date(s.created_at).getMonth() + 1 : null;
      return dbDate.includes(yearMonth) || createdAt === selectedMonth;
    });

    // Filter Buyouts (added this month)
    const filteredBuyouts = (buyoutData || []).filter(b => b.created_at.includes(yearMonth));

    // Combine standard expenses + buyout costs for the month
    const combinedExpenses = [
      ...(expData || []).filter(e => e.purchase_date.includes(yearMonth) || e.purchase_date.startsWith(`${selectedMonth}/`)),
      ...filteredBuyouts.map(b => ({ id: `b-${b.id}`, item_name: `BUYOUT: ${b.name}`, cost: b.total_cost, purchase_date: b.created_at }))
    ];

    setExpenses(combinedExpenses);
    setSavedSales(filteredSales);
    setBuyouts(filteredBuyouts);
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddBuyout = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('buyouts').insert([
      { name: newBuyout.name, total_cost: parseFloat(newBuyout.total_cost), notes: newBuyout.notes }
    ]);
    if (!error) {
      setNewBuyout({ name: '', total_cost: '', notes: '' });
      fetchData();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Syncing...');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any = XLSX.utils.sheet_to_json(ws, { header: 1 });
        let headerIdx = -1;
        let platform = 'Marketplace';
        for (let i = 0; i < Math.min(rows.length, 25); i++) {
          const r = rows[i].map(c => String(c || '').toLowerCase().trim());
          if (r.includes('listing title')) { headerIdx = i; platform = 'eBay'; break; }
          if (r.includes('gross sales')) { headerIdx = i; platform = 'TCGplayer'; break; }
        }
        const headers = rows[headerIdx].map(h => String(h || '').trim().toLowerCase());
        let total = 0;
        rows.slice(headerIdx + 1).forEach(row => {
          headers.forEach((h, idx) => {
            if (['total sales (includes taxes)', 'gross sales', 'total', 'payout amount'].includes(h)) {
              const val = parseFloat(String(row[idx] || 0).replace(/[$, ]/g, ''));
              if (!isNaN(val)) total += val;
            }
          });
        });
        await supabase.from('sales').insert([{ platform, amount: total, sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` }]);
        setUploadStatus('Success!');
        fetchData();
      } catch (err) { setUploadStatus('Upload Error'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteItem = async (id, table) => {
    const cleanId = String(id).replace('b-', '');
    await supabase.from(table).delete().eq('id', cleanId);
    fetchData();
  };

  const totalSales = savedSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const netProfit = totalSales - totalExp;

  const cardStyle = { backgroundColor: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '16px' };
  const inputStyle = { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '12px', border: '1px solid #e2e8f0' };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', color: '#1e293b' }}>
      
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '900' }}>MANA SOCIAL</h1>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ padding: '8px', borderRadius: '10px' }}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
        {['summary', 'buyouts', 'upload', 'income', 'expense'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: '1', padding: '12px 6px', borderRadius: '12px', border: 'none', fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b' }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Revenue</span><span style={{ fontWeight: '800', color: '#2563eb' }}>${totalSales.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}><span>Expenses (Incl. Buyouts)</span><span style={{ fontWeight: '800', color: '#ef4444' }}>-${totalExp.toFixed(2)}</span></div>
          <div style={{ padding: '20px', borderRadius: '18px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '900' }}>NET PROFIT</span><span style={{ fontWeight: '900' }}>${netProfit.toFixed(2)}</span>
          </div>
        </div>
      )}

      {activeTab === 'buyouts' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>New Collection Buyout</h2>
          <form onSubmit={handleAddBuyout}>
            <input placeholder="Collection Name" style={inputStyle} value={newBuyout.name} onChange={e => setNewBuyout({...newBuyout, name: e.target.value})} required />
            <input placeholder="Total Cost ($)" type="number" style={inputStyle} value={newBuyout.total_cost} onChange={e => setNewBuyout({...newBuyout, total_cost: e.target.value})} required />
            <textarea placeholder="Payment Plan Details / Notes" style={inputStyle} value={newBuyout.notes} onChange={e => setNewBuyout({...newBuyout, notes: e.target.value})} />
            <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: '800' }}>LOG BUYOUT</button>
          </form>
          
          <h3 style={{ fontSize: '14px', fontWeight: '800', marginTop: '25px', marginBottom: '10px' }}>Active Buyouts (This Month)</h3>
          {buyouts.map(b => (
            <div key={b.id} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '700' }}>{b.name}</span>
                <span style={{ fontWeight: '800' }}>${Number(b.total_cost).toFixed(2)}</span>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0' }}>{b.notes}</p>
              <button onClick={() => deleteItem(b.id, 'buyouts')} style={{ color: '#ef4444', border: 'none', background: 'none', fontSize: '10px', padding: 0 }}>Delete Buyout</button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'upload' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>Marketplace Upload</h2>
          <input type="file" onChange={handleFileUpload} style={{ width: '100%', padding: '20px', border: '2px dashed #cbd5e1', borderRadius: '16px' }} />
          {uploadStatus && <p style={{ textAlign: 'center', marginTop: '10px', fontWeight: '700' }}>{uploadStatus}</p>}
        </div>
      )}

      {activeTab === 'income' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>Income Ledger</h2>
          {savedSales.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>{s.platform}</span>
              <span style={{ fontWeight: '800' }}>${Number(s.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'expense' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>Expense Ledger</h2>
          {expenses.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '13px' }}>{e.item_name}</span>
              <span style={{ fontWeight: '800', color: '#ef4444' }}>-${Number(e.cost).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
