'use client'
import React from 'react'
import { FONT, type Palette } from '@/lib/constants'

const RECORD_TYPES: [string, string, keyof Palette][] = [
  ['sales',            'SALE',              'green'],
  ['expenses',         'EXPENSE (paid now)', 'pink'],
  ['accounts_payable', 'BILL (pay later)',  'pink'],
  ['payroll',          'PAYROLL',           'text'],
  ['cogs_inventory',   'INVENTORY',         'purple'],
  ['mileage_log',      'MILEAGE',           'teal'],
  ['assets',           'ASSET',             'navy'],
  ['supply_costs',     'SUPPLY COST',       'purple'],
]

export default function QuickAddModal({ open, onClose, onPick, onBulk, onDraw, C }: {
  open: boolean
  onClose: () => void
  onPick: (table: string) => void
  onBulk: () => void
  onDraw: () => void
  C: Palette
}) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.9)', display: 'flex', alignItems: 'flex-end', padding: '20px', zIndex: 1000 }}>
      <div style={{ background: C.white, width: '100%', borderRadius: '20px', padding: '24px', fontFamily: FONT }}>
        <h2 style={{ fontWeight: 900, marginBottom: '16px', color: C.navy, fontSize: '17px' }}>ADD RECORD</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {RECORD_TYPES.map(([table, label, colorKey]) => (
            <button key={table} onClick={() => { onPick(table); onClose() }} style={{ padding: '17px', borderRadius: '12px', border: `1px solid ${C.border}`, fontWeight: 'bold', fontSize: '13px', background: C.white, color: C[colorKey] as string, cursor: 'pointer', fontFamily: FONT, textAlign: 'center', lineHeight: '1.2' }}>{label}</button>
          ))}
          <button onClick={() => { onClose(); onBulk() }} style={{ padding: '17px', borderRadius: '12px', border: `2px solid ${C.gold}`, color: '#7A5A00', fontWeight: 900, background: 'rgba(240,192,64,0.08)', cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>BULK ADD</button>
          <button onClick={() => { onClose(); onDraw() }} style={{ padding: '17px', borderRadius: '12px', border: `2px solid ${C.teal}`, color: C.teal, fontWeight: 900, background: C.white, cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>OWNER DRAW</button>
        </div>
        <button onClick={onClose} style={{ width: '100%', marginTop: '16px', border: 'none', background: 'none', color: C.muted, fontWeight: 'bold', cursor: 'pointer', padding: '8px', fontSize: '14px', fontFamily: FONT }}>CANCEL</button>
      </div>
    </div>
  )
}
