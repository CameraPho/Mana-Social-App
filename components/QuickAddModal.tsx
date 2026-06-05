'use client'
import React from 'react'
import { FONT, type Palette } from '@/lib/constants'

const RECORD_TYPES: [string, string, keyof Palette][] = [
  ['sales',            'SALE',      'green'],
  ['expenses',         'EXPENSE',   'pink'],
  ['accounts_payable', 'BILL',      'pink'],
  ['payroll',          'PAYROLL',   'text'],
  ['cogs_inventory',   'INVENTORY', 'purple'],
  ['mileage_log',      'MILEAGE',   'teal'],
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cardBg, borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', maxWidth: '480px', width: '100%', fontFamily: FONT }}>
        <div style={{ fontWeight: 900, color: C.text, fontSize: '18px', marginBottom: '16px' }}>ADD RECORD</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {RECORD_TYPES.map(([table, label, colorKey]) => (
            <button key={table} onClick={() => { onPick(table); onClose() }} style={{ padding: '17px', borderRadius: '12px', border: `1px solid ${C.border}`, fontWeight: 'bold', fontSize: '14px', background: C.white, color: C[colorKey] as string, cursor: 'pointer', fontFamily: FONT }}>{label}</button>
          ))}
          <button onClick={() => { onBulk(); onClose() }} style={{ padding: '17px', borderRadius: '12px', border: `1px solid ${C.gold}`, fontWeight: 'bold', fontSize: '14px', background: C.white, color: '#7A5A00', cursor: 'pointer', fontFamily: FONT }}>BULK ADD</button>
          <button onClick={() => { onDraw(); onClose() }} style={{ padding: '17px', borderRadius: '12px', border: `1px solid ${C.teal}`, fontWeight: 'bold', fontSize: '14px', background: C.white, color: C.teal, cursor: 'pointer', fontFamily: FONT }}>OWNER DRAW</button>
        </div>
        <button onClick={onClose} style={{ marginTop: '14px', width: '100%', padding: '13px', borderRadius: '12px', border: 'none', background: 'transparent', color: C.muted, fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}>CANCEL</button>
      </div>
    </div>
  )
}
