'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { FONT } from '@/lib/constants'
import type { AccountRow } from '@/lib/useAccounts'

interface Props {
  C: any
  onClose: () => void
  onChange?: () => void  // optional callback so parent can refresh
}

export default function AccountManagerModal({ C, onClose, onChange }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    owner: 'Cam' as 'Mana Social' | 'Cam' | 'Kenny',
    account_type: 'credit_card' as 'checking' | 'credit_card',
    bank_or_card_name: '',
    notes: '',
  })

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('custom_accounts').select('*').order('account_type').order('account_name')
    setRows((data as AccountRow[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchRows() }, [fetchRows])

  // Display name format: "Owner | Bank or Card Name"
  const computedName = form.bank_or_card_name.trim()
    ? `${form.owner} | ${form.bank_or_card_name.trim()}`
    : ''

  const save = async () => {
    if (!form.bank_or_card_name.trim()) { alert('Enter a name for the account (e.g. "Apple Card")'); return }
    setAdding(true)
    const is_business = form.owner === 'Mana Social'
    const { error } = await supabase.from('custom_accounts').insert({
      account_name: computedName,
      owner: form.owner,
      account_type: form.account_type,
      is_business,
      notes: form.notes || null,
    })
    setAdding(false)
    if (error) {
      if (error.code === '23505') alert(`An account named "${computedName}" already exists.`)
      else alert('Error: ' + error.message)
      return
    }
    setForm({ owner: 'Cam', account_type: 'credit_card', bank_or_card_name: '', notes: '' })
    fetchRows()
    onChange?.()
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the account list? Existing transactions tagged to this account stay intact.`)) return
    const { error } = await supabase.from('custom_accounts').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    fetchRows()
    onChange?.()
  }

  const inp: React.CSSProperties = { padding: '11px 13px', borderRadius: '9px', border: `1px solid ${C.border}`, fontSize: '14px', width: '100%', background: C.inputBg, boxSizing: 'border-box', fontFamily: FONT, color: C.text }
  const lbl: React.CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT, letterSpacing: '0.06em' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.teal}`, maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', fontFamily: FONT }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontWeight: 900, color: C.text, fontSize: '16px', margin: 0 }}>MANAGE ACCOUNTS</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        {/* Add new */}
        <div style={{ padding: '14px', background: 'rgba(45,191,184,0.06)', border: `1px solid ${C.teal}40`, borderRadius: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 900, color: C.teal, marginBottom: '10px' }}>+ ADD ACCOUNT</div>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <span style={lbl}>Owner</span>
                <select value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value as any })} style={inp}>
                  <option value="Mana Social">Mana Social (LLC)</option>
                  <option value="Cam">Cam (personal)</option>
                  <option value="Kenny">Kenny (personal)</option>
                </select>
              </div>
              <div>
                <span style={lbl}>Account Type</span>
                <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value as any })} style={inp}>
                  <option value="checking">Checking</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </div>
            </div>
            <div>
              <span style={lbl}>Bank / Card Name</span>
              <input value={form.bank_or_card_name} onChange={e => setForm({ ...form, bank_or_card_name: e.target.value })} placeholder="e.g. Apple Card or Capital One Quicksilver" style={inp} />
              {computedName && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: C.muted, fontStyle: 'italic' }}>
                  Will appear as: <strong style={{ color: C.text }}>{computedName}</strong>
                </div>
              )}
            </div>
            <div>
              <span style={lbl}>Notes (optional)</span>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. last 4: 4096, opened 2024" style={inp} />
            </div>
            <button onClick={save} disabled={adding} style={{ background: adding ? C.muted : `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', padding: '12px', borderRadius: '10px', fontWeight: 900, border: 'none', fontSize: '14px', cursor: adding ? 'wait' : 'pointer', fontFamily: FONT }}>
              {adding ? 'Adding...' : 'ADD ACCOUNT'}
            </button>
          </div>
        </div>

        {/* Existing list */}
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.06em' }}>Current Accounts</div>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '13px' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '13px' }}>
            No accounts yet — using hardcoded defaults. Add your first one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(['checking', 'credit_card'] as const).map(typ => {
              const filtered = rows.filter(r => r.account_type === typ)
              if (filtered.length === 0) return null
              return (
                <div key={typ}>
                  <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', marginTop: '6px', marginBottom: '4px' }}>
                    {typ === 'checking' ? '🏦 Checking' : '💳 Credit Cards'}
                  </div>
                  {filtered.map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: C.inputBg, borderRadius: '8px', marginBottom: '4px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: C.text }}>{r.account_name}</div>
                        {r.notes && <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{r.notes}</div>}
                      </div>
                      <button onClick={() => remove(r.id, r.account_name)} style={{ background: 'none', border: `1px solid ${C.border}`, color: '#ef4444', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontFamily: FONT, fontWeight: 'bold' }}>REMOVE</button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: '14px', fontSize: '11px', color: C.muted, fontStyle: 'italic', lineHeight: '1.5' }}>
          Accounts you add here appear in every "Paid From" dropdown. Removing an account here does NOT delete past transactions tagged with it.
        </div>
      </div>
    </div>
  )
}
