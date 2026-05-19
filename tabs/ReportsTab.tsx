'use client'
import React, { useState } from 'react'
import { FONT, EXPENSE_CATEGORIES, DEDUCTIBILITY, ASSET_CATEGORIES, USEFUL_LIFE, MILEAGE_RATE } from '@/lib/constants'
import { fmt, fmtK, pctFmt } from '@/lib/format'
import { calcDepreciation, assetTotals } from '@/lib/calculations'

export default function ReportsTab(p: any) {
  const { C, sales, expenses, accountsPayable, payroll, mileageLog, cogsInventory, allCogsInventory, assets, bankAccounts, selectedYear } = p
  const [view, setView] = useState<'menu'|'pl'|'balance'|'tax'|'deductions'|'assets'>('menu')

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const secHdr: React.CSSProperties = { fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', fontFamily: FONT, display: 'block' }

  const gross = sales.reduce((s: number, r: any) => s + Number(r.amount), 0)
  const totalPlatformFees = sales.reduce((s: number, r: any) => s + Number(r.fees || 0), 0)
  const totalShipping = sales.reduce((s: number, r: any) => s + Number(r.shipping || 0), 0)
  const netSalesAmt = sales.reduce((s: number, r: any) => s + Number(r.net_sales || r.amount), 0)
  const expByCategory = EXPENSE_CATEGORIES.reduce((acc: any, cat: string) => {
    acc[cat] = expenses.filter((e: any) => e.category === cat && !e.asset_created).reduce((s: number, r: any) => s + Number(r.cost), 0)
    return acc
  }, {})
  const opExpenses = Object.values(expByCategory).reduce((a: number, b: any) => a + b, 0)
  const staffing = payroll.reduce((s: number, r: any) => s + Number(r.amount), 0)
  const totalAPOwed = accountsPayable.reduce((a: number, r: any) => a + Math.max(0, Number(r.total_amount) - Number(r.amount_paid || 0)), 0)
  const cogsRecognized = cogsInventory.reduce((a: number, r: any) => {
    const ratio = r.total_units > 0 ? Math.min((r.sold_units || 0) / r.total_units, 1) : 0
    return a + parseFloat(r.total_cost || 0) * ratio
  }, 0)
  const { totalDepreciation, totalAssetCost, totalAccumulatedDep, totalBookValue } = assetTotals(assets, selectedYear)
  const grossMargin = netSalesAmt - cogsRecognized
  const totalOpEx = opExpenses + staffing + totalPlatformFees + totalDepreciation
  const netIncome = grossMargin - totalOpEx
  const totalCash = bankAccounts.filter((b: any) => b.account_type !== 'Credit').reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0)
  const totalCreditDebt = bankAccounts.filter((b: any) => b.account_type === 'Credit').reduce((a: number, r: any) => a + Math.abs(Number(r.current_balance || 0)), 0)
  const endingInventory = allCogsInventory.reduce((a: number, r: any) => {
    const ratio = r.total_units > 0 ? Math.min((r.sold_units || 0) / r.total_units, 1) : 0
    return a + parseFloat(r.total_cost || 0) * (1 - ratio)
  }, 0)
  const totalMiles = mileageLog.reduce((a: number, r: any) => a + parseFloat(r.miles || 0), 0)
  const mileageDeduction = totalMiles * MILEAGE_RATE
  const totalLiabilities = totalAPOwed + totalCreditDebt
  const totalAssets = totalCash + endingInventory + totalAPOwed + totalBookValue
  const ownerEquity = totalAssets - totalLiabilities

  const quarters = [
    { label: 'Q1', start: '2026-01-01', end: '2026-03-31' },
    { label: 'Q2', start: '2026-04-01', end: '2026-06-30' },
    { label: 'Q3', start: '2026-07-01', end: '2026-09-30' },
    { label: 'Q4', start: '2026-10-01', end: '2026-12-31' },
  ].map(q => {
    const qS = sales.filter((r: any) => r.sale_date >= q.start && r.sale_date <= q.end)
    const qE = expenses.filter((r: any) => r.purchase_date >= q.start && r.purchase_date <= q.end)
    const qP = payroll.filter((r: any) => r.pay_date >= q.start && r.pay_date <= q.end)
    const netRev = qS.reduce((a: number, r: any) => a + Number(r.amount), 0) - qS.reduce((a: number, r: any) => a + Number(r.fees || 0) + Number(r.shipping || 0), 0)
    const exp = qE.reduce((a: number, r: any) => a + Number(r.cost), 0)
    const grossPay = qP.reduce((a: number, r: any) => a + Number(r.amount), 0)
    const taxable = Math.max(0, netRev - exp - grossPay)
    return { ...q, fica: grossPay * 0.153, futa: grossPay * 0.006, caUI: grossPay * 0.034, fedEst: taxable * 0.22, pte: taxable * 0.093, grand: grossPay * 0.153 + grossPay * 0.006 + grossPay * 0.034 + taxable * 0.22 + taxable * 0.093 }
  })
  const ytdTax = quarters.reduce((a, q) => a + q.grand, 0)

  const PLRow = ({ label, value, bold = false, neg = false }: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: `${bold ? '12px' : '8px'} 0`, borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: bold ? '15px' : '14px', fontWeight: bold ? 700 : 400, color: bold ? C.navy : C.text, fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: bold ? '16px' : '14px', fontWeight: bold ? 700 : 400, color: (value < 0 || neg) ? '#ef4444' : (bold && value > 0 ? C.green : C.text), fontFamily: FONT }}>
        {(value < 0 || neg) ? `(${fmt(Math.abs(value))})` : fmt(Math.abs(value))}
      </span>
    </div>
  )

  if (view === 'menu') {
    const items: [string, string, string][] = [
      ['pl', 'Profit & Loss', 'Income statement — revenue, COGS, expenses, net income'],
      ['balance', 'Balance Sheet', 'Assets, liabilities, owner equity'],
      ['tax', 'Tax Estimates', 'Quarterly federal + CA PTE estimates'],
      ['deductions', 'Deductions', 'Expense deductibility + mileage'],
      ['assets', 'Assets & Depreciation', 'Fixed assets and depreciation schedule'],
    ]
    return (
      <div>
        <div style={{ ...card, padding: '14px 16px', background: 'rgba(45,191,184,0.08)', border: `1px solid rgba(45,191,184,0.2)` }}>
          <div style={{ fontSize: '13px', color: '#1A7A75', fontWeight: 'bold' }}>Reports — read-only summaries for tax time. Confirm figures with Kannie.</div>
        </div>
        {items.map(([id, title, desc]) => (
          <div key={id} onClick={() => setView(id as any)} style={{ ...card, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: '15px', color: C.navy }}>{title}</div>
              <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{desc}</div>
            </div>
            <span style={{ color: C.teal, fontSize: '20px' }}>→</span>
          </div>
        ))}
      </div>
    )
  }

  const BackBtn = () => (
    <button onClick={() => setView('menu')} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: FONT, marginBottom: '12px' }}>← Reports</button>
  )

  if (view === 'pl') return (
    <div>
      <BackBtn />
      <div style={card}>
        <span style={secHdr}>Income Statement · {selectedYear}</span>
        <PLRow label="Gross Revenue" value={gross} bold />
        <PLRow label="Less: Selling Fees" value={totalPlatformFees} neg />
        <PLRow label="Less: Shipping" value={totalShipping} neg />
        <PLRow label="Net Sales" value={netSalesAmt} bold />
        <PLRow label="Cost of Goods Sold" value={cogsRecognized} neg />
        <PLRow label="Gross Profit" value={grossMargin} bold />
        {EXPENSE_CATEGORIES.filter((c: string) => expByCategory[c] > 0).map((c: string) => (
          <PLRow key={c} label={c} value={expByCategory[c]} neg />
        ))}
        <PLRow label="Salaries & Wages" value={staffing} neg />
        {totalDepreciation > 0 && <PLRow label="Depreciation" value={totalDepreciation} neg />}
        <PLRow label="Net Income" value={netIncome} bold />
      </div>
    </div>
  )

  if (view === 'balance') return (
    <div>
      <BackBtn />
      <div style={card}>
        <span style={secHdr}>Balance Sheet</span>
        <PLRow label="Cash & Bank" value={totalCash} />
        <PLRow label="Inventory" value={endingInventory} />
        <PLRow label="Accounts Receivable" value={totalAPOwed} />
        <PLRow label="Net Fixed Assets" value={totalBookValue} />
        <PLRow label="Total Assets" value={totalAssets} bold />
        <PLRow label="Accounts Payable" value={totalAPOwed} neg />
        <PLRow label="Credit Card Debt" value={totalCreditDebt} neg />
        <PLRow label="Total Liabilities" value={totalLiabilities} bold />
        <PLRow label="Owner's Equity" value={ownerEquity} bold />
      </div>
    </div>
  )

  if (view === 'tax') return (
    <div>
      <BackBtn />
      <div style={{ ...card, background: C.navyDark, color: '#fff' }}>
        <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>YTD EST. TOTAL TAX</div>
        <div style={{ fontSize: '34px', fontWeight: 700, color: '#fda4af' }}>{fmtK(ytdTax)}</div>
      </div>
      {quarters.map(q => (
        <div key={q.label} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontWeight: 700, fontSize: '16px', color: C.navy }}>{q.label} 2026</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: C.pink }}>{fmt(q.grand)}</div>
          </div>
          <PLRow label="FICA (941)" value={q.fica} neg />
          <PLRow label="FUTA (940)" value={q.futa} neg />
          <PLRow label="CA UI/ETT" value={q.caUI} neg />
          <PLRow label="Federal 1040-ES" value={q.fedEst} neg />
          <PLRow label="CA PTE (3893)" value={q.pte} neg />
        </div>
      ))}
    </div>
  )

  if (view === 'deductions') return (
    <div>
      <BackBtn />
      <div style={card}>
        <span style={secHdr}>Expense Deductibility</span>
        {EXPENSE_CATEGORIES.filter((c: string) => expByCategory[c] > 0).map((c: string) => {
          const rule = DEDUCTIBILITY[c]
          return (
            <div key={c} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{c}</div>
                <div style={{ fontSize: '11px', color: C.muted }}>{rule.label} · {rule.line}</div>
              </div>
              <span style={{ fontWeight: 700 }}>{fmt(expByCategory[c])}</span>
            </div>
          )
        })}
      </div>
      <div style={card}>
        <span style={secHdr}>Mileage</span>
        <div style={{ fontSize: '14px' }}>{totalMiles.toFixed(1)} miles × {MILEAGE_RATE * 100}¢ = <strong style={{ color: C.teal }}>{fmt(mileageDeduction)}</strong></div>
      </div>
    </div>
  )

  if (view === 'assets') return (
    <div>
      <BackBtn />
      <div style={{ ...card, background: C.navyDark, color: '#fff' }}>
        <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold' }}>FIXED ASSETS (COST)</div>
        <div style={{ fontSize: '28px', fontWeight: 900 }}>{fmt(totalAssetCost)}</div>
        <div style={{ fontSize: '13px', opacity: 0.6, marginTop: '4px' }}>Book {fmt(totalBookValue)} · Acc. Dep {fmt(totalAccumulatedDep)}</div>
      </div>
      {ASSET_CATEGORIES.map((cat: string) => {
        const catAssets = assets.filter((a: any) => a.category === cat)
        if (!catAssets.length) return null
        return (
          <div key={cat} style={card}>
            <span style={secHdr}>{cat}</span>
            {catAssets.map((a: any) => {
              const life = parseInt(a.useful_life_yrs) || USEFUL_LIFE[a.category] || 5
              const { slAnnual, slBookValue } = calcDepreciation(parseFloat(a.cost), life, a.purchase_date, selectedYear)
              return (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{a.description}</div>
                    <div style={{ fontSize: '11px', color: C.muted }}>{a.purchase_date} · {life}yr · SL/yr {fmt(slAnnual)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{fmt(parseFloat(a.cost))}</div>
                    <div style={{ fontSize: '11px', color: C.muted }}>Book {fmt(slBookValue)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )

  return null
}
