'use client'
import React, { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT } from '@/lib/constants'
import { fmt, getEntity } from '@/lib/format'
import { DEFAULT_SALES_TAX_RATE, quarterLabel, quarterDateRange, cdtfaDueDate } from '@/lib/salesTax'

export default function SalesTaxSection(p: any) {
  const { C, sales, salesTaxRemittances, fetchData } = p
  const [showRemitForm, setShowRemitForm] = useState<string | null>(null)
  const [remitData, setRemitData] = useState({ amount_remitted: '', payment_date: '', confirmation_number: '', notes: '' })

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const inp: React.CSSProperties = { padding: '13px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, fontSize: '15px', width: '100%', background: C.inputBg, boxSizing: 'border-box', fontFamily: FONT, color: C.text }
  const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT }

  // Build quarter-level summary from taxable sales
  const quarterSummary = useMemo(() => {
    const buckets: Record<string, { taxableSales: number, taxCollected: number, count: number }> = {}
    (sales || []).filter((s: any) => s.is_taxable && Number(s.sales_tax_collected) > 0).forEach((s: any) => {
      const q = quarterLabel(s.sale_date)
      if (!buckets[q]) buckets[q] = { taxableSales: 0, taxCollected: 0, count: 0 }
      buckets[q].taxableSales += Number(s.amount) - Number(s.sales_tax_collected)
      buckets[q].taxCollected += Number(s.sales_tax_collected)
      buckets[q].count += 1
    })

    // Subtract remittances
    const remittedByQuarter: Record<string, number> = {}
    ;(salesTaxRemittances || []).forEach((r: any) => {
      remittedByQuarter[r.quarter_year] = (remittedByQuarter[r.quarter_year] || 0) + Number(r.amount_remitted)
    })

    return Object.entries(buckets)
      .map(([q, data]) => ({
        quarter: q,
        ...data,
        remitted: remittedByQuarter[q] || 0,
        owed: data.taxCollected - (remittedByQuarter[q] || 0),
        dueDate: cdtfaDueDate(q),
      }))
      .sort((a, b) => b.quarter.localeCompare(a.quarter))
  }, [sales, salesTaxRemittances])

  const totalOwed = quarterSummary.reduce((sum, q) => sum + Math.max(0, q.owed), 0)

  const recordRemittance = async (quarterYear: string) => {
    if (!remitData.amount_remitted) return alert('Enter the amount remitted')
    const { start, end } = quarterDateRange(quarterYear)
    const summary = quarterSummary.find(q => q.quarter === quarterYear)
    if (!summary) return alert('Quarter data not found')
    
    const { error } = await supabase.from('sales_tax_remittances').insert({
      quarter_year: quarterYear,
      period_start: start,
      period_end: end,
      total_taxable_sales: summary.taxableSales,
      total_tax_collected: summary.taxCollected,
      amount_remitted: parseFloat(remitData.amount_remitted),
      payment_date: remitData.payment_date || null,
      confirmation_number: remitData.confirmation_number || null,
      notes: remitData.notes || null,
      entity: 'Mana Social LLC',
      status: remitData.payment_date ? 'paid' : 'filed',
    })
    if (error) return alert(error.message)
    setShowRemitForm(null)
    setRemitData({ amount_remitted: '', payment_date: '', confirmation_number: '', notes: '' })
    fetchData()
  }

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: C.text, fontFamily: FONT }}>Sales Tax (CDTFA)</h3>
          <div style={{ fontSize: '11px', color: C.muted }}>Moreno Valley: {(DEFAULT_SALES_TAX_RATE * 100).toFixed(2)}%</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          <div style={{ padding: '12px', background: C.inputBg, borderRadius: '10px' }}>
            <div style={{ fontSize: '10px', color: C.muted, fontWeight: 'bold', textTransform: 'uppercase' }}>Currently Owed</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: totalOwed > 0 ? '#ef4444' : C.green, marginTop: '4px' }}>{fmt(totalOwed)}</div>
          </div>
          <div style={{ padding: '12px', background: C.inputBg, borderRadius: '10px' }}>
            <div style={{ fontSize: '10px', color: C.muted, fontWeight: 'bold', textTransform: 'uppercase' }}>Quarters Tracked</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: C.teal, marginTop: '4px' }}>{quarterSummary.length}</div>
          </div>
        </div>

        {quarterSummary.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: '13px' }}>
            No taxable sales recorded yet. Mark sales as taxable in the Money In tab to start tracking.
          </div>
        ) : (
          quarterSummary.map(q => {
            const isOpen = q.owed > 0.01
            const isPastDue = isOpen && new Date(q.dueDate) < new Date()
            return (
              <div key={q.quarter} style={{ padding: '12px', background: C.inputBg, borderRadius: '10px', marginBottom: '8px', border: isPastDue ? `1px solid #ef4444` : `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{q.quarter}</div>
                    <div style={{ fontSize: '11px', color: isPastDue ? '#ef4444' : C.muted, marginTop: '2px' }}>
                      Due {q.dueDate}{isPastDue ? ' — OVERDUE' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: isOpen ? '#ef4444' : C.green }}>{fmt(q.owed)}</div>
                    <div style={{ fontSize: '11px', color: C.muted }}>{isOpen ? 'owed' : 'cleared ✓'}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px', marginBottom: '8px' }}>
                  <div><div style={{ color: C.muted }}>Taxable Sales</div><div style={{ fontWeight: 600 }}>{fmt(q.taxableSales)}</div></div>
                  <div><div style={{ color: C.muted }}>Tax Collected</div><div style={{ fontWeight: 600 }}>{fmt(q.taxCollected)}</div></div>
                  <div><div style={{ color: C.muted }}>Remitted</div><div style={{ fontWeight: 600 }}>{fmt(q.remitted)}</div></div>
                </div>
                {isOpen && showRemitForm !== q.quarter && (
                  <button onClick={() => { setShowRemitForm(q.quarter); setRemitData({ ...remitData, amount_remitted: q.owed.toFixed(2) }) }} style={{ width: '100%', padding: '8px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', fontFamily: FONT }}>
                    Record CDTFA Remittance
                  </button>
                )}
                {showRemitForm === q.quarter && (
                  <div style={{ marginTop: '8px', padding: '10px', background: C.cardBg, borderRadius: '8px', display: 'grid', gap: '8px' }}>
                    <div><span style={lbl}>Amount Remitted</span><input type="number" step="0.01" value={remitData.amount_remitted} onChange={e => setRemitData({ ...remitData, amount_remitted: e.target.value })} style={inp} /></div>
                    <div><span style={lbl}>Payment Date (optional)</span><input type="date" value={remitData.payment_date} onChange={e => setRemitData({ ...remitData, payment_date: e.target.value })} style={inp} /></div>
                    <div><span style={lbl}>Confirmation Number (optional)</span><input value={remitData.confirmation_number} onChange={e => setRemitData({ ...remitData, confirmation_number: e.target.value })} placeholder="From CDTFA portal" style={inp} /></div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => recordRemittance(q.quarter)} style={{ flex: 1, padding: '8px', background: C.green, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', fontFamily: FONT }}>Save</button>
                      <button onClick={() => { setShowRemitForm(null); setRemitData({ amount_remitted: '', payment_date: '', confirmation_number: '', notes: '' }) }} style={{ flex: 1, padding: '8px', background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.muted, cursor: 'pointer', fontSize: '12px', fontFamily: FONT }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
