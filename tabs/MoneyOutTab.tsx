'use client'
import React, { useState, useMemo } from 'react'
import { FONT, EXPENSE_CATEGORIES, type Palette } from '@/lib/constants'
import { fmt } from '@/lib/format'
import RecordPaymentModal from '@/components/RecordPaymentModal'

interface Props {
  expenses: any[]
  accountsPayable: any[]
  payroll: any[]
  vendors: { id: string; name: string; contact?: string; phone?: string; email?: string; notes?: string }[]
  billPayments: any[]
  setEditingItem: (item: { table: string; row?: any }) => void
  startEdit: (table: string, row: any) => void
  supabase: any
  fetchData: () => void
  C: Palette
}

const dayDiff = (target: string, from: string) => Math.floor((new Date(from).getTime() - new Date(target).getTime()) / 86400000)

export default function MoneyOutTab({ expenses, accountsPayable, payroll, vendors, billPayments, setEditingItem, startEdit, supabase, fetchData, C }: Props) {
  const [view, setView] = useState<'expenses' | 'payroll'>('expenses')
  const [apView, setApView] = useState<'aging' | 'list'>('aging')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [expandedApBucket, setExpandedApBucket] = useState<string | null>(null)
  const [showVendorManager, setShowVendorManager] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState<any>(null)
  const [expandedBill, setExpandedBill] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.cost || 0), 0), [expenses])
  const totalAPOwed = useMemo(() => accountsPayable.reduce((s, b) => s + (Number(b.total_amount || 0) - Number(b.amount_paid || 0)), 0), [accountsPayable])
  const totalPayroll = useMemo(() => payroll.reduce((s, p) => s + Number(p.gross_pay || 0), 0), [payroll])

  const expensesByCategory = useMemo(() => {
    const m: Record<string, any[]> = {}
    expenses.forEach(e => {
      const k = e.category || 'Other'
      if (!m[k]) m[k] = []
      m[k].push(e)
    })
    return m
  }, [expenses])

  const apByBucket = useMemo(() => {
    const buckets: Record<string, any[]> = { 'Overdue': [], 'Due Soon (≤7d)': [], 'Not Due Yet': [], 'Paid': [] }
    accountsPayable.forEach(b => {
      const total = Number(b.total_amount || 0)
      const paid = Number(b.amount_paid || 0)
      const owed = total - paid
      if (owed <= 0) { buckets['Paid'].push(b); return }
      if (!b.due_date) { buckets['Not Due Yet'].push(b); return }
      const days = dayDiff(b.due_date, today)
      if (days > 0) buckets['Overdue'].push(b)
      else if (days >= -7) buckets['Due Soon (≤7d)'].push(b)
      else buckets['Not Due Yet'].push(b)
    })
    return buckets
  }, [accountsPayable, today])

  const APRow = ({ b }: { b: any }) => {
    const total = Number(b.total_amount || 0)
    const paid = Number(b.amount_paid || 0)
    const owed = total - paid
    const days = b.due_date ? dayDiff(b.due_date, today) : null
    const isOpen = expandedBill === b.id
    const payments = (billPayments || []).filter((p: any) => p.bill_id === b.id).sort((a: any, c: any) => (c.payment_date || '').localeCompare(a.payment_date || ''))
    return (
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <div onClick={() => setExpandedBill(isOpen ? null : b.id)} style={{ padding: '11px 13px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.vendor_name || 'Vendor'}</div>
              <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                {b.description || ''} {b.due_date && <>· Due {b.due_date}</>}
                {days !== null && days > 0 && owed > 0 && <span style={{ color: '#ef4444', fontWeight: 'bold' }}> · {days} days late</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: owed > 0 ? C.pink : C.teal }}>{fmt(owed)} {owed <= 0 ? '✓' : ''}</div>
                {paid > 0 && <div style={{ fontSize: '10px', color: C.muted }}>{fmt(paid)} paid of {fmt(total)}</div>}
              </div>
              <span style={{ color: C.muted, fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</span>
            </div>
          </div>
        </div>
        {isOpen && (
          <div style={{ padding: '0 13px 12px', background: C.inputBg }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 0 4px' }}>Payment History</div>
            {payments.length === 0 ? (
              <div style={{ fontSize: '12px', color: C.muted, paddingBottom: '6px' }}>No payments recorded yet.</div>
            ) : payments.map((p: any) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', padding: '6px 0', borderTop: `1px solid ${C.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: C.text }}>{p.payment_date}</div>
                  <div style={{ fontSize: '10px', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.payment_method || ''}{p.notes ? ` · ${p.notes}` : ''}</div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: C.teal, whiteSpace: 'nowrap' }}>{fmt(Number(p.amount || 0))}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              {owed > 0 && (
                <button onClick={e => { e.stopPropagation(); setShowPaymentModal(b) }} style={{ flex: 1, padding: '8px', background: 'transparent', color: C.teal, border: `1px solid ${C.teal}`, borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>+ RECORD PAYMENT</button>
              )}
              <button onClick={e => { e.stopPropagation(); startEdit('accounts_payable', b) }} style={{ flex: 1, padding: '8px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>EDIT BILL</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Toggle expenses vs payroll */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        <button onClick={() => setView('expenses')} style={{ padding: '12px', background: view === 'expenses' ? `linear-gradient(135deg,${C.teal},#1A7A75)` : 'transparent', color: view === 'expenses' ? '#fff' : C.muted, border: `1px solid ${view === 'expenses' ? C.teal : C.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}>Expenses</button>
        <button onClick={() => setView('payroll')} style={{ padding: '12px', background: view === 'payroll' ? `linear-gradient(135deg,${C.teal},#1A7A75)` : 'transparent', color: view === 'payroll' ? '#fff' : C.muted, border: `1px solid ${view === 'payroll' ? C.teal : C.border}`, borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}>Payroll</button>
      </div>

      {view === 'expenses' && (
        <>
          {/* Summary card */}
          <div style={{ padding: '16px', background: C.cardBg, borderRadius: '12px', marginBottom: '14px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: '12px', color: C.muted, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Total Expenses + A/P</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: C.pink }}>{fmt(totalExpenses + totalAPOwed)}</div>
          </div>

          {/* Bills (A/P) section */}
          <div style={{ background: C.cardBg, border: `1px solid ${C.gold}`, borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '15px', color: '#7A5A00' }}>Bills (A/P)</div>
                <div style={{ fontSize: '12px', color: C.muted }}>{accountsPayable.length} bills · {fmt(totalAPOwed)} owed</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setShowVendorManager(!showVendorManager)} style={{ background: 'none', border: `1px solid ${C.gold}`, borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#7A5A00', cursor: 'pointer', fontFamily: FONT, fontWeight: 'bold' }}>{showVendorManager ? 'Hide' : 'Vendors'}</button>
                <button onClick={() => setEditingItem({ table: 'accounts_payable' })} style={{ background: C.gold, color: '#7A5A00', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>+ Bill</button>
              </div>
            </div>

            {/* Aging vs List view toggle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
              <button onClick={() => setApView('aging')} style={{ padding: '8px', background: apView === 'aging' ? `${C.teal}20` : 'transparent', color: apView === 'aging' ? C.teal : C.muted, border: `1px solid ${apView === 'aging' ? C.teal : C.border}`, borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>Aging Buckets</button>
              <button onClick={() => setApView('list')} style={{ padding: '8px', background: apView === 'list' ? `${C.teal}20` : 'transparent', color: apView === 'list' ? C.teal : C.muted, border: `1px solid ${apView === 'list' ? C.teal : C.border}`, borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>List View</button>
            </div>

            {apView === 'aging' && (
              <div>
                {(['Overdue', 'Due Soon (≤7d)', 'Not Due Yet', 'Paid'] as const).map(bucket => {
                  const bills = apByBucket[bucket]
                  if (bills.length === 0) return null
                  const bucketTotal = bills.reduce((s: number, b: any) => s + (Number(b.total_amount || 0) - Number(b.amount_paid || 0)), 0)
                  const isExpanded = expandedApBucket === bucket
                  const bColor = bucket === 'Overdue' ? '#ef4444' : bucket === 'Due Soon (≤7d)' ? C.gold : bucket === 'Paid' ? C.teal : C.muted
                  return (
                    <div key={bucket} style={{ marginBottom: '6px', background: C.inputBg, borderRadius: '8px', borderLeft: `3px solid ${bColor}`, overflow: 'hidden' }}>
                      <button onClick={() => setExpandedApBucket(isExpanded ? null : bucket)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 13px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT }}>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: bColor }}>{bucket}</div>
                          <div style={{ fontSize: '11px', color: C.muted }}>{bills.length} bill{bills.length !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: bColor }}>{fmt(bucketTotal)}</span>
                          <span style={{ color: C.muted, fontSize: '10px' }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>
                      {isExpanded && bills.map((b: any) => <APRow key={b.id} b={b} />)}
                    </div>
                  )
                })}
              </div>
            )}

            {apView === 'list' && (
              <div style={{ background: C.inputBg, borderRadius: '8px', overflow: 'hidden' }}>
                {accountsPayable.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '12px' }}>No bills.</div>
                ) : accountsPayable.map(b => <APRow key={b.id} b={b} />)}
              </div>
            )}
          </div>

          {/* Expenses by category */}
          {Object.keys(expensesByCategory).sort((a, b) => {
            const aT = expensesByCategory[a].reduce((s: number, e: any) => s + Number(e.cost || 0), 0)
            const bT = expensesByCategory[b].reduce((s: number, e: any) => s + Number(e.cost || 0), 0)
            return bT - aT
          }).map(cat => {
            const items = expensesByCategory[cat]
            const total = items.reduce((s: number, e: any) => s + Number(e.cost || 0), 0)
            const isExpanded = expandedCategory === cat
            const catMeta = EXPENSE_CATEGORIES[cat] || { label: '', line: '' }
            return (
              <div key={cat} style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: '10px', marginBottom: '8px', overflow: 'hidden' }}>
                <button onClick={() => setExpandedCategory(isExpanded ? null : cat)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT }}>
                  <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: C.text }}>{cat}</div>
                    <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{items.length} item{items.length !== 1 ? 's' : ''} {catMeta.label && `· ${catMeta.label}`}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: C.pink }}>-{fmt(total)}</span>
                    <span style={{ color: C.muted, fontSize: '10px' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isExpanded && items.map((e: any) => (
                  <div key={e.id} onClick={() => startEdit('expenses', e)} style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes || '(no description)'}</div>
                      <div style={{ fontSize: '10px', color: C.muted, marginTop: '2px' }}>{e.purchase_date} · {e.user_name || ''}</div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: C.pink, marginLeft: '8px' }}>-{fmt(Number(e.cost || 0))}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </>
      )}

      {view === 'payroll' && (
        <>
          <div style={{ padding: '16px', background: C.cardBg, borderRadius: '12px', marginBottom: '14px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: '12px', color: C.muted, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Total Payroll YTD</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: C.text }}>{fmt(totalPayroll)}</div>
          </div>
          {payroll.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: C.muted, fontSize: '13px', background: C.cardBg, borderRadius: '12px', border: `1px solid ${C.border}` }}>No payroll entries yet. Tap + to add one.</div>
          ) : payroll.map(p => (
            <div key={p.id} onClick={() => startEdit('payroll', p)} style={{ padding: '12px 14px', background: C.cardBg, borderRadius: '10px', marginBottom: '6px', border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: C.text }}>{p.user_name}</div>
                <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{p.pay_period_label || ''} · {p.pay_date}</div>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: C.pink }}>-{fmt(Number(p.gross_pay || 0))}</span>
            </div>
          ))}
        </>
      )}

      {showPaymentModal && (
        <RecordPaymentModal bill={showPaymentModal} C={C} supabase={supabase} fetchData={fetchData} onClose={() => setShowPaymentModal(null)} />
      )}
    </div>
  )
}
