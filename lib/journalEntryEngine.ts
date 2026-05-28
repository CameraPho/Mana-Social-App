'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'
import { FONT } from '@/lib/constants'
import { approveJEs, rejectJEs } from '@/lib/journalEntryEngine'

export default function PendingJournalEntries({ C, onBack }: { C: any; onBack: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [entries, setEntries] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('journal_entries')
      .select('*, journal_entry_lines(*, chart_of_accounts(account_number, account_name, normal_balance))')
      .eq('is_posted', false)
      .order('entry_date', { ascending: false })
    setEntries(data || [])
    setSelected(new Set())
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchPending() }, [fetchPending])

  const fmt = (n: number) => `$${(Number(n) || 0).toFixed(2)}`
  const acctLabel = (line: any) => {
    const a = line.chart_of_accounts
    return a ? `${a.account_number} · ${a.account_name}` : '—'
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }
  const toggleAll = () => {
    selected.size === entries.length ? setSelected(new Set()) : setSelected(new Set(entries.map(e => e.id)))
  }

  const approve = async (ids: string[]) => {
    if (ids.length === 0) return
    if (!confirm(`Approve and post ${ids.length} journal entr${ids.length === 1 ? 'y' : 'ies'}?`)) return
    setBusy(true)
    const res = await approveJEs(ids, supabase)
    setBusy(false)
    if (!res.success) { alert('Approve failed: ' + res.error); return }
    fetchPending()
  }
  const reject = async (ids: string[]) => {
    if (ids.length === 0) return
    if (!confirm(`Reject and permanently delete ${ids.length} pending journal entr${ids.length === 1 ? 'y' : 'ies'}?\n\nThe source record stays; only the staged JE is removed.`)) return
    setBusy(true)
    const res = await rejectJEs(ids, supabase)
    setBusy(false)
    if (!res.success) { alert('Reject failed: ' + res.error); return }
    fetchPending()
  }

  const btn = (bg: string, brd: string, col: string): React.CSSProperties => ({
    background: bg, border: `1px solid ${brd}`, color: col, borderRadius: '8px',
    padding: '8px 14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT,
  })

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <button onClick={onBack} style={btn('none', C.border, C.muted)}>← Back</button>
        <div style={{ fontSize: '13px', color: C.muted }}>{entries.length} pending</div>
      </div>

      <div style={{ fontSize: '20px', fontWeight: 'bold', color: C.text, marginBottom: '4px' }}>Pending Journal Entries</div>
      <div style={{ fontSize: '13px', color: C.muted, marginBottom: '16px' }}>
        Review staged entries, then approve to post them to the ledger or reject to discard. Source records are never affected by rejecting.
      </div>

      {loading ? (
        <div style={{ color: C.muted, padding: '20px' }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={{ color: C.muted, padding: '20px', textAlign: 'center', background: C.cardBg, borderRadius: '10px' }}>
          ✓ No pending entries. Everything is posted.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={toggleAll} style={btn('none', C.border, C.text)}>
              {selected.size === entries.length ? 'Deselect all' : 'Select all'}
            </button>
            <button onClick={() => approve([...selected])} disabled={busy || selected.size === 0} style={{ ...btn('rgba(45,191,184,0.1)', C.teal, C.teal), opacity: busy || selected.size === 0 ? 0.4 : 1 }}>
              ✓ Approve Selected ({selected.size})
            </button>
            <button onClick={() => reject([...selected])} disabled={busy || selected.size === 0} style={{ ...btn('rgba(239,68,68,0.08)', '#dc2626', '#dc2626'), opacity: busy || selected.size === 0 ? 0.4 : 1 }}>
              ✕ Reject Selected ({selected.size})
            </button>
            <button onClick={() => approve(entries.map(e => e.id))} disabled={busy} style={{ ...btn(`linear-gradient(135deg,${C.teal},#1A7A75)`, C.teal, '#fff'), opacity: busy ? 0.4 : 1 }}>
              ✓ Approve All
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {entries.map(e => {
              const el = (e.journal_entry_lines || []).slice().sort((a: any, b: any) => (a.line_order || 0) - (b.line_order || 0))
              const dr = el.reduce((s: number, l: any) => s + Number(l.debit || 0), 0)
              const cr = el.reduce((s: number, l: any) => s + Number(l.credit || 0), 0)
              const balanced = Math.abs(dr - cr) < 0.01
              const isSel = selected.has(e.id)
              return (
                <div key={e.id} style={{ background: C.cardBg, border: `1px solid ${isSel ? C.teal : C.border}`, borderRadius: '10px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer', flex: 1 }}>
                      <input type="checkbox" checked={isSel} onChange={() => toggle(e.id)} style={{ marginTop: '3px' }} />
                      <div>
                        <div style={{ fontWeight: 'bold', color: C.text, fontSize: '14px' }}>{e.description}</div>
                        <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                          {e.entry_date} · {e.source_type} · {balanced ? <span style={{ color: C.teal }}>✓ Balanced</span> : <span style={{ color: '#dc2626' }}>⚠ Unbalanced</span>}
                        </div>
                      </div>
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => approve([e.id])} disabled={busy} style={btn('rgba(45,191,184,0.1)', C.teal, C.teal)}>✓</button>
                      <button onClick={() => reject([e.id])} disabled={busy} style={btn('rgba(239,68,68,0.08)', '#dc2626', '#dc2626')}>✕</button>
                    </div>
                  </div>
                  <div style={{ marginTop: '10px', borderTop: `1px solid ${C.border}`, paddingTop: '10px' }}>
                    {el.map((l: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', color: C.text }}>
                        <span style={{ paddingLeft: Number(l.debit) > 0 ? '0' : '20px', color: Number(l.debit) > 0 ? C.text : C.muted, flex: 1 }}>{acctLabel(l)}</span>
                        <span style={{ minWidth: '90px', textAlign: 'right', color: Number(l.debit) > 0 ? C.text : 'transparent' }}>{Number(l.debit) > 0 ? fmt(l.debit) : '·'}</span>
                        <span style={{ minWidth: '90px', textAlign: 'right', color: Number(l.credit) > 0 ? C.text : 'transparent' }}>{Number(l.credit) > 0 ? fmt(l.credit) : '·'}</span>
                      </div>
                    ))}
                    {e.notes && <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px', fontStyle: 'italic' }}>📝 {e.notes}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', borderTop: `1px solid ${C.border}`, marginTop: '4px', paddingTop: '4px', color: C.text }}>
                      <span style={{ flex: 1 }}>Total</span>
                      <span style={{ minWidth: '90px', textAlign: 'right' }}>{fmt(dr)}</span>
                      <span style={{ minWidth: '90px', textAlign: 'right' }}>{fmt(cr)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
