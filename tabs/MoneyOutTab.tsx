'use client'
import React, { useState, useMemo } from 'react'
import { FONT, EXPENSE_CATEGORIES, DEDUCTIBILITY } from '@/lib/constants'
import { fmt } from '@/lib/format'
import SalesTaxSection from '@/components/SalesTaxSection'
import VendorManager from '@/components/VendorManager'
import { getAgingBucket, getBillStatus, AGING_BUCKET_LABELS, AGING_BUCKET_COLORS, PAYMENT_TERM_LABELS, daysOverdue, type AgingBucket, type PaymentTerm } from '@/lib/paymentTerms'

export default function MoneyOutTab(p: any) {
  const { C, expenses, payroll, accountsPayable, supplyCosts, sales, salesTaxRemittances, vendors, supabase, fetchData, startEdit, handleDelete, setEditingItem } = p
  const [view, setView] = useState<'expenses'|'payroll'>('expenses')
  const [apView, setApView] = useState<'aging'|'list'>('aging')
  const [showVendorManager, setShowVendorManager] = useState(false)
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({})

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const editBtn: React.CSSProperties = { background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: C.muted, cursor: 'pointer', fontFamily: FONT }
  const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '18px', fontFamily: FONT }

  const opExpenses = expenses.filter((e: any) => !e.asset_created).reduce((s: number, r: any) => s + Number(r.cost), 0)
  const totalAPOwed = accountsPayable.reduce((a: number, r: any) => a + Math.max(0, (Number(r.total_amount) || 0) - (Number(r.amount_paid) || 0)), 0)
  const staffing = payroll.reduce((s: number, r: any) => s + Number(r.amount), 0)

  const toggle = (k: string) => setExpandedTiles(prev => ({ ...prev, [k]: !prev[k] }))

  // Group bills by aging bucket
  const apByBucket = useMemo(() => {
    const buckets: Record<AgingBucket, any[]> = { not_due: [], '0_30': [], '31_60': [], '61_90': [], '90_plus': [], paid: [] }
    accountsPayable.forEach((bill: any) => {
      if (!bill.due_date) return
      const b = getAgingBucket(bill)
      buckets[b].push(bill)
    })
    return buckets
  }, [accountsPayable])

  const bucketOrder: AgingBucket[] = ['90_plus', '61_90', '31_60', '0_30', 'not_due', 'paid']

  const renderBill = (b: any) => {
    const paid = Number(b.amount_paid || 0)
    const total = Number(b.total_amount || 0)
    const owed = total - paid
    const status = getBillStatus(b)
    const days = b.due_date ? daysOverdue(b.due_date) : 0
    return (
      <div key={b.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: C.text }}>{b.vendor_name}</span>
              <span style={{ padding: '2px 6px', borderRadius: '4px', background: `${status.color}20`, color: status.color, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>{status.label}</span>
            </div>
            {b.description && <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{b.description}</div>}
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>
              Invoice {b.invoice_date}
              {b.due_date && ` · Due ${b.due_date}`}
              {b.payment_terms && ` · ${PAYMENT_TERM_LABELS[b.payment_terms as PaymentTerm] || b.payment_terms}`}
              {days > 0 && owed > 0 && <span style={{ color: '#ef4444', fontWeight: 'bold' }}> · {days} days late</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', marginLeft: '8px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: owed > 0 ? C.pink : C.teal }}>{fmt(owed)} {owed <= 0 ? '✓' : ''}</div>
            <div style={{ fontSize: '11px', color: C.muted }}>of {fmt(total)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button onClick={() => startEdit('accounts_payable', b)} style={editBtn}>Update</button>
          <button onClick={() => handleDelete('accounts_payable', b.id)} style={{ ...editBtn, color: C.pink }}>Delete</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {(['expenses','payroll'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${view===v?C.teal:C.border}`, background: view===v?'rgba(45,191,184,0.1)':C.cardBg, fontSize: '14px', fontWeight: view===v?900:400, color: view===v?C.teal:C.muted, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize' }}>{v}</button>
        ))}
      </div>

      {view === 'expenses' && <>
        <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL EXPENSES + A/P</div>
          <div style={{ fontSize: '30px', fontWeight: 900, color: '#fda4af' }}>{fmt(opExpenses + totalAPOwed)}</div>
        </div>

        {/* Vendor Manager (toggle) */}
        {showVendorManager && (
          <VendorManager C={C} vendors={vendors} supabase={supabase} fetchData={fetchData} onClose={() => setShowVendorManager(false)} />
        )}

        {/* AP HEADER with view toggle */}
        <div style={{ ...card, border: `1px solid rgba(240,192,64,0.4)`, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: '15px', color: '#7A5A00' }}>Accounts Payable</div>
              <div style={{ fontSize: '12px', color: C.muted }}>{accountsPayable.length} bills · {fmt(totalAPOwed)} owed</div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setShowVendorManager(!showVendorManager)} style={{ background: 'none', border: `1px solid ${C.gold}`, borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#7A5A00', cursor: 'pointer', fontFamily: FONT, fontWeight: 'bold' }}>{showVendorManager ? 'Hide' : 'Vendors'}</button>
              <button onClick={() => setEditingItem({ table: 'accounts_payable' })} style={{ background: C.gold, color: '#7A5A00', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>+ Bill</button>
            </div>
          </div>

          {/* View toggle: Aging vs List */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {(['aging','list'] as const).map(v => (
              <button key={v} onClick={() => setApView(v)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${apView===v?C.teal:C.border}`, background: apView===v?'rgba(45,191,184,0.1)':C.cardBg, fontSize: '12px', fontWeight: apView===v?700:400, color: apView===v?C.teal:C.muted, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize' }}>{v === 'aging' ? 'Aging Buckets' : 'List View'}</button>
            ))}
          </div>

          {accountsPayable.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '13px' }}>No accounts payable yet</div>
          ) : apView === 'aging' ? (
            // AGING BUCKET VIEW
            <div>
              {bucketOrder.map((bucket) => {
                const bills = apByBucket[bucket]
                if (bills.length === 0) return null
                const bucketTotal = bills.reduce((sum: number, b: any) => sum + ((Number(b.total_amount) || 0) - (Number(b.amount_paid) || 0)), 0)
                const color = AGING_BUCKET_COLORS[bucket]
                const key = `b_${bucket}`
                return (
                  <div key={bucket} style={{ background: C.inputBg, borderRadius: '10px', marginBottom: '8px', borderLeft: `3px solid ${color}`, overflow: 'hidden' }}>
                    <div onClick={() => toggle(key)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color }}>{AGING_BUCKET_LABELS[bucket]}</div>
                        <div style={{ fontSize: '11px', color: C.muted }}>{bills.length} bill{bills.length !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 900, fontSize: '15px', color: bucket === 'paid' ? C.teal : color }}>{fmt(bucketTotal)}</span>
                        <span style={{ color: C.muted, fontSize: '12px' }}>{expandedTiles[key] ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {expandedTiles[key] && (
                      <div style={{ background: C.cardBg }}>
                        {bills.map(renderBill)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            // LIST VIEW (simple list, sorted by due date)
            <div style={{ background: C.cardBg, borderRadius: '10px', overflow: 'hidden' }}>
              {[...accountsPayable].sort((a: any, b: any) => {
                const da = a.due_date || a.invoice_date || ''
                const db = b.due_date || b.invoice_date || ''
                return da.localeCompare(db)
              }).map(renderBill)}
            </div>
          )}
        </div>

        {EXPENSE_CATEGORIES.filter((cat: string) => expenses.some((e: any) => e.category === cat)).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No expenses this period — tap + to add one</div>
        ) : EXPENSE_CATEGORIES.filter((cat: string) => expenses.some((e: any) => e.category === cat)).map((cat: string) => {
          const catExp = expenses.filter((e: any) => e.category === cat)
          const catTotal = catExp.reduce((a: number, e: any) => a + Number(e.cost), 0)
          const rule = DEDUCTIBILITY[cat]
          return (
            <div key={cat} style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div onClick={() => toggle(`e_${cat}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '15px', color: C.navy }}>{cat}</div>
                  <div style={{ fontSize: '12px', color: C.muted }}>{catExp.length} item{catExp.length !== 1 ? 's' : ''}{rule ? ` · ${rule.label}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 900, color: '#ef4444', fontSize: '18px' }}>{fmt(-catTotal)}</span>
                  <span style={{ color: C.muted }}>{expandedTiles[`e_${cat}`] ? '▲' : '▼'}</span>
                </div>
              </div>
              {expandedTiles[`e_${cat}`] && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {catExp.map((e: any) => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                      <div>
                        {e.notes && <div style={{ fontSize: '13px', fontWeight: 600 }}>{e.notes}</div>}
                        <div style={{ fontSize: '12px', color: C.muted }}>{e.purchase_date} · {e.user_name || 'Cam'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '15px' }}>{fmt(-Number(e.cost))}</span>
                        <button onClick={() => startEdit('expenses', e)} style={editBtn}>Edit</button>
                        <button onClick={() => handleDelete('expenses', e.id)} style={delBtn}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <SalesTaxSection C={C} sales={sales} salesTaxRemittances={salesTaxRemittances} fetchData={fetchData} />
      </>}

      {view === 'payroll' && <>
        <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL PAYROLL</div>
          <div style={{ fontSize: '30px', fontWeight: 900, color: '#fda4af' }}>{fmt(staffing)}</div>
          <div style={{ fontSize: '13px', opacity: 0.5, marginTop: '2px' }}>FICA: {fmt(staffing * 0.153)} · FUTA: {fmt(staffing * 0.006)}</div>
        </div>
        {Array.from(new Set(payroll.map((p: any) => p.employee_name))).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No payroll this period — tap + to add one</div>
        ) : Array.from(new Set(payroll.map((p: any) => p.employee_name))).map((emp: any) => {
          const empPay = payroll.filter((p: any) => p.employee_name === emp)
          const empTotal = empPay.reduce((a: number, p: any) => a + Number(p.amount), 0)
          return (
            <div key={emp} style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div onClick={() => toggle(`p_${emp}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '15px', color: C.navy }}>{emp}</div>
                  <div style={{ fontSize: '12px', color: C.muted }}>{empPay.length} payment{empPay.length !== 1 ? 's' : ''} · FICA {fmt(empTotal * 0.153)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 900, fontSize: '18px' }}>{fmt(empTotal)}</span>
                  <span style={{ color: C.muted }}>{expandedTiles[`p_${emp}`] ? '▲' : '▼'}</span>
                </div>
              </div>
              {expandedTiles[`p_${emp}`] && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {empPay.map((pay: any) => (
                    <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{pay.pay_date}</div>
                        {pay.hours_worked > 0 && <div style={{ fontSize: '12px', color: C.muted }}>{pay.hours_worked} hrs @ ${pay.hourly_rate}/hr</div>}
                        {pay.roth_ira_contributed > 0 && <div style={{ fontSize: '12px', color: C.teal }}>Roth IRA: {fmt(pay.roth_ira_contributed)}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px' }}>{fmt(Number(pay.amount))}</span>
                        <button onClick={() => startEdit('payroll', pay)} style={editBtn}>Edit</button>
                        <button onClick={() => handleDelete('payroll', pay.id)} style={delBtn}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </>}
    </div>
  )
}
