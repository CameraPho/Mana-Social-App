'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'
import { FONT } from '@/lib/constants'
import { stageJEForRecord } from '@/lib/journalEntryEngine'

export default function PeriodicCOGS({ C, onBack }: { C: any; onBack: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [beginning, setBeginning] = useState('')
  const [ending, setEnding] = useState('')
  const [purchases, setPurchases] = useState(0)
  const [loadingPurch, setLoadingPurch] = useState(false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<any[]>([])

  const fmt = (n: number) => `$${(Number(n) || 0).toFixed(2)}`

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase.from('cogs_adjustment').select('*').order('period_end', { ascending: false })
    setHistory(data || [])
  }, [supabase])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // Auto-sum purchases (total_cost of cogs_inventory) within the period
  const loadPurchases = useCallback(async () => {
    if (!periodStart || !periodEnd) return
    setLoadingPurch(true)
    const { data } = await supabase
      .from('cogs_inventory')
      .select('total_cost, date')
      .gte('date', periodStart)
      .lte('date', periodEnd)
    const sum = (data || []).reduce((s: number, r: any) => s + (Number(r.total_cost) || 0), 0)
    setPurchases(sum)
    setLoadingPurch(false)
  }, [supabase, periodStart, periodEnd])

  useEffect(() => { loadPurchases() }, [loadPurchases])

  // Auto-suggest beginning from the prior period's ending
  useEffect(() => {
    if (history.length > 0 && !beginning) {
      setBeginning(String(history[0].ending_inventory ?? ''))
    }
  }, [history, beginning])

  const beginNum = parseFloat(beginning) || 0
  const endNum = parseFloat(ending) || 0
  const cogs = beginNum + purchases - endNum

  const save = async () => {
    if (!periodEnd) { alert('Set a period end date'); return }
    if (!ending) { alert('Enter ending inventory (physical count value)'); return }
    setBusy(true)
    try {
      const payload = {
        period_label: periodStart && periodEnd ? `${periodStart} → ${periodEnd}` : periodEnd,
        period_start: periodStart || null,
        period_end: periodEnd,
        beginning_inventory: beginNum,
        purchases,
        ending_inventory: endNum,
        cogs_amount: cogs,
        notes: notes || null,
        entity: 'Mana Social LLC',
      }
      const { data: inserted, error } = await supabase.from('cogs_adjustment').insert([payload]).select().single()
      if (error) { alert('Save failed: ' + error.message); setBusy(false); return }
      if (inserted) {
        const res = await stageJEForRecord('cogs_adjustment', inserted, supabase)
        if (!res.success && !res.skipped) alert('Saved, but JE staging skipped: ' + res.error)
      }
      setBeginning(''); setEnding(''); setNotes(''); setPeriodStart(''); setPeriodEnd('')
      fetchHistory()
      alert('COGS adjustment saved and staged for review in Pending Journal Entries.')
    } catch (err: any) { alert('Error: ' + err.message) }
    setBusy(false)
  }

  const lbl: React.CSSProperties = { fontSize: '11px', color: C.muted, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }
  const inp: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.inputBg, color: C.text, fontSize: '14px', fontFamily: FONT, boxSizing: 'border-box' }

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 14px', fontSize: '12px', color: C.muted, cursor: 'pointer', fontFamily: FONT }}>← Back</button>
      </div>

      <div style={{ fontSize: '20px', fontWeight: 'bold', color: C.text, marginBottom: '4px' }}>Period-End COGS</div>
      <div style={{ fontSize: '13px', color: C.muted, marginBottom: '16px' }}>
        Periodic inventory method. Enter your ending inventory (physical count value); COGS is computed as Beginning + Purchases − Ending, then posts DR 5000 COGS / CR 1200 Inventory.
      </div>

      <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '16px', display: 'grid', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div><span style={lbl}>Period Start</span><input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={inp} /></div>
          <div><span style={lbl}>Period End</span><input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={inp} /></div>
        </div>

        <div><span style={lbl}>Beginning Inventory {history.length > 0 && <span style={{ color: C.muted, textTransform: 'none', fontWeight: 'normal' }}>(prior period ending)</span>}</span>
          <input type="number" step="0.01" value={beginning} onChange={e => setBeginning(e.target.value)} placeholder="0.00" style={inp} />
        </div>

        <div><span style={lbl}>Purchases this period {loadingPurch && <span style={{ color: C.muted }}>(loading…)</span>}</span>
          <div style={{ ...inp, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(45,191,184,0.06)' }}>
            <span style={{ color: C.muted, fontSize: '12px' }}>Auto-summed from inventory buys in range</span>
            <strong>{fmt(purchases)}</strong>
          </div>
        </div>

        <div><span style={lbl}>Ending Inventory (physical count value)</span>
          <input type="number" step="0.01" value={ending} onChange={e => setEnding(e.target.value)} placeholder="0.00" style={inp} />
        </div>

        <div style={{ padding: '12px', borderRadius: '8px', background: cogs >= 0 ? 'rgba(45,191,184,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${cogs >= 0 ? C.teal : '#ef4444'}40` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: C.muted }}>
            <span>{fmt(beginNum)} + {fmt(purchases)} − {fmt(endNum)}</span>
            <span style={{ fontWeight: 'bold', fontSize: '16px', color: cogs >= 0 ? '#1A7A75' : '#ef4444' }}>COGS: {fmt(cogs)}</span>
          </div>
          <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>
            {cogs >= 0 ? 'DR 5000 Cost of Goods Sold · CR 1200 Inventory' : 'Inventory grew beyond purchases — reversing entry'}
          </div>
        </div>

        <div><span style={lbl}>Notes</span><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Q2 2026 physical count" style={inp} /></div>

        <button onClick={save} disabled={busy} style={{ padding: '12px', background: busy ? C.muted : `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: FONT, fontSize: '14px' }}>
          {busy ? 'Saving…' : 'Compute & Stage COGS Entry'}
        </button>
      </div>

      {history.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: C.text, marginBottom: '8px' }}>History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map(h => (
              <div key={h.id} style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '12px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: C.text }}>
                  <span>{h.period_label || h.period_end}</span>
                  <span>COGS {fmt(h.cogs_amount)}</span>
                </div>
                <div style={{ color: C.muted, fontSize: '12px', marginTop: '2px' }}>
                  Begin {fmt(h.beginning_inventory)} + Buys {fmt(h.purchases)} − End {fmt(h.ending_inventory)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
