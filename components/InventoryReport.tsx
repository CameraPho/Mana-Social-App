'use client'
import React, { useState, useMemo } from 'react'
import { FONT } from '@/lib/constants'
import { fmt } from '@/lib/format'

const TYPE_LABELS: Record<string, string> = {
  collection: 'Collection',
  booster_box: 'Booster Box',
  precon: 'Precon',
  sealed: 'Sealed',
  singles: 'Singles',
}

export default function InventoryReport(p: any) {
  const { C, allCogsInventory, supabase, fetchData } = p
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'selling'|'sold_out'>('all')
  const [setFilter, setSetFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date'|'value'|'margin'|'name'>('date')
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editSoldQty, setEditSoldQty] = useState<string>('')

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, fontSize: '13px', background: C.inputBg, fontFamily: FONT, color: C.text }
  const lbl: React.CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT }
  const editBtn: React.CSSProperties = { background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '3px 8px', fontSize: '11px', color: C.muted, cursor: 'pointer', fontFamily: FONT }

  // Compute lot statistics
  const lots = useMemo(() => {
    return (allCogsInventory || []).map((lot: any) => {
      const total = parseInt(lot.total_units) || 0
      const sold = parseInt(lot.sold_units) || 0
      const onHand = total - sold
      const cost = parseFloat(lot.total_cost) || 0
      const estValue = parseFloat(lot.est_sell_value) || 0
      const soldPct = total > 0 ? (sold / total) * 100 : 0
      const remainingCost = total > 0 ? cost * (onHand / total) : 0
      const remainingValue = total > 0 ? estValue * (onHand / total) : 0
      const margin = cost > 0 ? ((estValue - cost) / cost) * 100 : 0
      const status: 'active' | 'selling' | 'sold_out' = 
        sold === 0 ? 'active' :
        sold >= total ? 'sold_out' : 'selling'
      return { ...lot, total, sold, onHand, cost, estValue, soldPct, remainingCost, remainingValue, margin, status }
    })
  }, [allCogsInventory])

  // Apply filters
  const filteredLots = useMemo(() => {
    let result = lots
    if (typeFilter !== 'all') result = result.filter((l: any) => l.inventory_type === typeFilter)
    if (statusFilter !== 'all') result = result.filter((l: any) => l.status === statusFilter)
    if (setFilter !== 'all') result = result.filter((l: any) => l.set_name === setFilter)
    
    // Sort
    result = [...result].sort((a: any, b: any) => {
      if (sortBy === 'date') return (b.date || '').localeCompare(a.date || '')
      if (sortBy === 'value') return b.remainingValue - a.remainingValue
      if (sortBy === 'margin') return b.margin - a.margin
      if (sortBy === 'name') return (a.description || '').localeCompare(b.description || '')
      return 0
    })
    return result
  }, [lots, typeFilter, statusFilter, setFilter, sortBy])

  // Dashboard totals
  const totals = useMemo(() => {
    const totalCost = lots.reduce((s: number, l: any) => s + l.cost, 0)
    const totalEstValue = lots.reduce((s: number, l: any) => s + l.estValue, 0)
    const remainingCost = lots.reduce((s: number, l: any) => s + l.remainingCost, 0)
    const remainingValue = lots.reduce((s: number, l: any) => s + l.remainingValue, 0)
    const realizedCost = totalCost - remainingCost
    const unrealizedMargin = remainingValue - remainingCost
    const activeLots = lots.filter((l: any) => l.status !== 'sold_out').length
    const soldOutLots = lots.filter((l: any) => l.status === 'sold_out').length
    return { totalCost, totalEstValue, remainingCost, remainingValue, realizedCost, unrealizedMargin, activeLots, soldOutLots }
  }, [lots])

  // Unique sets for filter
  const uniqueSets = useMemo(() => {
    const sets = new Set<string>()
    lots.forEach((l: any) => { if (l.set_name) sets.add(l.set_name) })
    return Array.from(sets).sort()
  }, [lots])

  const updateSoldCount = async (lotId: string, newSold: number, totalUnits: number) => {
    const clampedSold = Math.max(0, Math.min(newSold, totalUnits))
    try {
      await supabase
        .from('cogs_inventory')
        .update({ sold_units: clampedSold })
        .eq('id', lotId)
      setEditingId(null)
      setEditSoldQty('')
      fetchData()
    } catch (err: any) {
      alert('Update error: ' + err.message)
    }
  }

  const markSoldOut = async (lot: any) => {
    if (!confirm(`Mark all ${lot.onHand} remaining units of "${lot.description}" as sold out?`)) return
    await updateSoldCount(lot.id, lot.total, lot.total)
  }

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    active:   { label: 'Active',     color: '#2DD4BF' },
    selling:  { label: 'Selling',    color: '#FBBF24' },
    sold_out: { label: 'Sold Out',   color: '#94A3B8' },
  }

  return (
    <div>
      {/* Dashboard Summary */}
      <div style={{ ...card, background: C.navyDark, color: '#fff' }}>
        <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>CURRENT INVENTORY VALUE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px' }}>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>At Cost</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#fda4af' }}>{fmt(totals.remainingCost)}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>At Market</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: C.teal }}>{fmt(totals.remainingValue)}</div>
          </div>
        </div>
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px', opacity: 0.85 }}>
          <div>
            <div style={{ opacity: 0.6 }}>Unrealized Margin</div>
            <div style={{ fontWeight: 700, color: totals.unrealizedMargin >= 0 ? C.teal : '#fda4af' }}>{fmt(totals.unrealizedMargin)}</div>
          </div>
          <div>
            <div style={{ opacity: 0.6 }}>Active Lots</div>
            <div style={{ fontWeight: 700 }}>{totals.activeLots}</div>
          </div>
          <div>
            <div style={{ opacity: 0.6 }}>Sold Out</div>
            <div style={{ fontWeight: 700 }}>{totals.soldOutLots}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...card, padding: '14px' }}>
        <div style={{ fontSize: '12px', color: C.muted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Filters & Sort</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div>
            <span style={lbl}>Type</span>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inp, width: '100%' }}>
              <option value="all">All Types</option>
              {Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Status</span>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ ...inp, width: '100%' }}>
              <option value="all">All Statuses</option>
              <option value="active">Active (Untouched)</option>
              <option value="selling">Selling</option>
              <option value="sold_out">Sold Out</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <span style={lbl}>Set</span>
            <select value={setFilter} onChange={e => setSetFilter(e.target.value)} style={{ ...inp, width: '100%' }}>
              <option value="all">All Sets</option>
              {uniqueSets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Sort By</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ ...inp, width: '100%' }}>
              <option value="date">Newest First</option>
              <option value="value">Highest Value</option>
              <option value="margin">Highest Margin</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '10px', fontSize: '12px', color: C.muted }}>
          Showing <strong>{filteredLots.length}</strong> of <strong>{lots.length}</strong> lots
        </div>
      </div>

      {/* Lot List */}
      {filteredLots.length === 0 ? (
        <div style={{ ...card, padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: C.muted }}>No lots match these filters.</div>
        </div>
      ) : filteredLots.map((lot: any) => {
        const status = STATUS_LABELS[lot.status]
        const isEditing = editingId === lot.id
        return (
          <div key={lot.id} style={{ ...card, padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{lot.description}</span>
                  <span style={{ padding: '2px 6px', borderRadius: '4px', background: `${status.color}20`, color: status.color, fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>{status.label}</span>
                </div>
                <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                  {TYPE_LABELS[lot.inventory_type] || lot.inventory_type}
                  {lot.set_name && ` · ${lot.set_name}`}
                  {lot.date && ` · ${lot.date}`}
                </div>
              </div>
              <div style={{ textAlign: 'right', marginLeft: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{fmt(lot.remainingValue)}</div>
                <div style={{ fontSize: '11px', color: C.muted }}>cost {fmt(lot.remainingCost)}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ fontSize: '11px', color: C.muted }}>{lot.sold} / {lot.total} units sold</span>
                <span style={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>{lot.soldPct.toFixed(0)}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: C.inputBg, borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${lot.soldPct}%`, height: '100%', background: lot.soldPct >= 100 ? C.muted : `linear-gradient(90deg, ${C.teal}, #7C3AED)`, transition: 'width 0.3s ease' }} />
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '10px', fontSize: '11px' }}>
              <div>
                <div style={{ color: C.muted }}>On Hand</div>
                <div style={{ fontWeight: 700, color: C.text }}>{lot.onHand.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: C.muted }}>Per Unit</div>
                <div style={{ fontWeight: 700, color: C.text }}>${(lot.cost / (lot.total || 1)).toFixed(3)}</div>
              </div>
              <div>
                <div style={{ color: C.muted }}>Est. Margin</div>
                <div style={{ fontWeight: 700, color: lot.margin >= 0 ? C.teal : '#ef4444' }}>{lot.margin > 0 ? '+' : ''}{lot.margin.toFixed(0)}%</div>
              </div>
            </div>

            {/* Actions */}
            {isEditing ? (
              <div style={{ marginTop: '10px', padding: '10px', background: C.inputBg, borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: C.muted, marginBottom: '6px' }}>
                  Update total units sold (0 to {lot.total})
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="number" value={editSoldQty} onChange={e => setEditSoldQty(e.target.value)} placeholder={String(lot.sold)} style={{ ...inp, flex: 1 }} />
                  <button onClick={() => updateSoldCount(lot.id, parseInt(editSoldQty), lot.total)} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>Save</button>
                  <button onClick={() => { setEditingId(null); setEditSoldQty('') }} style={editBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                {lot.status !== 'sold_out' && (
                  <button onClick={() => { setEditingId(lot.id); setEditSoldQty(String(lot.sold)) }} style={editBtn}>
                    Update Sold Count
                  </button>
                )}
                {lot.status !== 'sold_out' && lot.onHand > 0 && (
                  <button onClick={() => markSoldOut(lot)} style={{ ...editBtn, color: C.teal, borderColor: C.teal }}>
                    Mark Sold Out
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
