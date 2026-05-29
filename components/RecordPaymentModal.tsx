'use client'
import React, { useState } from 'react'
import { FONT, CHECKING_ACCOUNTS, CREDIT_CARD_ACCOUNTS } from '@/lib/constants'
import { fmt } from '@/lib/format'

interface Props {
  bill: any
  C: any
  supabase: any
  fetchData: () => void
  onClose: () => void
}

export default function RecordPaymentModal({ bill, C, supabase, fetchData, onClose }: Props) {
  const total = Number(bill.total_amount) || 0
  const paid = Number(bill.amount_paid) || 0
  const owed = total - paid
  const defaultAmount = bill.payment_plan && bill.plan_payment_amount
    ? Math.min(Number(bill.plan_payment_amount), owed).toFixed(2)
    : owed.toFixed(2)

  const [formData, setFormData] = useState({
    amount: defaultAmount,
    payment_date: new Date().toISOString().slice(0, 10),
    paid_from: 'Mana Social | WF Business Checking',
    reference_number: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const inp: React.CSSProperties = { padding: '13px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, fontSize: '15px', width: '100%', background: C.inputBg, boxSizing: 'border-box', fontFamily: FONT, color: C.text }
  const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT }

  const save = async () => {
    const amount = parseFloat(formData.amount) || 0
    if (amount <= 0) return alert('Payment amount must be greater than zero')
    if (amount > owed + 0.01) {
      if (!confirm(`Payment of ${fmt(amount)} exceeds outstanding balance of ${fmt(owed)}. Continue anyway?`)) return
    }

    setSaving(true)
    try {
      // Insert payment record. payment_method holds the actual paid-from account name
      // (e.g. "Mana Social | WF Business Checking") so the JE engine can resolve to the right GL.
      // Any transfer mechanism (Zelle/Venmo/check #) belongs in notes/reference, not as a method.
      const { error: payErr } = await supabase.from('bill_payments').insert({
        bill_id: bill.id,
        payment_date: formData.payment_date,
        amount,
        payment_method: formData.paid_from,
        reference_number: formData.reference_number || null,
        notes: formData.notes || null,
        entity: bill.entity || 'Mana Social LLC',
      })
      if (payErr) throw payErr

      // Update bill's amount_paid and status
      const newAmountPaid = paid + amount
      const newStatus = newAmountPaid >= total ? 'paid' : 'partial'
      const { error: billErr } = await supabase
        .from('accounts_payable')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
          payment_date: formData.payment_date,
        })
        .eq('id', bill.id)
      if (billErr) throw billErr

      fetchData()
      onClose()
    } catch (err: any) {
      alert('Error: ' + err.message)
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.teal}`, maxWidth: '450px', width: '100%', maxHeight: '90vh', overflowY: 'auto', fontFamily: FONT }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontWeight: 900, color: C.text, fontSize: '16px', margin: 0 }}>RECORD PAYMENT</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        {/* Bill context */}
        <div style={{ padding: '12px', background: C.inputBg, borderRadius: '10px', marginBottom: '14px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{bill.vendor_name}</div>
          {bill.description && <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{bill.description}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px' }}>
            <span style={{ color: C.muted }}>Total: <strong style={{ color: C.text }}>{fmt(total)}</strong></span>
            <span style={{ color: C.muted }}>Paid: <strong style={{ color: C.teal }}>{fmt(paid)}</strong></span>
            <span style={{ color: C.muted }}>Owed: <strong style={{ color: '#ef4444' }}>{fmt(owed)}</strong></span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <div>
            <span style={lbl}>Payment Amount ($)</span>
            <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" style={inp} />
            {bill.payment_plan && bill.plan_payment_amount && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: C.muted }}>
                Plan payment: ${Number(bill.plan_payment_amount).toFixed(2)}
              </div>
            )}
          </div>
          <div>
            <span style={lbl}>Payment Date</span>
            <input type="date" value={formData.payment_date} onChange={e => setFormData({ ...formData, payment_date: e.target.value })} style={inp} />
          </div>
          <div>
            <span style={lbl}>Paid From</span>
            <select value={formData.paid_from} onChange={e => setFormData({ ...formData, paid_from: e.target.value })} style={inp}>
              <optgroup label="Checking">
                {CHECKING_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </optgroup>
              <optgroup label="Credit Cards">
                {CREDIT_CARD_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </optgroup>
            </select>
            <div style={{ marginTop: '4px', fontSize: '11px', color: C.muted, fontStyle: 'italic' }}>
              The actual account that lost the money. Zelle/Venmo/PayPal are transfer rails — note them in Reference or Notes below.
            </div>
          </div>
          <div>
            <span style={lbl}>Reference / Confirmation # (optional)</span>
            <input value={formData.reference_number} onChange={e => setFormData({ ...formData, reference_number: e.target.value })} placeholder="e.g. Zelle conf #, check #, Venmo txn ID" style={inp} />
          </div>
          <div>
            <span style={lbl}>Notes (optional)</span>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Anything to remember" style={{ ...inp, height: '60px', resize: 'vertical' }} />
          </div>

          <button onClick={save} disabled={saving} style={{ background: saving ? C.muted : `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', padding: '14px', borderRadius: '10px', fontWeight: 900, border: 'none', fontSize: '15px', cursor: saving ? 'wait' : 'pointer', fontFamily: FONT, marginTop: '4px' }}>
            {saving ? 'Recording...' : 'RECORD PAYMENT'}
          </button>
        </div>
      </div>
    </div>
  )
}
    const amount = parseFloat(formData.amount) || 0
    if (amount <= 0) return alert('Payment amount must be greater than zero')
    if (amount > owed + 0.01) {
      if (!confirm(`Payment of ${fmt(amount)} exceeds outstanding balance of ${fmt(owed)}. Continue anyway?`)) return
    }

    setSaving(true)
    try {
      // Insert payment record. payment_method holds the actual paid-from account name
      // (e.g. "Mana Social | WF Business Checking") so the JE engine can resolve to the right GL.
      // Any transfer mechanism (Zelle/Venmo/check #) belongs in notes/reference, not as a method.
      const { error: payErr } = await supabase.from('bill_payments').insert({
        bill_id: bill.id,
        payment_date: formData.payment_date,
        amount,
        payment_method: formData.paid_from,
        reference_number: formData.reference_number || null,
        notes: formData.notes || null,
        entity: bill.entity || 'Mana Social LLC',
      })
      if (payErr) throw payErr

      // Update bill's amount_paid and status
      const newAmountPaid = paid + amount
      const newStatus = newAmountPaid >= total ? 'paid' : 'partial'
      const { error: billErr } = await supabase
        .from('accounts_payable')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
          payment_date: formData.payment_date,
        })
        .eq('id', bill.id)
      if (billErr) throw billErr

      fetchData()
      onClose()
    } catch (err: any) {
      alert('Error: ' + err.message)
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.teal}`, maxWidth: '450px', width: '100%', maxHeight: '90vh', overflowY: 'auto', fontFamily: FONT }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontWeight: 900, color: C.text, fontSize: '16px', margin: 0 }}>RECORD PAYMENT</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        {/* Bill context */}
        <div style={{ padding: '12px', background: C.inputBg, borderRadius: '10px', marginBottom: '14px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{bill.vendor_name}</div>
          {bill.description && <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{bill.description}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px' }}>
            <span style={{ color: C.muted }}>Total: <strong style={{ color: C.text }}>{fmt(total)}</strong></span>
            <span style={{ color: C.muted }}>Paid: <strong style={{ color: C.teal }}>{fmt(paid)}</strong></span>
            <span style={{ color: C.muted }}>Owed: <strong style={{ color: '#ef4444' }}>{fmt(owed)}</strong></span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <div>
            <span style={lbl}>Payment Amount ($)</span>
            <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" style={inp} />
            {bill.payment_plan && bill.plan_payment_amount && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: C.muted }}>
                Plan payment: ${Number(bill.plan_payment_amount).toFixed(2)}
              </div>
            )}
          </div>
          <div>
            <span style={lbl}>Payment Date</span>
            <input type="date" value={formData.payment_date} onChange={e => setFormData({ ...formData, payment_date: e.target.value })} style={inp} />
          </div>
          <div>
            <span style={lbl}>Paid From</span>
            <select value={formData.paid_from} onChange={e => setFormData({ ...formData, paid_from: e.target.value })} style={inp}>
              <optgroup label="Checking">
                {CHECKING_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </optgroup>
              <optgroup label="Credit Cards">
                {CREDIT_CARD_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </optgroup>
            </select>
            <div style={{ marginTop: '4px', fontSize: '11px', color: C.muted, fontStyle: 'italic' }}>
              The actual account that lost the money. Zelle/Venmo/PayPal are transfer rails — note them in Reference or Notes below.
            </div>
          </div>
          <div>
            <span style={lbl}>Reference / Confirmation # (optional)</span>
            <input value={formData.reference_number} onChange={e => setFormData({ ...formData, reference_number: e.target.value })} placeholder="e.g. Zelle conf #, check #, Venmo txn ID" style={inp} />
          </div>
          <div>
            <span style={lbl}>Notes (optional)</span>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Anything to remember" style={{ ...inp, height: '60px', resize: 'vertical' }} />
          </div>

          <button onClick={save} disabled={saving} style={{ background: saving ? C.muted : `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', padding: '14px', borderRadius: '10px', fontWeight: 900, border: 'none', fontSize: '15px', cursor: saving ? 'wait' : 'pointer', fontFamily: FONT, marginTop: '4px' }}>
            {saving ? 'Recording...' : 'RECORD PAYMENT'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { fmt } from '@/lib/format'

type PaymentMethod = 'cash' | 'check' | 'wire' | 'bank_transfer' | 'credit_card' | 'paypal' | 'venmo' | 'zelle' | 'other'

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:          'Cash',
  check:         'Check',
  wire:          'Wire Transfer',
  bank_transfer: 'Bank Transfer (ACH)',
  credit_card:   'Credit Card',
  paypal:        'PayPal',
  venmo:         'Venmo',
  zelle:         'Zelle',
  other:         'Other',
}

interface Props {
  bill: any
  C: any
  supabase: any
  fetchData: () => void
  onClose: () => void
}

export default function RecordPaymentModal({ bill, C, supabase, fetchData, onClose }: Props) {
  const total = Number(bill.total_amount) || 0
  const paid = Number(bill.amount_paid) || 0
  const owed = total - paid
  const defaultAmount = bill.payment_plan && bill.plan_payment_amount
    ? Math.min(Number(bill.plan_payment_amount), owed).toFixed(2)
    : owed.toFixed(2)

  const [formData, setFormData] = useState({
    amount: defaultAmount,
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'bank_transfer' as PaymentMethod,
    reference_number: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const inp: React.CSSProperties = { padding: '13px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, fontSize: '15px', width: '100%', background: C.inputBg, boxSizing: 'border-box', fontFamily: FONT, color: C.text }
  const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT }

  const save = async () => {
    const amount = parseFloat(formData.amount) || 0
    if (amount <= 0) return alert('Payment amount must be greater than zero')
    if (amount > owed + 0.01) {
      if (!confirm(`Payment of ${fmt(amount)} exceeds outstanding balance of ${fmt(owed)}. Continue anyway?`)) return
    }
    
    setSaving(true)
    try {
      // Insert payment record
      const { error: payErr } = await supabase.from('bill_payments').insert({
        bill_id: bill.id,
        payment_date: formData.payment_date,
        amount,
        payment_method: formData.payment_method,
        reference_number: formData.reference_number || null,
        notes: formData.notes || null,
        entity: bill.entity || 'Mana Social LLC',
      })
      if (payErr) throw payErr

      // Update bill's amount_paid and status
      const newAmountPaid = paid + amount
      const newStatus = newAmountPaid >= total ? 'paid' : 'partial'
      const { error: billErr } = await supabase
        .from('accounts_payable')
        .update({ 
          amount_paid: newAmountPaid, 
          status: newStatus,
          payment_date: formData.payment_date,
        })
        .eq('id', bill.id)
      if (billErr) throw billErr

      fetchData()
      onClose()
    } catch (err: any) {
      alert('Error: ' + err.message)
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.teal}`, maxWidth: '450px', width: '100%', maxHeight: '90vh', overflowY: 'auto', fontFamily: FONT }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontWeight: 900, color: C.navy, fontSize: '16px', margin: 0 }}>RECORD PAYMENT</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        {/* Bill context */}
        <div style={{ padding: '12px', background: C.inputBg, borderRadius: '10px', marginBottom: '14px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{bill.vendor_name}</div>
          {bill.description && <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{bill.description}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px' }}>
            <span style={{ color: C.muted }}>Total: <strong style={{ color: C.text }}>{fmt(total)}</strong></span>
            <span style={{ color: C.muted }}>Paid: <strong style={{ color: C.teal }}>{fmt(paid)}</strong></span>
            <span style={{ color: C.muted }}>Owed: <strong style={{ color: C.pink }}>{fmt(owed)}</strong></span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <div>
            <span style={lbl}>Payment Amount ($)</span>
            <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" style={inp} />
            {bill.payment_plan && bill.plan_payment_amount && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: C.muted }}>
                Plan payment: ${Number(bill.plan_payment_amount).toFixed(2)}
              </div>
            )}
          </div>
          <div>
            <span style={lbl}>Payment Date</span>
            <input type="date" value={formData.payment_date} onChange={e => setFormData({ ...formData, payment_date: e.target.value })} style={inp} />
          </div>
          <div>
            <span style={lbl}>Payment Method</span>
            <select value={formData.payment_method} onChange={e => setFormData({ ...formData, payment_method: e.target.value as PaymentMethod })} style={inp}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Reference / Confirmation # (optional)</span>
            <input value={formData.reference_number} onChange={e => setFormData({ ...formData, reference_number: e.target.value })} placeholder="Check #, transaction ID, etc." style={inp} />
          </div>
          <div>
            <span style={lbl}>Notes (optional)</span>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Anything to remember" style={{ ...inp, height: '60px', resize: 'vertical' }} />
          </div>

          <button onClick={save} disabled={saving} style={{ background: saving ? C.muted : `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', padding: '14px', borderRadius: '10px', fontWeight: 900, border: 'none', fontSize: '15px', cursor: saving ? 'wait' : 'pointer', fontFamily: FONT, marginTop: '4px' }}>
            {saving ? 'Recording...' : 'RECORD PAYMENT'}
          </button>
        </div>
      </div>
    </div>
  )
}
