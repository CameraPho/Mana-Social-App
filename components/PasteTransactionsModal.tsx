'use client'
import React, { useState, useMemo } from 'react'
import { FONT } from '@/lib/constants'
import { getEntity } from '@/lib/format'

interface ParsedRow {
  transaction_date: string
  description: string
  amount: number
  raw: string
  ok: boolean
  error?: string
}

// Normalize a pasted date string to YYYY-MM-DD. Accepts MM/DD/YYYY, M/D/YY, YYYY-MM-DD.
function normalizeDate(s: string): string | null {
  const t = s.trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    let mo = m[1], d = m[2], y = m[3]
    if (y.length === 2) y = '20' + y
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const parsed = new Date(t)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

// Parse one CSV/TSV line into date, description, amount.
function parseLine(line: string): ParsedRow {
  const raw = line
  const cells = line.includes('\t') ? line.split('\t') : line.split(',')
  if (cells.length < 3) {
    return { transaction_date: '', description: '', amount: 0, raw, ok: false, error: 'Need 3 columns: date, description, amount' }
  }
  const dateStr = cells[0].trim()
  const amountStr = cells[cells.length - 1].trim()
  const description = cells.slice(1, cells.length - 1).join(',').replace(/^"|"$/g, '').trim()

  const date = normalizeDate(dateStr)
  if (!date) return { transaction_date: '', description, amount: 0, raw, ok: false, error: `Bad date: "${dateStr}"` }

  let a = amountStr.replace(/[$,\s]/g, '')
  let neg = false
  if (/^\(.*\)$/.test(a)) { neg = true; a = a.replace(/[()]/g, '') }
  const num = parseFloat(a)
  if (isNaN(num)) return { transaction_date: date, description, amount: 0, raw, ok: false, error: `Bad amount: "${amountStr}"` }

  return { transaction_date: date, description: description || '(no description)', amount: neg ? -Math.abs(num) : num, raw, ok: true }
}

export default function PasteTransactionsModal({ C, accountOptions, supabase, fetchData, onClose }: {
  C: any
  accountOptions: { checking: string[]; cards: string[] }
  supabase: any
  fetchData: () => void
  onClose: () => void
}) {
  const [account, setAccount] = useState(accountOptions.cards[0] || accountOptions.checking[0] || 'Mana Social | WF Business Checking')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [flipSign, setFlipSign] = useState(false)

  const inp: React.CSSProperties = { padding: '11px 13px', borderRadius: '9px', border: `1px solid ${C.border}`, fontSize: '14px', width: '100%', background: C.inputBg, boxSizing: 'border-box', fontFamily: FONT, color: C.text }
  const lbl: React.CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT, letterSpacing: '0.06em' }

  const rows = useMemo(() => {
    return text.split('\n').map(l => l.trim()).filter(l => l.length > 0).map(parseLine)
  }, [text])

  const valid = rows.filter(r => r.ok)
  const invalid = rows.filter(r => !r.ok)
  const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const save = async () => {
    if (valid.length === 0) { alert('No valid rows to import'); return }
    setSaving(true)
    try {
      const payload = valid.map(r => ({
        account_name: account,
        transaction_date: r.transaction_date,
        description: r.description,
        amount: flipSign ? -r.amount : r.amount,
        category: 'Other',
        is_business: true,
        is_reconciled: false,
        notes: '',
        entity: getEntity(r.transaction_date),
      }))
      const { error } = await supabase.from('bank_statement_transactions').insert(payload)
      if (error) throw error
      fetchData()
      onClose()
    } catch (e: any) {
      alert('Error: ' + e.message)
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.teal}`, maxWidth: '560px', width: '100%', maxHeight: '92vh', overflowY: 'auto', fontFamily: FONT }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontWeight: 900, color: C.text, fontSize: '16px', margin: 0 }}>PASTE TRANSACTIONS</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ fontSize: '12px', color: C.muted, marginBottom: '12px' }}>
          One transaction per line: <strong>date, description, amount</strong> (comma or tab separated). Negative or (parentheses) = money out. Example: 06/01/2026, USPS Postage, -12.40
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <div>
            <span style={lbl}>Account</span>
            <select value={account} onChange={e => setAccount(e.target.value)} style={inp}>
              <optgroup label="Credit Cards">
                {accountOptions.cards.map(a => <option key={a} value={a}>{a}</option>)}
              </optgroup>
              <optgroup label="Checking">
                {accountOptions.checking.map(a => <option key={a} value={a}>{a}</option>)}
              </optgroup>
            </select>
          </div>

          <div>
            <span style={lbl}>Pasted Rows</span>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder={"06/01/2026, USPS Postage, -12.40\n06/02/2026, TCGplayer payout, 145.20"} style={{ ...inp, height: '140px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: C.text, cursor: 'pointer' }}>
            <input type="checkbox" checked={flipSign} onChange={e => setFlipSign(e.target.checked)} />
            Flip all signs (use if your export lists charges as positive)
          </label>

          {rows.length > 0 && (
            <div style={{ background: C.inputBg, borderRadius: '10px', padding: '10px', maxHeight: '220px', overflowY: 'auto' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: C.muted, marginBottom: '6px' }}>
                PREVIEW — {valid.length} valid{invalid.length > 0 ? `, ${invalid.length} with errors` : ''}
              </div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '5px 0', borderBottom: `1px solid ${C.border}`, fontSize: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {r.ok ? (
                      <>
                        <div style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</div>
                        <div style={{ color: C.muted, fontSize: '10px' }}>{r.transaction_date}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ color: '#ef4444', fontSize: '11px' }}>{r.error}</div>
                        <div style={{ color: C.muted, fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.raw}</div>
                      </>
                    )}
                  </div>
                  {r.ok && (
                    <span style={{ fontWeight: 700, color: (flipSign ? -r.amount : r.amount) >= 0 ? C.teal : C.pink, whiteSpace: 'nowrap' }}>
                      {fmt(flipSign ? -r.amount : r.amount)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT, fontSize: '13px' }}>CANCEL</button>
            <button onClick={save} disabled={saving || valid.length === 0} style={{ flex: 2, padding: '12px', background: (saving || valid.length === 0) ? C.muted : `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: (saving || valid.length === 0) ? 'default' : 'pointer', fontFamily: FONT, fontSize: '13px' }}>
              {saving ? 'IMPORTING…' : `IMPORT ${valid.length} ROW${valid.length !== 1 ? 'S' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
