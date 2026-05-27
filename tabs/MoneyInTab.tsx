'use client'
import React, { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import { FONT } from '@/lib/constants'
const supabase = createClient()
import { fmt, getEntity } from '@/lib/format'
import { parsePDF } from '@/parsers/universalPDF'

export default function MoneyInTab(p: any) {
  const { C, sales, fetchData, startEdit, handleDelete } = p
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadPreview, setUploadPreview] = useState<any[]>([])
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const secHdr: React.CSSProperties = { fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', fontFamily: FONT, display: 'block' }
  const editBtn: React.CSSProperties = { background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: C.muted, cursor: 'pointer', fontFamily: FONT }
  const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '18px', fontFamily: FONT }

  // Correct math: shipping is income from customer, NOT a fee
  const grossItemRevenue = sales.reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
  const totalShippingIncome = sales.reduce((s: number, r: any) => s + Number(r.shipping || 0), 0)
  const totalFees = sales.reduce((s: number, r: any) => s + Number(r.fees || 0), 0)
  const totalCATax = sales.reduce((s: number, r: any) => s + Number(r.ca_sales_tax || 0), 0)
  const totalOtherTax = sales.reduce((s: number, r: any) => s + Number(r.other_domestic_sales_tax || 0), 0)
  const totalIntlTax = sales.reduce((s: number, r: any) => s + Number(r.international_sales_tax || 0), 0)
  const totalTax = totalCATax + totalOtherTax + totalIntlTax
  // Net payout = what hits your bank from marketplace = item + shipping - fees (platform remits tax)
  const netPayout = grossItemRevenue + totalShippingIncome - totalFees

  const handleUpload = async (file: File) => {
    setUploadPreview([])
    const name = file.name.toLowerCase()
    try {
      if ((name.endsWith('.xlsx') || name.endsWith('.xls')) && !name.includes('ebay')) {
        setUploadStatus('Parsing TCGplayer report...')
        const { records, meta } = await parsePDF(file, 'TCGplayer')
        setUploadPreview(records.map((r: any) => ({ ...r, platform: 'TCGplayer', _label: `TCGplayer · ${meta.periodStart} – ${meta.periodEnd}` })))
        setUploadStatus(`TCGplayer: ${meta.numOrders} orders · Gross ${fmt(meta.grossSales)}`)
        return
      }
      if (name.endsWith('.csv') && (name.includes('manapool') || name.includes('mana_pool') || name.includes('mana pool'))) {
        setUploadStatus('Parsing ManaPool report...')
        const { records, meta } = await parsePDF(file, 'ManaPool')
        setUploadPreview(records.map((r: any) => ({ ...r, platform: 'ManaPool', _label: `ManaPool · ${meta.totalOrders} orders` })))
        setUploadStatus(`ManaPool: Gross ${fmt(meta.totalGross)}`)
        return
      }
      if (name.endsWith('.csv')) {
        setUploadStatus('Parsing eBay report...')
        const { records, meta } = await parsePDF(file, 'eBay')
        setUploadPreview(records.map((r: any) => ({ ...r, platform: 'eBay', _label: `eBay · ${meta.rows} listings` })))
        setUploadStatus(`eBay: Gross ${fmt(meta.totalGross)}`)
        return
      }
      setUploadStatus('Unrecognized file — use TCGplayer .xlsx, eBay .csv, or ManaPool .csv')
    } catch (err: any) {
      setUploadStatus('Error: ' + err.message)
    }
  }

  const confirmUpload = async () => {
    setUploadStatus('Saving...')
    const inserts = uploadPreview.map((r: any) => {
      const amount = parseFloat(r.amount) || 0
      const shipping = parseFloat(r.shipping) || 0
      const fees = parseFloat(r.fees) || 0
      return {
        platform: r.platform || 'other',
        amount, fees, shipping,
        ca_sales_tax: parseFloat(r.ca_sales_tax) || 0,
        other_domestic_sales_tax: parseFloat(r.other_domestic_sales_tax) || 0,
        international_sales_tax: parseFloat(r.international_sales_tax) || 0,
        sale_date: r.sale_date,
        period_start: r.period_start || r.sale_date,
        period_end: r.period_end || r.sale_date,
        entity: r.entity || getEntity(r.sale_date),
        net_sales: amount + shipping - fees,  // Bank-deposit-matchable
        num_orders: parseInt(r.num_orders) || 1
      }
    })
    const { error } = await supabase.from('sales').insert(inserts)
    if (error) { setUploadStatus('Error: ' + error.message); return }
    setUploadPreview([]); setUploadStatus('Saved!'); fetchData()
    setTimeout(() => setUploadStatus(''), 3000)
  }

  const platforms = Array.from(new Set(sales.map((s: any) => s.platform)))

  return (
    <div>
      {/* Net Payout summary card */}
      <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
        <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>NET PAYOUT (BANK DEPOSIT)</div>
        <div style={{ fontSize: '30px', fontWeight: 900, color: '#4ade80' }}>{fmt(netPayout)}</div>
        <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '6px' }}>
          Gross {fmt(grossItemRevenue)} + Shipping {fmt(totalShippingIncome)} − Fees {fmt(totalFees)}
        </div>
        {totalTax > 0 && (
          <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px' }}>
            Tax collected (platform remits): CA {fmt(totalCATax)} · Other {fmt(totalOtherTax)} · Intl {fmt(totalIntlTax)}
          </div>
        )}
      </div>

      <div style={{ ...card, padding: '14px' }}>
        <span style={secHdr}>IMPORT SALES</span>
        <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${C.teal}`, background: 'rgba(45,191,184,0.08)', fontSize: '14px', fontWeight: 'bold', color: C.teal, cursor: 'pointer', fontFamily: FONT }}>Upload report file</button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
        <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px' }}>TCGplayer .xlsx · eBay .csv · ManaPool .csv</div>
        {uploadStatus && <div style={{ marginTop: '8px', fontSize: '13px', color: C.teal }}>{uploadStatus}</div>}
      </div>

      {uploadPreview.length > 0 && (
        <div style={{ ...card, border: `1px solid ${C.teal}` }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.teal, marginBottom: '8px', textTransform: 'uppercase' }}>Import Preview</div>
          {uploadPreview.map((r, i) => {
            const amt = Number(r.amount || 0)
            const ship = Number(r.shipping || 0)
            const fee = Number(r.fees || 0)
            const net = amt + ship - fee
            return (
              <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
                  <span>{r._label}</span>
                  <span style={{ color: C.green }}>{fmt(net)}</span>
                </div>
                <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                  Item {fmt(amt)} + Ship {fmt(ship)} − Fees {fmt(fee)}
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={confirmUpload} style={{ padding: '10px 18px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Save all</button>
            <button onClick={() => { setUploadPreview([]); setUploadStatus('') }} style={{ padding: '10px 14px', background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.muted, cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Cancel</button>
          </div>
        </div>
      )}

      {platforms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No sales this period — upload a report or tap + to add one</div>
      ) : platforms.map((platform: any) => {
        const ps = sales.filter((s: any) => s.platform === platform)
        const ptItem = ps.reduce((a: number, s: any) => a + Number(s.amount || 0), 0)
        const ptShip = ps.reduce((a: number, s: any) => a + Number(s.shipping || 0), 0)
        const ptFees = ps.reduce((a: number, s: any) => a + Number(s.fees || 0), 0)
        const ptNet = ptItem + ptShip - ptFees
        const isOpen = expandedTiles[platform]
        return (
          <div key={platform} style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div onClick={() => setExpandedTiles(prev => ({ ...prev, [platform]: !prev[platform] }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '15px', textTransform: 'capitalize', color: C.navy }}>{platform}</div>
                <div style={{ fontSize: '12px', color: C.muted }}>{ps.length} record{ps.length !== 1 ? 's' : ''} · Item {fmt(ptItem)} + Ship {fmt(ptShip)} − Fees {fmt(ptFees)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 900, color: C.green, fontSize: '18px' }}>{fmt(ptNet)}</span>
                <span style={{ color: C.muted }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                {ps.map((s: any) => {
                  const sAmt = Number(s.amount || 0)
                  const sShip = Number(s.shipping || 0)
                  const sFee = Number(s.fees || 0)
                  const sNet = sAmt + sShip - sFee
                  return (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.period_start && s.period_start !== s.sale_date ? `${s.period_start} – ${s.period_end}` : s.sale_date}</div>
                        <div style={{ fontSize: '11px', color: C.muted }}>Item {fmt(sAmt)} + Ship {fmt(sShip)} − Fees {fmt(sFee)} · {s.num_orders || 1} orders</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: C.green, fontSize: '15px' }}>{fmt(sNet)}</span>
                        <button onClick={() => startEdit('sales', s)} style={editBtn}>Edit</button>
                        <button onClick={() => handleDelete('sales', s.id)} style={delBtn}>×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
