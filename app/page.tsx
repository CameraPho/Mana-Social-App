'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const FONT = "'Calibri', sans-serif"

const C = {
  navy: '#1B2A4A', navyDark: '#111D33', teal: '#2DBFB8',
  pink: '#E8407A', purple: '#6B3FA0', gold: '#F0C040',
  bg: '#F0F2F8', white: '#FFFFFF', muted: '#8A96B0',
  text: '#1B2A4A', border: 'rgba(27,42,74,0.12)', green: '#10b981',
}

const fmt = (n: number) => {
  if (n < 0) return '-$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const fmtK = (n: number) => {
  if (Math.abs(n) >= 1000) return (n < 0 ? '-$' : '$') + (Math.abs(n) / 1000).toFixed(1) + 'k'
  return fmt(n)
}
const pctFmt = (n: number, d: number) => d === 0 ? '—' : (n / d * 100).toFixed(1) + '%'
const getEntity = (date: string) => new Date(date) < new Date('2026-03-18') ? 'sole_prop' : 'llc'
const LLC_START = new Date('2026-03-18')

const DEDUCTIBILITY: Record<string, { pct: number | null, label: string, line: string }> = {
  'Shipping & Postage':         { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Selling Fees & Commissions': { pct: 100,  label: '100% deductible',             line: 'Sch C Line 10'  },
  'Software & Subscriptions':   { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Supplies & Packaging':       { pct: 100,  label: '100% deductible',             line: 'Sch C Line 22'  },
  'Advertising & Marketing':    { pct: 100,  label: '100% deductible',             line: 'Sch C Line 8'   },
  'Professional Services':      { pct: 100,  label: '100% deductible',             line: 'Sch C Line 17'  },
  'Banking & Finance Charges':  { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Taxes & Licenses':           { pct: 100,  label: '100% deductible',             line: 'Sch C Line 23'  },
  'Equipment':                  { pct: 100,  label: 'Sec 179 or depreciate',       line: 'Sch C Line 13'  },
  'Furniture & Fixtures':       { pct: 100,  label: 'Sec 179 or depreciate',       line: 'Sch C Line 13'  },
  'Travel & Conventions':       { pct: 100,  label: '100% deductible',             line: 'Sch C Line 24a' },
  'Trade Shows & Conventions':  { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Meals & Entertainment':      { pct: 50,   label: '50% deductible',              line: 'Sch C Line 24b' },
  'Internet & Phone':           { pct: null, label: 'Partial — business use %',    line: 'Sch C Line 25'  },
  'Education & Training':       { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Home Office':                { pct: null, label: 'Partial — set % in settings', line: 'Sch C Line 30'  },
  'Other':                      { pct: null, label: 'Needs review',                line: 'Sch C Line 27a' },
}
const EXPENSE_CATEGORIES = Object.keys(DEDUCTIBILITY)
const MILEAGE_RATE = 0.67
const ASSET_CATEGORIES = ['Equipment', 'Furniture & Fixtures', 'Vehicle']
const USEFUL_LIFE: Record<string, number> = { Equipment: 5, 'Furniture & Fixtures': 7, Vehicle: 5 }

// ── TCGplayer Parser ──────────────────────────────────────────────────────────
function parseTCGplayerXLSX(file: File): Promise<{ records: any[], meta: any }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const sheetName = wb.SheetNames[0]
        const dateMatch = sheetName.match(/(\d{8})_(\d{8})$/)
        let periodStart = '', periodEnd = '', entity = 'llc'
        if (dateMatch) {
          const s = dateMatch[1], en = dateMatch[2]
          periodStart = `${s.slice(4)}-${s.slice(0,2)}-${s.slice(2,4)}`
          periodEnd   = `${en.slice(4)}-${en.slice(0,2)}-${en.slice(2,4)}`
          entity = new Date(periodEnd) < LLC_START ? 'sole_prop' : 'llc'
        }
        const rows: any[] = XLSX.utils.sheet_to_json(ws)
        let grossSales = 0, netSales = 0, netShipping = 0, netTCGTax = 0, numOrders = 0
        for (const row of rows) {
          const state = row['State'] || row['state']
          if (!state || String(state).length !== 2) continue
          grossSales  += Number(row['Gross Sales']     || 0)
          netSales    += Number(row['Net Sales']        || 0)
          netShipping += Number(row['Net Shipping Amt'] || row['Shipping Amt'] || 0)
          netTCGTax   += Number(row['Net TCG Tax Amt']  || row['TCG Tax Amt']  || 0)
          numOrders   += Number(row['Number of Orders'] || 0)
        }
        const derivedFees = parseFloat((grossSales - netSales - netTCGTax - netShipping).toFixed(2))
        const saleDate = periodEnd || new Date().toISOString().split('T')[0]
        resolve({
          records: [{ platform: 'tcgplayer', amount: parseFloat(grossSales.toFixed(2)), fees: derivedFees, shipping: parseFloat(netShipping.toFixed(2)), sale_date: saleDate, period_start: periodStart || saleDate, period_end: periodEnd || saleDate, entity, net_sales: parseFloat(netSales.toFixed(2)), num_orders: numOrders }],
          meta: { periodStart, periodEnd, entity, numOrders, grossSales, derivedFees, netSales, netShipping }
        })
      } catch (err: any) { reject(new Error('TCGplayer parse failed: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsArrayBuffer(file)
  })
}

// ── eBay Parser ───────────────────────────────────────────────────────────────
function parseEbayCSV(file: File): Promise<{ records: any[], meta: any }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string
        const wb = XLSX.read(text, { type: 'string', raw: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws)
        const pd = (v: any) => parseFloat(String(v || '0').replace(/[$,\s]/g, '')) || 0
        let totalGross = 0, totalFees = 0, totalNet = 0, totalShippingLabels = 0, rowCount = 0
        for (const row of rows) {
          if (!row['Listing title']) continue
          const itemSales = pd(row['Item sales'])
          const totalSellingCost = pd(row['Total selling costs'])
          const shippingLabels = pd(row['Shipping labels cost (Amount you paid to buy shipping labels on eBay)'])
          const netSales = pd(row['Net sales (Net of taxes and selling costs)'])
          if (itemSales === 0 && Number(row['Quantity sold'] || 0) === 0) continue
          totalGross += itemSales
          totalFees += parseFloat((totalSellingCost - shippingLabels).toFixed(2))
          totalNet += netSales
          totalShippingLabels += shippingLabels
          rowCount++
        }
        const saleDate = new Date().toISOString().split('T')[0]
        resolve({
          records: [{ platform: 'ebay', amount: parseFloat(totalGross.toFixed(2)), fees: parseFloat(totalFees.toFixed(2)), shipping: parseFloat(totalShippingLabels.toFixed(2)), sale_date: saleDate, period_start: saleDate, period_end: saleDate, entity: 'llc', net_sales: parseFloat(totalNet.toFixed(2)), num_orders: rowCount }],
          meta: { totalGross, totalFees, totalNet, totalShippingLabels, rows: rowCount }
        })
      } catch (err: any) { reject(new Error('eBay parse failed: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsText(file)
  })
}

// ── AI Parser (ManaPool, receipts, PDFs) ──────────────────────────────────────
async function parseFileWithAI(file: File, mode: 'sales' | 'expenses'): Promise<any[]> {
  try {
    const isImage = file.type.startsWith('image/')
    const isPDF = file.type === 'application/pdf'
    const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv'
    const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    let content: any[] = []
    if (isCSV || isXLSX) {
      const text = await file.text()
      const prompt = mode === 'sales'
        ? `ManaPool sales report. Extract sales. Return ONLY JSON array:\n[{"platform":"manapool","amount":0,"fees":0,"shipping":0,"date":"YYYY-MM-DD"}]\n\n${text.slice(0,8000)}`
        : `Expense receipt. Extract expenses. Return ONLY JSON array:\n[{"category":"${EXPENSE_CATEGORIES.join('|')}","cost":0,"date":"YYYY-MM-DD","notes":"vendor"}]\n\n${text.slice(0,8000)}`
      content = [{ type: 'text', text: prompt }]
    } else if (isImage || isPDF) {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const prompt = mode === 'sales'
        ? 'Sales receipt. Return ONLY JSON array: [{"platform":"tcgplayer|ebay|manapool|other","amount":0,"fees":0,"shipping":0,"date":"YYYY-MM-DD"}]'
        : `Expense receipt. Return ONLY JSON array: [{"category":"${EXPENSE_CATEGORIES.join('|')}","cost":0,"date":"YYYY-MM-DD","notes":"vendor"}]`
      content = [
        { type: isImage ? 'image' : 'document', source: { type: 'base64', media_type: file.type || 'application/pdf', data: base64 } },
        { type: 'text', text: prompt }
      ]
    } else return []
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content }] })
    })
    const data = await res.json()
    const text = data.content?.[0]?.text || '[]'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch { return [] }
}

// ── Depreciation ──────────────────────────────────────────────────────────────
function calcDepreciation(cost: number, life: number, purchaseDate: string, year: number) {
  const purchaseYear = new Date(purchaseDate).getFullYear()
  const yearsIn = year - purchaseYear
  if (yearsIn < 0 || yearsIn >= life) return { slAnnual: 0, slAccumulated: 0, slBookValue: cost, sec179: cost }
  const slAnnual = parseFloat((cost / life).toFixed(2))
  const slAccumulated = parseFloat((slAnnual * (yearsIn + 1)).toFixed(2))
  const slBookValue = parseFloat(Math.max(0, cost - slAccumulated).toFixed(2))
  return { slAnnual, slAccumulated, slBookValue, sec179: cost }
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else onLogin()
    setLoading(false)
  }
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg,${C.navyDark},${C.navy})`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: FONT }}>
      <div style={{ background: C.white, borderRadius: '20px', padding: '40px 32px', width: '100%', maxWidth: '360px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', textAlign: 'center' }}>
        <h1 style={{ fontFamily: FONT, fontSize: '22px', color: C.navy, marginBottom: '28px', fontWeight: 700 }}>Mana Social</h1>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: '10px', fontSize: '14px', background: '#F5F6FA', width: '100%', fontFamily: FONT }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: '10px', fontSize: '14px', background: '#F5F6FA', width: '100%', fontFamily: FONT }} />
          {error && <div style={{ padding: '8px 12px', background: '#FEE8EF', color: '#C0254A', borderRadius: '8px', fontSize: '13px' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ marginTop: '8px', padding: '14px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ marginTop: '24px', fontSize: '11px', color: '#C0C8D8', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>Culture · Community · Games</p>
      </div>
    </div>
 C.text }}>{fmt(q.grossPay)}</strong></span>
                <span>Taxable: <strong style={{ color: C.text }}>{fmt(q.taxable)}</strong></span>
              </div>
            </div>
          ))}
          {disbursements.length > 0 && (
            <div style={card}>
              <span style={secHdr}>OWNER DRAWS</span>
              {disbursements.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div><div style={{ fontWeight: 500, fontSize: '15px' }}>{d.recipient}</div><div style={{ fontSize: '12px', color: C.muted }}>{d.disbursement_date}</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '16px' }}>{fmt(Number(d.amount))}</span>
                    <button onClick={() => handleDelete('disbursements', d.id)} style={delBtn}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )

      case 'payroll': return (
        <div>
          <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL PAYROLL</div>
            <div style={{ fontSize: '30px', fontWeight: 900, color: '#fda4af' }}>{fmt(staffingCosts)}</div>
            <div style={{ fontSize: '13px', opacity: 0.5, marginTop: '2px' }}>FICA: {fmt(staffingCosts*0.153)} · FUTA: {fmt(staffingCosts*0.006)}</div>
            <div style={{ fontSize: '13px', opacity: 0.5 }}>Roth IRA Contributed: {fmt(payroll.reduce((a,r)=>a+Number(r.roth_ira_contributed||0),0))}</div>
          </div>
          {payroll.map(p => (
            <div key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '2px', fontSize: '15px' }}>{p.employee_name}</div>
                <div style={{ fontSize: '13px', color: C.muted }}>{p.pay_date}{p.pay_period?` · Period ends ${p.pay_period}`:''}</div>
                {p.hours_worked > 0 && <div style={{ fontSize: '13px', color: C.muted }}>{p.hours_worked} hrs @ ${p.hourly_rate}/hr</div>}
                {p.roth_ira_contributed > 0 && <div style={{ fontSize: '12px', color: C.teal }}>Roth IRA: {fmt(p.roth_ira_contributed)} contributed</div>}
                <div style={{ fontSize: '12px', color: C.muted }}>FICA: {fmt(Number(p.amount)*0.153)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '17px' }}>{fmt(Number(p.amount))}</span>
                <button onClick={() => startEdit('payroll', p)} style={editBtn}>Edit</button>
                <button onClick={() => handleDelete('payroll', p.id)} style={delBtn}>×</button>
              </div>
            </div>
          ))}
          {payroll.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No payroll this period</div>}
        </div>
      )

      default: return null
    }
  }

  if (checkingAuth) return (
    <div style={{ minHeight: '100vh', background: C.navyDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid rgba(45,191,184,0.2)', borderTopColor: C.teal, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const TABS = [
    { id: 'summary',    label: 'Summary'    },
    { id: 'income',     label: 'Sales'      },
    { id: 'expense',    label: 'Expenses'   },
    { id: 'cogs',       label: 'COGS'       },
    { id: 'accounting', label: 'Accounting' },
    { id: 'assets',     label: 'Assets'     },
    { id: 'deductions', label: 'Deductions' },
    { id: 'tax',        label: 'Tax'        },
    { id: 'payroll',    label: 'Payroll'    },
  ]

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', paddingBottom: '140px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>
        <header style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 900, color: C.navy, fontSize: '17px', letterSpacing: '-0.3px', fontFamily: FONT }}>MANA SOCIAL LLC</div>
            <button onClick={signOut} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '6px 14px', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: FONT }}>Sign out</button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `2px solid ${C.border}`, fontWeight: 'bold', background: C.white, fontFamily: FONT, fontSize: '14px' }}>
              <option value={2026}>2026</option>
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 2, padding: '10px', borderRadius: '10px', border: `2px solid ${C.border}`, fontWeight: 'bold', background: C.white, fontFamily: FONT, fontSize: '14px' }}>
              <option value={0}>Full Year</option>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i+1}>{new Date(0,i).toLocaleString('default',{month:'long'})}</option>)}
            </select>
          </div>
        </header>

        {editingItem ? renderForm() : renderTab()}

        {!editingItem && (
          <button onClick={() => setIsQuickAddOpen(true)} style={{ position: 'fixed', bottom: '120px', right: '20px', width: '62px', height: '62px', borderRadius: '31px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', fontSize: '30px', border: '3px solid #fff', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', zIndex: 500, cursor: 'pointer' }}>+</button>
        )}

        {isQuickAddOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.9)', display: 'flex', alignItems: 'flex-end', padding: '20px', zIndex: 1000 }}>
            <div style={{ background: C.white, width: '100%', borderRadius: '20px', padding: '24px', fontFamily: FONT }}>
              <h2 style={{ fontWeight: 900, marginBottom: '16px', color: C.navy, fontSize: '17px' }}>ADD RECORD</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  ['sales',           'SALE',       C.green],
                  ['collections',     'COLLECTION', C.text],
                  ['expenses',        'EXPENSE',    '#ef4444'],
                  ['payroll',         'PAYROLL',    C.text],
                  ['cogs_inventory',  'COGS',       C.purple],
                  ['mileage_log',     'MILEAGE',    C.teal],
                  ['assets',          'ASSET',      C.navy],
                  ['accounts_payable','PAYABLE',    C.pink],
                ].map(([table, l, color]) => (
                  <button key={String(table)} onClick={() => { setEditingItem({ table: String(table) }); setIsQuickAddOpen(false) }} style={{ padding: '17px', borderRadius: '12px', border: `1px solid ${C.border}`, fontWeight: 'bold', fontSize: '15px', background: C.white, color: color as string, cursor: 'pointer', fontFamily: FONT }}>{l}</button>
                ))}
                <button onClick={() => { setEditingItem({ table: 'disbursements' }); setIsQuickAddOpen(false) }} style={{ gridColumn: 'span 2', padding: '17px', borderRadius: '12px', border: `2px solid ${C.teal}`, color: C.teal, fontWeight: 900, background: C.white, cursor: 'pointer', fontSize: '15px', fontFamily: FONT }}>OWNER DRAW</button>
              </div>
              <button onClick={() => setIsQuickAddOpen(false)} style={{ width: '100%', marginTop: '16px', border: 'none', background: 'none', color: C.muted, fontWeight: 'bold', cursor: 'pointer', padding: '8px', fontSize: '14px', fontFamily: FONT }}>CANCEL</button>
            </div>
          </div>
        )}
      </div>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.white, borderTop: `2px solid ${C.border}`, display: 'flex', zIndex: 400, height: '100px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: '0 0 auto', minWidth: '60px', border: 'none', background: 'none', fontSize: '10px', fontWeight: 900, color: activeTab === t.id ? C.teal : C.muted, padding: '8px 6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, borderTop: activeTab === t.id ? `3px solid ${C.teal}` : '3px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
