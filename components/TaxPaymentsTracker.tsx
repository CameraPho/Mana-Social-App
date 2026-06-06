'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'
import { FONT } from '@/lib/constants'
import { useAccounts } from '@/lib/useAccounts'
import { stageJEForRecord } from '@/lib/journalEntryEngine'

interface TaxPayment {
  id: string
  tax_authority: string
  tax_type: string
  tax_year: number
  tax_period: string | null
  due_date: string
  amount_due: number
  amount_paid: number
  payment_date: string | null
  payment_method: string | null
  confirmation_number: string | null
  status: 'pending' | 'scheduled' | 'paid' | 'overdue'
  notes: string | null
}

const TAX_AUTHORITIES = ['FTB', 'CDTFA', 'EFTPS', 'EDD', 'IRS', 'Other'] as const
const TAX_TYPES = [
  'PTE Elective',
  'CA LLC Franchise Tax',
  'Sales Tax',
  'Federal Payroll',
  'CA Payroll Withholding',
  'Federal Estimated',
  'CA Estimated',
  'Other',
] as const

export default function TaxPaymentsTracker({ C, onBack }: { C: any; onBack: () => void }) {
  const supabase = createClient()
  const { checking, cards } = useAccounts()
  const [rows, setRows] = useState<TaxPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingPayment, setEditingPayment] = useState<TaxPayment | null>(null)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tax_payments').select('*').order('due_date')
    setRows((data || []) as TaxPayment[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchRows() }, [fetchRows])

  const today = new Date().toISOString().slice(0, 10)

  const decorated = useMemo(() => {
    return rows.map(r => {
      let effectiveStatus: string = r.status
      if (r.amount_paid >= r.amount_due && r.amount_paid > 0) effectiveStatus = 'paid'
      else if (r.due_date < today && effectiveStatus === 'pending') effectiveStatus = 'overdue'
      return { ...r, effectiveStatus }
    })
  }, [rows, today])

  const upcoming = decorated.filter(r => r.effectiveStatus !== 'paid')
  const paid = decorated.filter(r => r.effectiveStatus === 'paid')

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - new Date(today).getTime()) / 86400000)

  const statusColor = (s: string) => s === 'overdue' ? '#ef4444' : s === 'paid' ? C.teal : s === 'scheduled' ? '#7C3AED' : C.muted

  const totalDue = upcoming.reduce((s, r) => s + (r.amount_due - r.amount_paid), 0)

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 14px', fontSize: '12px', color: C.muted, cursor: 'pointer', fontFamily: FONT }}>← Back</button>
        <button onClick={() => setShowAdd(true)} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', cursor: 'pointer', fontFamily: FONT, fontWeight: 'bold' }}>+ ADD TAX PAYMENT</button>
      </div>

      <div style={{ fontSize: '20px', fontWeight: 'bold', color: C.text, marginBottom: '4px' }}>Tax Payments</div>
      <div style={{ fontSize: '13px', color: C.muted, marginBottom: '16px' }}>
        PTE · CDTFA · EFTPS · EDD · CA Franchise — all in one place
      </div>

      {!loading && upcoming.length > 0 && (
        <div style={{ background: totalDue > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(45,191,184,0.08)', border: `1px solid ${totalDue > 0 ? '#ef4444' : C.teal}40`, borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase' }}>Outstanding</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: totalDue > 0 ? '#ef4444' : C.teal }}>{fmt(totalDue)}</span>
          </div>
          <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>{upcoming.length} upcoming · next due: {upcoming[0]?.due_date} ({daysUntil(upcoming[0]?.due_date)} days)</div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: C.muted }}>Loading…</div>
      ) : (
        <>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.06em' }}>Upcoming</div>
          {upcoming.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '13px', background: C.cardBg, borderRadius: '10px', border: `1px solid ${C.border}` }}>No upcoming payments.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {upcoming.map(r => {
                const days = daysUntil(r.due_date)
                const overdue = r.effectiveStatus === 'overdue'
                return (
                  <div key={r.id} onClick={() => setEditingPayment(r)} style={{ background: C.cardBg, border: `1px solid ${overdue ? '#ef4444' : C.border}`, borderRadius: '10px', padding: '14px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: C.text }}>{r.tax_type}</div>
                        <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{r.tax_authority} · {r.tax_period || `${r.tax_year}`}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.amount_due - r.amount_paid)}</div>
                        <div style={{ fontSize: '10px', color: statusColor(r.effectiveStatus), fontWeight: 'bold', marginTop: '2px' }}>{r.effectiveStatus.toUpperCase()}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.muted, marginTop: '6px' }}>
                      <span>Due {r.due_date}</span>
                      <span style={{ color: overdue ? '#ef4444' : days <= 7 ? '#7C3AED' : C.muted, fontWeight: overdue ? 'bold' : 'normal' }}>
                        {overdue ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `${days} days`}
                      </span>
                    </div>
                    {r.amount_paid > 0 && r.amount_paid < r.amount_due && (
                      <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px', fontStyle: 'italic' }}>Partial: {fmt(r.amount_paid)} of {fmt(r.amount_due)} paid</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {paid.length > 0 && (
            <>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.06em' }}>Paid</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {paid.map(r => (
                  <div key={r.id} onClick={() => setEditingPayment(r)} style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', opacity: 0.75 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: C.text }}>{r.tax_type} ({r.tax_period || r.tax_year})</span>
                      <span style={{ fontSize: '12px', color: C.teal, fontWeight: 'bold', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.amount_paid)}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: C.muted, marginTop: '2px' }}>Paid {r.payment_date} · {r.payment_method || 'unspecified'}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {(showAdd || editingPayment) && (
        <TaxPaymentForm
          C={C}
          existing={editingPayment}
          checking={checking}
          cards={cards}
          onClose={() => { setShowAdd(false); setEditingPayment(null) }}
          onSaved={() => { setShowAdd(false); setEditingPayment(null); fetchRows() }}
          supabase={supabase}
        />
      )}
    </div>
  )
}

function TaxPaymentForm({ C, existing, checking, cards, onClose, onSaved, supabase }: {
  C: any; existing: TaxPayment | null; checking: string[]; cards: string[]; onClose: () => void; onSaved: () => void; supabase: any;
}) {
  const isEdit = !!existing
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    tax_authority: existing?.tax_authority || 'FTB',
    tax_type: existing?.tax_type || 'PTE Elective',
    tax_year: existing?.tax_year || new Date().getFullYear(),
    tax_period: existing?.tax_period || '',
    due_date: existing?.due_date || today,
    amount_due: existing?.amount_due?.toString() || '',
    amount_paid: existing?.amount_paid?.toString() || '0',
    payment_date: existing?.payment_date || '',
    payment_method: existing?.payment_method || 'Mana Social | WF Business Checking',
    confirmation_number: existing?.confirmation_number || '',
    notes: existing?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, fontSize: '13px', width: '100%', background: C.inputBg, color: C.text, fontFamily: FONT, boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT, letterSpacing: '0.06em' }

  const save = async () => {
    if (!form.tax_type || !form.due_date || !form.amount_due) { alert('Tax type, due date, and amount are required'); return }
    setSaving(true)
    try {
      const payload = {
        tax_authority: form.tax_authority,
        tax_type: form.tax_type,
        tax_year: Number(form.tax_year),
        tax_period: form.tax_period || null,
        due_date: form.due_date,
        amount_due: Number(form.amount_due),
        amount_paid: Number(form.amount_paid) || 0,
        payment_date: form.payment_date || null,
        payment_method: form.payment_method || null,
        confirmation_number: form.confirmation_number || null,
        notes: form.notes || null,
        status: Number(form.amount_paid) >= Number(form.amount_due) ? 'paid' : 'pending',
      }

      let savedRow
      if (isEdit && existing) {
        const { data, error } = await supabase.from('tax_payments').update(payload).eq('id', existing.id).select().single()
        if (error) throw error
        savedRow = data
      } else {
        const { data, error } = await supabase.from('tax_payments').insert(payload).select().single()
        if (error) throw error
        savedRow = data
      }

      if (savedRow && savedRow.payment_date && Number(savedRow.amount_paid) > 0) {
        const res = await stageJEForRecord('tax_payment', savedRow, supabase)
        if (!res.success && !res.skipped) {
          alert(`Saved, but JE staging failed: ${res.error}. Payment is recorded but won't post to the ledger automatically — check Pending Journal Entries.`)
        }
      }

      onSaved()
    } catch (e: any) {
      alert('Error: ' + e.message)
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!existing) return
    if (!confirm(`Delete this ${existing.tax_type} payment record? This is permanent.`)) return
    const { error } = await supabase.from('tax_payments').delete().eq('id', existing.id)
    if (error) alert(error.message)
    else onSaved()
  }

  const markPaidNow = () => {
    setForm({ ...form, amount_paid: form.amount_due, payment_date: today })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.teal}`, maxWidth: '520px', width: '100%', maxHeight: '92vh', overflowY: 'auto', fontFamily: FONT }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontWeight: 900, color: C.text, fontSize: '16px', margin: 0 }}>{isEdit ? 'EDIT TAX PAYMENT' : 'NEW TAX PAYMENT'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <span style={lbl}>Authority</span>
              <select value={form.tax_authority} onChange={e => setForm({ ...form, tax_authority: e.target.value })} style={inp}>
                {TAX_AUTHORITIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Tax Type</span>
              <select value={form.tax_type} onChange={e => setForm({ ...form, tax_type: e.target.value })} style={inp}>
                {TAX_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <span style={lbl}>Tax Year</span>
              <input type="number" value={form.tax_year} onChange={e => setForm({ ...form, tax_year: parseInt(e.target.value) || 2026 })} style={inp} />
            </div>
            <div>
              <span style={lbl}>Period</span>
              <input value={form.tax_period} onChange={e => setForm({ ...form, tax_period: e.target.value })} placeholder="e.g. Q1 2026" style={inp} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <span style={lbl}>Due Date</span>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={inp} />
            </div>
            <div>
              <span style={lbl}>Amount Due</span>
              <input type="number" step="0.01" value={form.amount_due} onChange={e => setForm({ ...form, amount_due: e.target.value })} placeholder="0.00" style={inp} />
            </div>
          </div>

          <div style={{ height: '6px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ ...lbl, marginBottom: 0 }}>Payment Details</span>
            <button onClick={markPaidNow} style={{ background: 'transparent', border: `1px solid ${C.teal}`, color: C.teal, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold', fontFamily: FONT }}>MARK PAID NOW</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <span style={lbl}>Amount Paid</span>
              <input type="number" step="0.01" value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} placeholder="0.00" style={inp} />
            </div>
            <div>
              <span style={lbl}>Payment Date</span>
              <input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} style={inp} />
            </div>
          </div>

          {Number(form.amount_paid) > 0 && (
            <div>
              <span style={lbl}>Paid From</span>
              <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} style={inp}>
                <optgroup label="Checking">
                  {checking.map(a => <option key={a} value={a}>{a}</option>)}
                </optgroup>
                <optgroup label="Credit Cards">
                  {cards.map(a => <option key={a} value={a}>{a}</option>)}
                </optgroup>
              </select>
            </div>
          )}

          <div>
            <span style={lbl}>Confirmation # (optional)</span>
            <input value={form.confirmation_number} onChange={e => setForm({ ...form, confirmation_number: e.target.value })} placeholder="From FTB / EFTPS / etc." style={inp} />
          </div>

          <div>
            <span style={lbl}>Notes</span>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inp, height: '60px', resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {isEdit && <button onClick={remove} style={{ padding: '12px 14px', background: 'transparent', color: '#ef4444', border: `1px solid #ef4444`, borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT, fontSize: '12px' }}>DELETE</button>}
            <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT, fontSize: '13px' }}>CANCEL</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '12px', background: saving ? C.muted : `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', fontFamily: FONT, fontSize: '13px' }}>
              {saving ? 'SAVING…' : (isEdit ? 'UPDATE' : 'SAVE')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
