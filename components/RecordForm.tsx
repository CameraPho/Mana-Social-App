'use client'
import React from 'react'
import { FONT, type Palette, EXPENSE_CATEGORIES, ASSET_CATEGORIES, USEFUL_LIFE, MILEAGE_RATE } from '@/lib/constants'
import { useAccounts } from '@/lib/useAccounts'
import { fmt, getEntity } from '@/lib/format'

interface Props {
  table: string
  isEditing: boolean
  formData: any
  setFormData: (d: any) => void
  onSave: () => void
  onClose: () => void
  onDelete?: () => void
  C: Palette
  vendors?: { id: string; name: string }[]
}

export default function RecordForm({ table: t, isEditing, formData, setFormData, onSave, onClose, onDelete, C, vendors = [] }: Props) {
  const { checking: CHECKING_ACCOUNTS, cards: CREDIT_CARD_ACCOUNTS } = useAccounts()
  // Display labels per table - uniform with QuickAddModal naming
  const FORM_LABEL: Record<string, string> = {
    sales: 'SALE',
    expenses: 'EXPENSE',
    accounts_payable: 'BILL',
    payroll: 'PAYROLL',
    cogs_inventory: 'INVENTORY',
    mileage_log: 'MILEAGE',
    assets: 'ASSET',
    supply_costs: 'SUPPLY COST',
    disbursements: 'OWNER DRAW',
  }
  const formLabel = FORM_LABEL[t] || t.replace(/_/g, ' ').toUpperCase()
  const set = (changes: any) => setFormData({ ...formData, ...changes })

  const lbl: React.CSSProperties = { fontSize: '11px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT, letterSpacing: '0.06em' }
  const inp: React.CSSProperties = { padding: '11px 13px', borderRadius: '9px', border: `1px solid ${C.border}`, fontSize: '14px', width: '100%', background: C.inputBg, boxSizing: 'border-box', fontFamily: FONT, color: C.text }
  const ent = getEntity(formData.date)

  return (
    <div style={{ marginBottom: '14px', background: C.cardBg, borderRadius: '16px', padding: '18px', border: `1px solid ${C.teal}`, fontFamily: FONT }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h2 style={{ fontWeight: 900, color: C.navy, fontSize: '16px', fontFamily: FONT }}>{isEditing ? 'EDIT' : 'ADD'} {formLabel}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '20px', cursor: 'pointer' }}>×</button>
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        <div><span style={lbl}>Date</span><input type="date" value={formData.date} onChange={e => set({ date: e.target.value })} style={inp} /></div>
        <div style={{ padding: '7px 13px', background: 'rgba(45,191,184,0.08)', borderRadius: '7px', border: `1px solid ${C.teal}40`, fontSize: '12px', color: C.teal, fontWeight: 'bold' }}>{ent === 'llc' ? 'Mana Social LLC' : 'Cam (Sole Prop)'}</div>

        {t === 'sales' && <>
          <div><span style={lbl}>Platform</span>
            <select value={formData.platform} onChange={e => set({ platform: e.target.value })} style={inp}>
              <option value="tcgplayer">TCGplayer</option><option value="ebay">eBay</option><option value="manapool">ManaPool</option><option value="in_person">In-Person</option><option value="other">Other</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Amount</span><input type="number" step="0.01" value={formData.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>Fees</span><input type="number" step="0.01" value={formData.fees} onChange={e => set({ fees: e.target.value })} placeholder="0.00" style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Shipping</span><input type="number" step="0.01" value={formData.shipping} onChange={e => set({ shipping: e.target.value })} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>CA Tax</span><input type="number" step="0.01" value={formData.caTax} onChange={e => set({ caTax: e.target.value })} placeholder="0.00" style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Other Domestic Tax</span><input type="number" step="0.01" value={formData.otherTax} onChange={e => set({ otherTax: e.target.value })} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>Int'l Tax</span><input type="number" step="0.01" value={formData.intlTax} onChange={e => set({ intlTax: e.target.value })} placeholder="0.00" style={inp} /></div>
          </div>
        </>}

        {t === 'accounts_payable' && <>
          <div><span style={lbl}>Vendor / Seller Name</span>
            <input list="vendor-list" value={formData.apVendor || ''} onChange={e => set({ apVendor: e.target.value })} placeholder="e.g. Oscar Espinosa" style={inp} />
            <datalist id="vendor-list">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
          </div>
          <div><span style={lbl}>Transaction Description</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Collection purchase — 5,000 MTG cards" style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Invoice Date</span><input type="date" value={formData.date} onChange={e => set({ date: e.target.value })} style={inp} /></div>
            <div><span style={lbl}>Due Date</span><input type="date" value={formData.apDue || ''} onChange={e => set({ apDue: e.target.value })} style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Total Amount ($)</span><input type="number" step="0.01" value={formData.apTotal} onChange={e => set({ apTotal: e.target.value })} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>Amount Paid ($)</span><input type="number" step="0.01" value={formData.amountPaid || ''} onChange={e => set({ amountPaid: e.target.value })} placeholder="0.00" style={inp} /></div>
          </div>
          <div><span style={lbl}>Notes</span><textarea value={formData.notes} onChange={e => set({ notes: e.target.value })} placeholder="Payment terms, card types, condition, context" style={{ ...inp, height: '70px', resize: 'vertical' }} /></div>
        </>}

        {t === 'expenses' && <>
          <div><span style={lbl}>Category</span>
            <select value={formData.category} onChange={e => set({ category: e.target.value })} style={inp}>
              {EXPENSE_CATEGORIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><span style={lbl}>Description</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Pirateship postage" style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Paid By</span>
              <select value={formData.userName || 'Cam'} onChange={e => set({ userName: e.target.value })} style={inp}>
                <option value="Cam">Cam</option><option value="Kenny">Kenny</option>
              </select>
            </div>
            <div><span style={lbl}>Paid From</span>
              <select value={formData.expensePaidWith || 'Mana Social | WF Business Checking'} onChange={e => set({ expensePaidWith: e.target.value })} style={inp}>
                <optgroup label="Checking">
                  {CHECKING_ACCOUNTS.map((a: string) => <option key={a} value={a}>{a}</option>)}
                </optgroup>
                <optgroup label="Credit Cards">
                  {CREDIT_CARD_ACCOUNTS.map((a: string) => <option key={a} value={a}>{a}</option>)}
                </optgroup>
              </select>
            </div>
          </div>
          <div><span style={lbl}>Amount ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" style={inp} /></div>
        </>}

        {t === 'cogs_inventory' && <>
          <div><span style={lbl}>Inventory Type</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {['collection', 'box', 'precon', 'sealed', 'singles'].map(k => (
                <button key={k} onClick={() => set({ cogsType: k })} type="button" style={{ padding: '10px', background: formData.cogsType === k ? `linear-gradient(135deg,${C.teal},#1A7A75)` : 'transparent', color: formData.cogsType === k ? '#fff' : C.muted, border: `1px solid ${formData.cogsType === k ? C.teal : C.border}`, borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize' }}>{k}</button>
              ))}
            </div>
          </div>
          <div><span style={lbl}>Description</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Renly's collection" style={inp} /></div>
          <div><span style={lbl}>Set / Product</span><input value={formData.cogsSet || ''} onChange={e => set({ cogsSet: e.target.value })} placeholder="e.g. Final Fantasy Commander" style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Purchase Price ($)</span><input type="number" step="0.01" value={formData.cogsCost} onChange={e => set({ cogsCost: e.target.value })} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>Quantity</span><input type="number" value={formData.cogsQty} onChange={e => set({ cogsQty: e.target.value })} placeholder="1" style={inp} /></div>
          </div>
          {(formData.cogsType === 'collection' || formData.cogsType === 'singles') && (
            <div><span style={lbl}>Card Count (total)</span><input type="number" value={formData.cogsCards} onChange={e => set({ cogsCards: e.target.value })} placeholder="e.g. 5000" style={inp} /></div>
          )}
          {formData.cogsType === 'box' && (
            <div><span style={lbl}>Cards Per Box</span><input type="number" value={formData.cogsCardsPerBox} onChange={e => set({ cogsCardsPerBox: e.target.value })} placeholder="e.g. 360" style={inp} /></div>
          )}
          <div><span style={lbl}>Est. Total Sell Value ($, optional)</span><input type="number" step="0.01" value={formData.cogsEstValue} onChange={e => set({ cogsEstValue: e.target.value })} placeholder="0.00" style={inp} /></div>
          <div><span style={lbl}>Paid With</span>
            <select value={formData.cogsPaidWith || 'Mana Social | WF Business Checking'} onChange={e => set({ cogsPaidWith
