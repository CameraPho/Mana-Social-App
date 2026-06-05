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
  C: Palette
  vendors?: { id: string; name: string }[]
}

export default function RecordForm({ table: t, isEditing, formData, setFormData, onSave, onClose, C, vendors = [] }: Props) {
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
        <div style={{ padding: '7px 13px', background: 'rgba(45,191,184,0.08)', borderRadius: '7px', border: `1px solid ${C.teal}40`, fontSize: '12px', color: C.teal, fontWeight: 'bold' }}>{ent}</div>

        {t === 'sales' && <>
          <div><span style={lbl}>Platform</span>
            <select value={formData.platform} onChange={e => set({ platform: e.target.value })} style={inp}>
              <option value="tcgplayer">TCGplayer</option><option value="ebay">eBay</option><option value="manapool">ManaPool</option><option value="in_person">In-Person</option><option value="other">Other</option>
            </select>
          </div>
          <div><span style={lbl}>Item</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Black Lotus Beta" style={inp} /></div>
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
            <input list="vendor-list" value={formData.vendorName || ''} onChange={e => set({ vendorName: e.target.value })} placeholder="e.g. Oscar Espinosa" style={inp} />
            <datalist id="vendor-list">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
          </div>
          <div><span style={lbl}>Transaction Description</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Collection purchase — 5,000 MTG cards" style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Invoice Date</span><input type="date" value={formData.date} onChange={e => set({ date: e.target.value })} style={inp} /></div>
            <div><span style={lbl}>Due Date</span><input type="date" value={formData.dueDate || ''} onChange={e => set({ dueDate: e.target.value })} style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Total Amount ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>Amount Paid ($)</span><input type="number" step="0.01" value={formData.amountPaid || ''} onChange={e => set({ amountPaid: e.target.value })} placeholder="0.00" style={inp} /></div>
          </div>
          <div><span style={lbl}>Card Count (optional)</span><input type="number" value={formData.cardCount || ''} onChange={e => set({ cardCount: e.target.value })} placeholder="e.g. 5000" style={inp} /></div>
          <div><span style={lbl}>Notes</span><textarea value={formData.notes} onChange={e => set({ notes: e.target.value })} placeholder="Payment terms, card types, condition, context" style={{ ...inp, height: '70px', resize: 'vertical' }} /></div>
        </>}

        {t === 'expenses' && <>
          <div><span style={lbl}>Category</span>
            <select value={formData.category} onChange={e => set({ category: e.target.value })} style={inp}>
              {Object.keys(EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
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
            <select value={formData.cogsPaidWith || 'Mana Social | WF Business Checking'} onChange={e => set({ cogsPaidWith: e.target.value })} style={inp}>
              <optgroup label="Checking">
                {CHECKING_ACCOUNTS.map((a: string) => <option key={a} value={a}>{a}</option>)}
              </optgroup>
              <optgroup label="Credit Cards">
                {CREDIT_CARD_ACCOUNTS.map((a: string) => <option key={a} value={a}>{a}</option>)}
              </optgroup>
            </select>
          </div>
        </>}

        {t === 'payroll' && <>
          <div><span style={lbl}>Employee</span>
            <select value={formData.userName || 'Kiedan'} onChange={e => set({ userName: e.target.value })} style={inp}>
              <option value="Kiedan">Kiedan</option><option value="Kayliana">Kayliana</option><option value="Other">Other</option>
            </select>
          </div>
          <div><span style={lbl}>Pay Period</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. May 1–15 2026" style={inp} /></div>
          <div><span style={lbl}>Gross Pay ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" style={inp} /></div>
        </>}

        {t === 'mileage_log' && <>
          <div><span style={lbl}>Trip Purpose</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Post office run" style={inp} /></div>
          <div><span style={lbl}>Miles</span><input type="number" step="0.01" value={formData.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" style={inp} /></div>
          {Number(formData.amount) > 0 && (
            <div style={{ padding: '8px', background: 'rgba(45,191,184,0.08)', borderRadius: '7px', fontSize: '12px', color: C.teal }}>≈ {fmt(Number(formData.amount) * MILEAGE_RATE)} deduction (${MILEAGE_RATE}/mi)</div>
          )}
        </>}

        {t === 'assets' && <>
          <div><span style={lbl}>Category</span>
            <select value={formData.category} onChange={e => set({ category: e.target.value })} style={inp}>
              {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><span style={lbl}>Asset Description</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Epson DS-530 II scanner" style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Cost ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>Useful Life (yrs)</span><input type="number" value={formData.usefulLife || USEFUL_LIFE[formData.category as keyof typeof USEFUL_LIFE] || 5} onChange={e => set({ usefulLife: e.target.value })} style={inp} /></div>
          </div>
        </>}

        {t === 'supply_costs' && <>
          <div><span style={lbl}>Description</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. BCW penny sleeves x 1000" style={inp} /></div>
          <div><span style={lbl}>Cost ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" style={inp} /></div>
        </>}

        {t === 'disbursements' && <>
          <div><span style={lbl}>Recipient (Member)</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Cam or Kenny" style={inp} /></div>
          <div><span style={lbl}>Amount ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" style={inp} /></div>
          <div><span style={lbl}>Paid From</span>
            <select value={formData.disbursementPaidWith || 'Mana Social | WF Business Checking'} onChange={e => set({ disbursementPaidWith: e.target.value })} style={inp}>
              <optgroup label="Checking">
                {CHECKING_ACCOUNTS.map((a: string) => <option key={a} value={a}>{a}</option>)}
              </optgroup>
              <optgroup label="Credit Cards">
                {CREDIT_CARD_ACCOUNTS.map((a: string) => <option key={a} value={a}>{a}</option>)}
              </optgroup>
            </select>
          </div>
          <div><span style={lbl}>Notes</span><textarea value={formData.notes} onChange={e => set({ notes: e.target.value })} placeholder="Internal notes" style={{ ...inp, height: '70px', resize: 'vertical' }} /></div>
        </>}

        <button onClick={onSave} style={{ marginTop: '6px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', padding: '13px', borderRadius: '11px', fontWeight: 900, border: 'none', fontSize: '14px', cursor: 'pointer', fontFamily: FONT }}>
          {isEditing ? 'UPDATE RECORD' : 'SAVE RECORD'}
        </button>
      </div>
    </div>
  )
}
