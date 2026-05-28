'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { FONT } from '@/lib/constants'
import { fmt, today } from '@/lib/format'

export default function JournalEntriesView(p: any) {
  const { C, supabase } = p
  const [entries, setEntries] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedEntry, setExpandedEntry] = useState<Record<string, boolean>>({})
  const [showNewForm, setShowNewForm] = useState(false)
  const [filterSource, setFilterSource] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const [newEntry, setNewEntry] = useState({ entry_date: today(), description: '', notes: '' })
  const [newLines, setNewLines] = useState<Array<{ account_id: string; debit: string; credit: string; description: string }>>([
    { account_id: '', debit: '', credit: '', description: '' },
    { account_id: '', debit: '', credit: '', description: '' },
  ])

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, fontSize: '13px', background: C.inputBg, fontFamily: FONT, color: C.text, width: '100%', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT }
  const editBtn: React.CSSProperties = { background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: C.muted, cursor: 'pointer', fontFamily: FONT }

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [entriesResult, accountsResult] = await Promise.all([
      supabase.from('journal_entries').select('*, journal_entry_lines(*, chart_of_accounts(account_number, account_name, normal_balance))').order('entry_date', { ascending: false }).order('entry_number', { ascending: false }),
      supabase.from('chart_of_accounts').select('*').eq('is_active', true).eq('is_header', false).order('account_number'),
    ])
    if (entriesResult.data) setEntries(entriesResult.data)
    if (accountsResult.data) setAccounts(accountsResult.data)
    setLoading(false)
  }

  const toggleEntry = (id: string) => setExpandedEntry(prev => ({ ...prev, [id]: !prev[id] }))
  const addLine = () => setNewLines([...newLines, { account_id: '', debit: '', credit: '', description: '' }])
  const removeLine = (idx: number) => { if (newLines.length <= 2) return; setNewLines(newLines.filter((_, i) => i !== idx)) }
  const updateLine = (idx: number, field: string, value: string) => {
    const updated = [...newLines]
    updated[idx] = { ...updated[idx], [field]: value }
    if (field === 'debit' && value) updated[idx].credit = ''
    if (field === 'credit' && value) updated[idx].debit = ''
    setNewLines(updated)
  }

  const totalDebit = newLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = newLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0

  const resetForm = () => {
    setNewEntry({ entry_date: today(), description: '', notes: '' })
    setNewLines([{ account_id: '', debit: '', credit: '', description: '' }, { account_id: '', debit: '', credit: '', description: '' }])
    setShowNewForm(false)
  }

  const saveEntry = async () => {
    if (!newEntry.description.trim()) { alert('Description is required'); return }
    if (!isBalanced) { alert('Debits must equal credits and total must be > 0'); return }
    const validLines = newLines.filter(l => l.account_id && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0))
    if (validLines.length < 2) { alert('At least 2 lines with accounts and amounts are required'); return }
    try {
      const { data: je, error: jeErr } = await supabase.from('journal_entries').insert({
        entry_date: newEntry.entry_date, description: newEntry.description, notes: newEntry.notes || null,
        source_type: 'manual', total_debit: totalDebit, total_credit: totalCredit,
        is_posted: true, posted_by: 'Cam', entity: 'Mana Social LLC',
      }).select().single()
      if (jeErr) throw jeErr
      const linesPayload = validLines.map((l, idx) => ({
        entry_id: je.id, account_id: l.account_id,
        debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0,
        description: l.description || null, line_order: idx,
      }))
      const { error: linesErr } = await supabase.from('journal_entry_lines').insert(linesPayload)
      if (linesErr) { await supabase.from('journal_entries').delete().eq('id', je.id); throw linesErr }
      resetForm(); fetchData()
    } catch (err: any) { alert('Error saving journal entry: ' + err.message) }
  }

  const deleteEntry = async (entry: any) => {
    const warn = entry.is_reversed
      ? `⚠️ This entry was already REVERSED.\n\nDeleting it will leave its reversal entry orphaned. Only do this for cleanup of test data.\n\n`
      : ''
    if (!confirm(`Delete journal entry #${entry.entry_number}?\n\n${warn}${entry.description}\nAmount: $${Number(entry.total_debit).toFixed(2)}\n\nThis permanently deletes the entry and all its lines. This cannot be undone.`)) return
    if (!confirm(`Are you sure? Final confirmation to permanently delete JE #${entry.entry_number}.`)) return
    try {
      await supabase.from('journal_entry_lines').delete().eq('entry_id', entry.id)
      await supabase.from('journal_entries').delete().eq('id', entry.id)
      fetchData()
    } catch (err: any) { alert('Delete error: ' + err.message) }
  }

  const reverseEntry = async (entry: any) => {
    if (entry.is_reversed) { alert('Already reversed'); return }
    if (!confirm(`Reverse journal entry #${entry.entry_number}?\n\nThis creates a new entry with debits and credits swapped, and marks the original as reversed.`)) return
    try {
      const { data: revJE, error: jeErr } = await supabase.from('journal_entries').insert({
        entry_date: today(), description: `Reversal of JE #${entry.entry_number}: ${entry.description}`,
        source_type: 'reversal', source_id: entry.id, total_debit: entry.total_credit, total_credit: entry.total_debit,
        is_posted: true, posted_by: 'Cam', entity: 'Mana Social LLC',
      }).select().single()
      if (jeErr) throw jeErr
      const reversedLines = (entry.journal_entry_lines || []).map((l: any, idx: number) => ({
        entry_id: revJE.id, account_id: l.account_id,
        debit: Number(l.credit) || 0, credit: Number(l.debit) || 0,
        description: `Reversal: ${l.description || ''}`, line_order: idx,
      }))
      await supabase.from('journal_entry_lines').insert(reversedLines)
      await supabase.from('journal_entries').update({ is_reversed: true, reversed_by_id: revJE.id }).eq('id', entry.id)
      fetchData()
    } catch (err: any) { alert('Reverse error: ' + err.message) }
  }

  // Updated filter: search across entry #, description, notes, line memos, account names/numbers, source type
  const filteredEntries = useMemo(() => {
    let result = entries
    if (filterSource !== 'all') result = result.filter(e => e.source_type === filterSource)
    const q = searchTerm.trim().toLowerCase()
    if (q) {
      result = result.filter(e => {
        if (String(e.entry_number).includes(q)) return true
        if ((e.description || '').toLowerCase().includes(q)) return true
        if ((e.notes || '').toLowerCase().includes(q)) return true
        if ((e.source_type || '').toLowerCase().includes(q)) return true
        const lines = e.journal_entry_lines || []
        return lines.some((l: any) =>
          (l.description || '').toLowerCase().includes(q) ||
          (l.chart_of_accounts?.account_name || '').toLowerCase().includes(q) ||
          (l.chart_of_accounts?.account_number || '').includes(q)
        )
      })
    }
    return result
  }, [entries, filterSource, searchTerm])

  const sourceTypes = useMemo(() => {
    const types = new Set<string>()
    entries.forEach(e => { if (e.source_type) types.add(e.source_type) })
    return Array.from(types).sort()
  }, [entries])

  if (loading) return (<div style={{ ...card, padding: '40px', textAlign: 'center', color: C.muted }}>Loading journal entries...</div>)

  return (
    <div>
      <div style={{ ...card, padding: '14px 16px', background: 'rgba(45,191,184,0.06)', border: `1px solid rgba(45,191,184,0.2)` }}>
        <div style={{ fontSize: '13px', color: '#1A7A75', fontWeight: 'bold', marginBottom: '4px' }}>Journal Entries</div>
        <div style={{ fontSize: '11px', color: C.muted }}>
          The general ledger. {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} posted. Every entry must balance (debits = credits).
        </div>
      </div>

      {!showNewForm && (
        <button onClick={() => setShowNewForm(true)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${C.teal}`, background: 'rgba(45,191,184,0.08)', fontSize: '14px', fontWeight: 'bold', color: C.teal, cursor: 'pointer', fontFamily: FONT, marginBottom: '12px' }}>
          + New Journal Entry
        </button>
      )}

      {showNewForm && (
        <div style={{ ...card, border: `1px solid ${C.teal}` }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.teal, marginBottom: '12px', textTransform: 'uppercase' }}>New Journal Entry</div>
          <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
            <div><span style={lbl}>Date</span><input type="date" value={newEntry.entry_date} onChange={e => setNewEntry({ ...newEntry, entry_date: e.target.value })} style={inp} /></div>
            <div><span style={lbl}>Description</span><input value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })} placeholder="e.g. Owner contribution from Cam" style={inp} /></div>
            <div><span style={lbl}>Notes (optional)</span><input value={newEntry.notes} onChange={e => setNewEntry({ ...newEntry, notes: e.target.value })} placeholder="Memo, reference number, etc." style={inp} /></div>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '8px' }}>Lines</div>
          {newLines.map((line, idx) => (
            <div key={idx} style={{ background: C.inputBg, padding: '10px', borderRadius: '8px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold' }}>Line {idx + 1}</span>
                {newLines.length > 2 && (<button onClick={() => removeLine(idx)} style={{ ...editBtn, color: '#ef4444', borderColor: '#ef444440' }}>Remove</button>)}
              </div>
              <div style={{ marginBottom: '6px' }}>
                <select value={line.account_id} onChange={e => updateLine(idx, 'account_id', e.target.value)} style={{ ...inp, fontSize: '12px' }}>
                  <option value="">— Pick an account —</option>
                  {accounts.map(a => (<option key={a.id} value={a.id}>{a.account_number} · {a.account_name}</option>))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <div><span style={{ fontSize: '10px', color: C.muted }}>Debit</span><input type="number" step="0.01" placeholder="0.00" value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)} style={{ ...inp, fontSize: '12px' }} /></div>
                <div><span style={{ fontSize: '10px', color: C.muted }}>Credit</span><input type="number" step="0.01" placeholder="0.00" value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)} style={{ ...inp, fontSize: '12px' }} /></div>
              </div>
              <input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Line memo (optional)" style={{ ...inp, fontSize: '12px' }} />
            </div>
          ))}
          <button onClick={addLine} style={{ ...editBtn, color: C.teal, borderColor: C.teal, marginTop: '6px' }}>+ Add Line</button>
          <div style={{ marginTop: '12px', padding: '10px', background: isBalanced ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span style={{ color: C.muted, fontWeight: 'bold' }}>Total Debit:</span><span style={{ fontWeight: 700, color: C.text }}>{fmt(totalDebit)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}><span style={{ color: C.muted, fontWeight: 'bold' }}>Total Credit:</span><span style={{ fontWeight: 700, color: C.text }}>{fmt(totalCredit)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${C.border}` }}>
              <span style={{ color: isBalanced ? '#10B981' : '#ef4444', fontWeight: 'bold' }}>{isBalanced ? '✓ Balanced' : 'Out of balance'}</span>
              <span style={{ color: isBalanced ? '#10B981' : '#ef4444', fontWeight: 'bold' }}>Diff: {fmt(Math.abs(totalDebit - totalCredit))}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={saveEntry} disabled={!isBalanced} style={{ flex: 1, padding: '12px', background: isBalanced ? `linear-gradient(135deg,${C.teal},#1A7A75)` : C.muted, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isBalanced ? 'pointer' : 'not-allowed', fontFamily: FONT }}>Post Entry</button>
            <button onClick={resetForm} style={{ padding: '12px 16px', background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.muted, cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Search input */}
      <input
        type="text"
        placeholder="🔍 Search entry #, description, notes, line memos, accounts..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ ...inp, marginBottom: '10px' }}
      />

      {sourceTypes.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <span style={lbl}>Filter by Source</span>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={inp}>
            <option value="all">All Sources ({entries.length})</option>
            {sourceTypes.map(s => { const count = entries.filter(e => e.source_type === s).length; return <option key={s} value={s}>{s.replace(/_/g, ' ')} ({count})</option> })}
          </select>
        </div>
      )}

      {searchTerm.trim() && (
        <div style={{ fontSize: '11px', color: C.muted, marginBottom: '8px', paddingLeft: '4px' }}>
          {filteredEntries.length} match{filteredEntries.length === 1 ? '' : 'es'} for "{searchTerm}"
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <div style={{ ...card, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: C.muted }}>{searchTerm || filterSource !== 'all' ? 'No entries match the current filter.' : 'No journal entries yet.'}</div>
          {!searchTerm && filterSource === 'all' && <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>Create one above, or run the backfill.</div>}
        </div>
      ) : filteredEntries.map(entry => {
        const isExpanded = expandedEntry[entry.id]
        return (
          <div key={entry.id} style={{ ...card, padding: 0, overflow: 'hidden', opacity: entry.is_reversed ? 0.55 : 1 }}>
            <div onClick={() => toggleEntry(entry.id)} style={{ padding: '14px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: C.muted, fontWeight: 'bold' }}>JE-{String(entry.entry_number).padStart(4, '0')}</span>
                    {entry.is_reversed && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: '#94A3B820', color: '#94A3B8', fontWeight: 'bold' }}>REVERSED</span>}
                    {entry.source_type && entry.source_type !== 'manual' && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: `${C.teal}20`, color: C.teal, fontWeight: 'bold', textTransform: 'uppercase' }}>{entry.source_type.replace(/_/g, ' ')}</span>}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{entry.description}</div>
                  {entry.notes && (
                    <div style={{ fontSize: '11px', color: C.muted, marginTop: '3px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      📝 {entry.notes}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: C.muted, marginTop: '3px' }}>{entry.entry_date} · {(entry.journal_entry_lines || []).length} lines</div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{fmt(Number(entry.total_debit))}</div>
                  <div style={{ fontSize: '10px', color: C.muted }}>DR = CR ✓</div>
                </div>
              </div>
            </div>
            {isExpanded && (
              <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.border}`, background: C.inputBg }}>
                <div style={{ marginTop: '10px' }}>
                  {(entry.journal_entry_lines || []).sort((a: any, b: any) => (a.line_order || 0) - (b.line_order || 0)).map((line: any) => (
                    <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: C.text }}>{line.chart_of_accounts?.account_number} · {line.chart_of_accounts?.account_name}</div>
                        {line.description && <div style={{ fontSize: '10px', color: C.muted, marginTop: '1px' }}>{line.description}</div>}
                      </div>
                      <div style={{ fontFamily: 'monospace', textAlign: 'right', minWidth: '80px' }}>{Number(line.debit) > 0 ? <span style={{ fontWeight: 700, color: C.text }}>{fmt(Number(line.debit))}</span> : <span style={{ color: C.muted }}>—</span>}</div>
                      <div style={{ fontFamily: 'monospace', textAlign: 'right', minWidth: '80px' }}>{Number(line.credit) > 0 ? <span style={{ fontWeight: 700, color: C.text }}>{fmt(Number(line.credit))}</span> : <span style={{ color: C.muted }}>—</span>}</div>
                    </div>
                  ))}
                </div>
                {entry.notes && (
                  <div style={{ marginTop: '8px', padding: '8px', background: C.cardBg, borderRadius: '6px', fontSize: '11px', color: C.muted }}>
                    <strong>Notes:</strong> {entry.notes}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  {!entry.is_reversed && <button onClick={() => reverseEntry(entry)} style={editBtn}>↩ Reverse</button>}
                  <button onClick={() => deleteEntry(entry)} style={{ ...editBtn, color: '#ef4444', borderColor: '#ef444440' }}>🗑 Delete</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
