'use client'
import React from 'react'
import { FONT } from '@/lib/constants'
import { fmt, fmtK, pctFmt } from '@/lib/format'

export default function HomeTab(p: any) {
  const { C, sales, expenses, accountsPayable, payroll, reconTransactions, setActiveTab } = p

  const gross = sales.reduce((s: number, r: any) => s + Number(r.amount), 0)
  const totalPlatformFees = sales.reduce((s: number, r: any) => s + Number(r.fees || 0), 0)
  const totalShipping = sales.reduce((s: number, r: any) => s + Number(r.shipping || 0), 0)
  const netSalesAmt = sales.reduce((s: number, r: any) => s + Number(r.net_sales || r.amount), 0)
  const opExpenses = expenses.filter((e: any) => !e.asset_created).reduce((s: number, r: any) => s + Number(r.cost), 0)
  const totalAPOwed = accountsPayable.reduce((a: number, r: any) => a + Math.max(0, Number(r.total_amount) - Number(r.amount_paid || 0)), 0)
  const staffing = payroll.reduce((s: number, r: any) => s + Number(r.amount), 0)
  const totalCosts = totalPlatformFees + totalShipping + opExpenses + totalAPOwed + staffing
  const netRevenue = gross - totalCosts

  const unreconciled = reconTransactions.filter((t: any) => !t.is_reconciled).length
  const apDueSoon = accountsPayable.filter((r: any) => Number(r.total_amount) - Number(r.amount_paid || 0) > 0).length

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }

  return (
    <div>
      {(unreconciled > 0 || apDueSoon > 0) && (
        <div style={{ ...card, padding: '14px 16px', background: 'rgba(240,192,64,0.1)', border: `1px solid ${C.gold}` }}>
          <div style={{ fontWeight: 700, color: '#7A5A00', fontSize: '14px', marginBottom: '6px' }}>Needs attention</div>
          {unreconciled > 0 && (
            <div onClick={() => setActiveTab('bank')} style={{ fontSize: '13px', color: C.text, padding: '4px 0', cursor: 'pointer' }}>
              • {unreconciled} bank transaction{unreconciled !== 1 ? 's' : ''} not reconciled →
            </div>
          )}
          {apDueSoon > 0 && (
            <div onClick={() => setActiveTab('out')} style={{ fontSize: '13px', color: C.text, padding: '4px 0', cursor: 'pointer' }}>
              • {apDueSoon} accounts payable still owed →
            </div>
          )}
        </div>
      )}

      <div style={{ background: C.navyDark, color: '#fff', padding: '28px', borderRadius: '20px', marginBottom: '12px', fontFamily: FONT }}>
        <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>GROSS REVENUE</div>
        <div style={{ fontSize: '32px', fontWeight: 400, marginBottom: '16px' }}>{fmtK(gross)}</div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', marginBottom: '16px' }} />
        <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>TOTAL COSTS</div>
        <div style={{ fontSize: '32px', fontWeight: 400, color: '#fda4af', marginBottom: '16px' }}>{fmtK(-totalCosts)}</div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', marginBottom: '16px' }} />
        <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>NET REVENUE</div>
        <div style={{ fontSize: '46px', fontWeight: 900, color: netRevenue >= 0 ? '#4ade80' : '#fda4af' }}>{fmtK(netRevenue)}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        {[
          { label: 'Net Margin %', value: pctFmt(netRevenue, netSalesAmt), color: netRevenue >= 0 ? C.teal : C.pink },
          { label: 'Selling Fees', value: fmt(totalPlatformFees), color: C.pink },
          { label: 'Op. Expenses', value: fmt(opExpenses), color: C.gold },
          { label: 'Payroll', value: fmt(staffing), color: C.purple },
        ].map(t => (
          <div key={t.label} style={{ ...card, padding: '14px', marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>{t.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: t.color }}>{t.value}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>SOLE PROP</div><div style={{ fontSize: '14px', fontWeight: 700, color: C.gold }}>Jan 1 – Mar 17</div></div>
        <div style={{ color: C.border, fontSize: '20px' }}>→</div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>MANA SOCIAL LLC</div><div style={{ fontSize: '14px', fontWeight: 700, color: C.teal }}>Mar 18 – Dec 31</div></div>
      </div>
    </div>
  )
}
