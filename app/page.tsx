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
  const [payroll, setPayroll] = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');

  // Form States
  const [newBuyout, setNewBuyout] = useState({ name: '', total_cost: '', notes: '' });
  const [newPayroll, setNewPayroll] = useState({ employee: '', gross_pay: '' });
  const [newDisbursement, setNewDisbursement] = useState({ partner: 'Kenny', amount: '', type: 'Draw' });
  const [partnerDeductions, setPartnerDeductions] = useState({ kenny: 0, camera: 0 });

  const fetchData = useCallback(async () => {
    const { data: expData } = await supabase.from('expenses').select('*');
    const { data: saleData } = await supabase.from('sales').select('*');
    const { data: buyoutData } = await supabase.from('buyouts').select('*');
    const { data: payrollData } = await supabase.from('payroll').select('*');
    const { data: disbData } = await supabase.from('disbursements').select('*');

    const currentYear = new Date().getFullYear();
    const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
    const yearMonth = `${currentYear}-${monthStr}`;

    const filteredSales = (saleData || []).filter(s => {
      const dbDate = s.sale_date || '';
      const createdAt = s.created_at ? new Date(s.created_at).getMonth() + 1 : null;
      return dbDate.includes(yearMonth) || createdAt === selectedMonth;
    });

    const filteredBuyouts = (buyoutData || []).filter(b => b.created_at.includes(yearMonth));
    const filteredPayroll = (payrollData || []).filter(p => p.created_at.includes(yearMonth));
    const filteredDisb = (disbData || []).filter(d => d.created_at.includes(yearMonth));

    const totalGrossPay = filteredPayroll.reduce((sum, p) => sum + Number(p.gross_pay), 0);
    const employerPayrollTax = totalGrossPay * 0.0765;

    // Combine all business outflows (Expenses, Buyouts, Payroll, and Partner Salaries)
    // Note: Partner "Draws" are typically equity reductions, but "Salaries" are expenses.
    const combinedExpenses = [
      ...(expData || []).filter(e => e.purchase_date.includes(yearMonth) || e.purchase_date.startsWith(`${selectedMonth}/`)),
      ...filteredBuyouts.map(b => ({ id: `b-${b.id}`, item_name: `BUYOUT: ${b.name}`, cost: b.total_cost })),
      ...filteredPayroll.map(p => ({ id: `p-${p.id}`, item_name: `PAYROLL: ${p.employee}`, cost: p.gross_pay })),
      ...filteredDisb.filter(d => d.type === 'Salary').map(d => ({ id: `d-${d.id}`, item_name: `SALARY: ${d.partner}`, cost: d.amount })),
      { id: 'tax-ptr', item_name: 'EST. EMPLOYER PAYROLL TAX (7.65%)', cost: employerPayrollTax }
    ];

    setExpenses(combinedExpenses);
    setSavedSales(filteredSales);
    setBuyouts(filteredBuyouts);
    setPayroll(filteredPayroll);
    setDisbursements(filteredDisb);
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddDisbursement = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('disbursements').insert([
      { partner: newDisbursement.partner, amount: parseFloat(newDisbursement.amount), type: newDisbursement.type }
    ]);
    if (!error) { setNewDisbursement({ ...newDisbursement, amount: '' }); fetchData(); }
  };

  const handleAddPayroll = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('payroll').insert([{ employee: newPayroll.employee, gross_pay: parseFloat(newPayroll.gross_pay) }]);
    if (!error) { setNewPayroll({ employee: '', gross_pay: '' }); fetchData(); }
  };

  const handleAddBuyout = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('buyouts').insert([{ name: newBuyout.name, total_cost: parseFloat(newBuyout.total_cost), notes: newBuyout.notes }]);
    if (!error) { setNewBuyout({ name: '', total_cost: '', notes: '' }); fetchData(); }
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
        for (let i = 0; i < Math.min(rows.length, 25); i++) {
          const r = rows[i].map(c => String(c || '').toLowerCase().trim());
          if (r.includes('listing title') || r.includes('gross sales')) { headerIdx = i; break; }
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
        await supabase.from('sales').insert([{ platform: 'Import', amount: total, sale_date: `2026-${selectedMonth < 10 ? '0' : ''}${selectedMonth}-01` }]);
        setUploadStatus('Done!');
        fetchData();
      } catch (err) { setUploadStatus('Upload Error'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteItem = async (id, table) => {
    const cleanId = String(id).split('-').pop();
    await supabase.from(table).delete().eq('id', cleanId);
    fetchData();
  };

  const totalSales = savedSales.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalExp = expenses.reduce((sum, e) => sum + Number(e.cost), 0);
  const netProfit = totalSales - totalExp;
  const totalGrossPay = payroll.reduce((sum, p) => sum + Number(p.gross_pay), 0);
  const totalDraws = disbursements.filter(d => d.type === 'Draw').reduce((sum, d) => sum + Number(d.amount), 0);

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
        {['summary', 'disburse', 'payroll', 'buyouts', 'upload', 'taxes'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: '1 1 auto', padding: '10px 4px', borderRadius: '12px', border: 'none', fontWeight: '800', fontSize: '9px', textTransform: 'uppercase', backgroundColor: activeTab === t ? '#2563eb' : '#fff', color: activeTab === t ? '#fff' : '#64748b' }}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Revenue</span><span style={{ fontWeight: '800', color: '#2563eb' }}>${totalSales.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Costs (Incl. Salaries)</span><span style={{ fontWeight: '800', color: '#ef4444' }}>-${totalExp.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px', color: '#64748b' }}><span>Partner Draws (Equity)</span><span>-${totalDraws.toFixed(2)}</span></div>
          <div style={{ padding: '20px', borderRadius: '18px', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '900' }}>NET PROFIT</span><span style={{ fontWeight: '900' }}>${netProfit.toFixed(2)}</span>
          </div>
        </div>
      )}

      {activeTab === 'disburse' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>Partner Disbursements</h2>
          <form onSubmit={handleAddDisbursement}>
            <select style={inputStyle} value={newDisbursement.partner} onChange={e => setNewDisbursement({...newDisbursement, partner: e.target.value})}>
              <option value="Kenny">Kenny</option>
              <option value="Camera">Camera</option>
            </select>
            <select style={inputStyle} value={newDisbursement.type} onChange={e => setNewDisbursement({...newDisbursement, type: e.target.value})}>
              <option value="Draw">Partner Draw (Equity)</option>
              <option value="Salary">Partner Salary (Expense)</option>
            </select>
            <input placeholder="Amount ($)" type="number" style={inputStyle} value={newDisbursement.amount} onChange={e => setNewDisbursement({...newDisbursement, amount: e.target.value})} required />
            <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: '800' }}>LOG PAYMENT</button>
          </form>
          <div style={{ marginTop: '20px' }}>
            {disbursements.map(d => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                <span>{d.partner} ({d.type})</span>
                <div>
                  <span style={{ fontWeight: '700', marginRight: '10px' }}>${Number(d.amount).toFixed(2)}</span>
                  <button onClick={() => deleteItem(d.id, 'disbursements')} style={{ color: '#ef4444', border: 'none', background: 'none', fontSize: '10px' }}>DEL</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>Staff Payroll</h2>
          <form onSubmit={handleAddPayroll}>
            <input placeholder="Employee Name" style={inputStyle} value={newPayroll.employee} onChange={e => setNewPayroll({...newPayroll, employee: e.target.value})} required />
            <input placeholder="Gross Pay ($)" type="number" style={inputStyle} value={newPayroll.gross_pay} onChange={e => setNewPayroll({...newPayroll, gross_pay: e.target.value})} required />
            <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: '800' }}>LOG PAYROLL</button>
          </form>
        </div>
      )}

      {activeTab === 'taxes' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '20px' }}>Tax Liability Estimates</h2>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '9px', fontWeight: '800' }}>KENNY DEDUCTS</label>
              <input type="number" style={inputStyle} value={partnerDeductions.kenny} onChange={e => setPartnerDeductions({...partnerDeductions, kenny: Number(e.target.value)})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '9px', fontWeight: '800' }}>CAMERA DEDUCTS</label>
              <input type="number" style={inputStyle} value={partnerDeductions.camera} onChange={e => setPartnerDeductions({...partnerDeductions, camera: Number(e.target.value)})} />
            </div>
          </div>
          <div style={{ padding: '15px', backgroundColor: '#f8fafc', borderRadius: '16px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}><span>Kenny Adj. Taxable</span><span>${Math.max(0, (netProfit/2) - partnerDeductions.kenny).toFixed(2)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Camera Adj. Taxable</span><span>${Math.max(0, (netProfit/2) - partnerDeductions.camera).toFixed(2)}</span></div>
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Federal SE Tax</span><span style={{ fontWeight: '800' }}>${(netProfit * 0.153).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Employer FICA</span><span style={{ fontWeight: '800' }}>${(totalGrossPay * 0.0765).toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'buyouts' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>Collection Buyouts</h2>
          <form onSubmit={handleAddBuyout}>
            <input placeholder="Collection Name" style={inputStyle} value={newBuyout.name} onChange={e => setNewBuyout({...newBuyout, name: e.target.value})} required />
            <input placeholder="Total Cost ($)" type="number" style={inputStyle} value={newBuyout.total_cost} onChange={e => setNewBuyout({...newBuyout, total_cost: e.target.value})} required />
            <textarea placeholder="Notes" style={inputStyle} value={newBuyout.notes} onChange={e => setNewBuyout({...newBuyout, notes: e.target.value})} />
            <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: '800' }}>LOG BUYOUT</button>
          </form>
        </div>
      )}

      {activeTab === 'upload' && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '15px' }}>Import Sales</h2>
          <input type="file" onChange={handleFileUpload} style={{ width: '100%', padding: '20px', border: '2px dashed #cbd5e1', borderRadius: '16px' }} />
          {uploadStatus && <p style={{ textAlign: 'center', marginTop: '10px' }}>{uploadStatus}</p>}
        </div>
      )}
    </div>
  )
}
