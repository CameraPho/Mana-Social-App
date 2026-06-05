'use client'
import React, { useState, useMemo } from 'react'
import { FONT, EXPENSE_CATEGORIES, type Palette } from '@/lib/constants'
import { fmt, dayDiff } from '@/lib/format'
import RecordPaymentModal from '@/components/RecordPaymentModal'

interface Props {
  expenses: any[]
  accountsPayable: any[]
  payroll: any[]
  vendors: { id: string; name: string; contact?: string; phone?: string; email?: string; notes?: string }[]
  billPayments: any[]
  setEditingItem: (item: { table: string; row?: any }) => void
  supabase: any
  fetchData: () => void
  C: Palette
}

export default function MoneyOutTab({ expenses, accountsPayable, payroll, vendors, billPayments, setEditingItem, supabase, fetchData, C }: Props) {
  const [view, setView] = useState<'expenses' | 'payroll'>('expenses')
  const [apView, setApView] = useState<'aging' | 'list'>('aging')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [expandedApBucket, setExpandedApBucket] = useState<string | null>(null)
  const [showVendorManager, setShowVendorManager] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState<any>(null)
  const [vendorForm, setVendorForm] = useState<{ name: string; contact: string; phone: string; email: string; notes: string }>({ name: '', contact: '', phone: '', email: '', notes: '' })

  const today = new Date().toISOString().slice(0, 10)

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.cost || 0), 0), [expenses])
  const totalAPOwed = useMemo(() => accountsPayable.reduce((s, b) => s + (Number(b.amount || 0) - Number(b.amount_paid || 0)), 0), [accountsPayable])
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
      const total = Number(b.amount || 0)
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
    const total = Number(b.amount || 0)
    const paid = Number(b.amount_paid || 0)
    const owed = total - paid
    const days = b.due_date ? dayDiff(b.due_date, today) : null
    return (
      <div onClick={() => setEditingItem({ table: 'accounts_payable', row: b })} style={{ padding: '11px 13px', borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.vendor_name || 'Vendor'}</div>
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
              {b.description || ''} {b.due_date && <>· Due {b.due_date}</>}
              {days !== null && days > 0 && owed > 0 && <span style={{ color: '#ef4444', fontWeight: 'bold' }}> · {days} days late</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: owed > 0 ? C.pink : C.teal }}>{fmt(owed)} {owed <= 0 ? '✓' : ''}</div>
            {paid > 0 && <div style={{ fontSize: '10px', color: C.muted }}>{fmt(paid)} paid of {fmt(total)}</div>}
          </div>
        </div>
        {owed > 0 && (
          <button onClick={e => { e.stopPropagation(); setShowPaymentModal(b) }} style={{ marginTop: '8px', padding: '6px 12px', background: 'transparent', color: C.teal, border: `1px solid ${C.teal}`, borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>+ RECORD PAYMENT</button>
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

          {/* Accounts Payable section */}
          <div style={{ background: C.cardBg, border: `1px solid ${C.gold}`, borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '15px', color: '#7A5A00' }}>Bills (A/P)</div>
                <div style={{ fontSize: '12px', color: C.muted }}>{accountsPayable.length} bills · {fmt(totalAPOwed)} owed</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setShowVendorManager(!showVendorManager)} style={{ background: 'none', border: `1px solid ${C.gold}`, borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#7A5A00', cursor: 'pointer', fontFamily: FONT, fontWeight: 'bold' }}>{showVendorManager ? 'Hide' : 'Vendors'}</button>
                <button onClick={() => setEditingItem({ table: 'accounts_payable' })} style={{ background: C.gold, color: '#7A5A00', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>+ Bill</button
