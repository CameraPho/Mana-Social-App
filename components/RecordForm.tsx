'use client'
import React from 'react'
import { FONT, type Palette, EXPENSE_CATEGORIES, ASSET_CATEGORIES, USEFUL_LIFE, MILEAGE_RATE } from '@/lib/constants'
import { fmt, getEntity } from '@/lib/format'
import { PAYMENT_TERM_LABELS, calculateDueDate, type PaymentTerm } from '@/lib/paymentTerms'

interface Props {
  table: string
  isEditing: boolean
  formData: any
  setFormData: (d: any) => void
  onSave: () => void
  onClose: () => void
  C: Palette
  vendors?: any[]
}

export default function RecordForm({ table: t, isEditing, formData, setFormData, onSave, onClose, C, vendors = [] }: Props) {
  const inp: React.CSSProperties = { padding: '13px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, fontSize: '15px', width: '100%', background: C.inputBg, boxSizing: 'border-box', fontFamily: FONT, color: C.text }
  const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: C.muted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT }
  const set = (patch: any) => setFormData({ ...formData, ...patch })

  const cogsPreview = () => {
    const cost = parseFloat(formData.cogsCost) || 0, qty = parseInt(formData.cogsQty) || 1, total = cost * qty
    const units = formData.cogsType === 'collection' ? parseInt(formData.cogsCards) || 0 : ['booster_box','precon'].includes(formData.cogsType) ? (parseInt(formData.cogsCardsPerBox) || 0) * qty : qty
    return { total, units, cpu: units > 0 ? total / units : 0 }
  }

  // When vendor is picked, auto-fill terms + due date
  const onVendorPick = (vendorId: string) => {
    const v = vendors.find((vv: any) => vv.id === vendorId)
    if (!v) { set({ apVendorId: '' }); return }
    const terms = v.default_payment_terms || 'net_30'
    const dueDate = calculateDueDate(formData.date, terms as PaymentTerm)
    set({ apVendorId: vendorId, apVendor: v.vendor_name, apTerms: terms, apDue: dueDate })
  }

  const onTermsChange = (terms: string) => {
    const dueDate = calculateDueDate(formData.date, terms as PaymentTerm)
    set({ apTerms: terms, apDue: dueDate })
  }

  return (
    <div style={{ background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.teal}`, marginBottom: '12px', fontFamily: FONT }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontWeight: 900, color: C.navy, fontSize: '16px', fontFamily: FONT }}>{isEditing ? 'EDIT' : 'ADD'} {t.replace(/_/g,' ').toUpperCase()}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '24px', cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {t !== 'bank_accounts' && <div><span style={lbl}>Date</span><input type="date" value={formData.date} onChange={e => set({ date: e.target.value })} style={inp} /></div>}

        {!['mileage_log','cogs_inventory','assets','bank_accounts','accounts_payable','supply_costs'].includes(t) && (
          <div style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', fontFamily: FONT, background: getEntity(formData.date) === 'sole_prop' ? 'rgba(240,192,64,0.12)' : 'rgba(45,191,184,0.1)', color: getEntity(formData.date) === 'sole_prop' ? '#7A5A00' : '#1A7A75' }}>
            {getEntity(formData.date) === 'sole_prop' ? 'Camera Pho (Sole Prop)' : 'Mana Social LLC'}
          </div>
        )}

        {t === 'supply_costs' && <>
          <div><span style={lbl}>Supply Item Name</span><input value={formData.supplyItem} onChange={e => set({ supplyItem: e.target.value })} placeholder="e.g. Penny Sleeve, Forever Stamp" style={inp} /></div>
          <div><span style={lbl}>Unit Description</span><input value={formData.supplyUnit} onChange={e => set({ supplyUnit: e.target.value })} placeholder="e.g. per sleeve, per stamp" style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Total Cost ($)</span><input type="number" step="0.01" value={formData.supplyTotalCost || ''} onChange={e => { const tc = e.target.value; const qty = parseFloat(formData.supplyQty || '1') || 1; set({ supplyTotalCost: tc, supplyCost: tc ? (parseFloat(tc)/qty).toFixed(4) : '' }) }} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>Quantity</span><input type="number" step="1" value={formData.supplyQty || ''} onChange={e => { const qty = e.target.value; const tc = parseFloat(formData.supplyTotalCost || '0'); set({ supplyQty: qty, supplyCost: tc && qty ? (tc/parseFloat(qty)).toFixed(4) : '' }) }} placeholder="1" style={inp} /></div>
          </div>
          <div><span style={lbl}>Cost Per Unit ($)</span><input type="number" step="0.0001" value={formData.supplyCost} onChange={e => set({ supplyCost: e.target.value })} placeholder="0.0100" style={inp} /></div>
          <div><span style={lbl}>Vendor / Source</span><input value={formData.supplyVendor || ''} onChange={e => set({ supplyVendor: e.target.value })} placeholder="e.g. BCW, Amazon, Costco" style={inp} /></div>
          <div><span style={lbl}>Notes</span><input value={formData.notes} onChange={e => set({ notes: e.target.value })} placeholder="Order #, etc." style={inp} /></div>
        </>}

        {t === 'assets' && <>
          <div><span style={lbl}>Category</span>
            <select value={formData.assetCategory} onChange={e => set({ assetCategory: e.target.value, assetLife: String(USEFUL_LIFE[e.target.value] || 5) })} style={inp}>
              {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><span style={lbl}>Description</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Epson DS-530 II Scanner" style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Cost ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>Tax Paid ($)</span><input type="number" step="0.01" value={formData.fees} onChange={e => set({ fees: e.target.value })} placeholder="0.00" style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Useful Life (yrs)</span><input type="number" value={formData.assetLife} onChange={e => set({ assetLife: e.target.value })} style={inp} /></div>
            <div><span style={lbl}>Purchased By</span>
              <select value={formData.userName} onChange={e => set({ userName: e.target.value })} style={inp}>
                <option value="Cam">Cam</option><option value="Kenny">Kenny</option>
              </select>
            </div>
          </div>
          {formData.amount && (() => { const cost = parseFloat(formData.amount)||0, life = parseInt(formData.assetLife)||5; return (<div style={{ padding:'10px', borderRadius:'8px', background:'rgba(45,191,184,0.08)', fontSize:'13px', color:'#1A7A75', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}><span>Sec 179: <strong>{fmt(cost)}</strong></span><span>SL/yr: <strong>{fmt(cost/life)}</strong></span></div>) })()}
          <div><span style={lbl}>Notes / PO#</span><input value={formData.notes} onChange={e => set({ notes: e.target.value })} placeholder="Order number or notes" style={inp} /></div>
        </>}

        {t === 'bank_accounts' && <>
          <div><span style={lbl}>Bank</span>
            <select value={formData.bankName} onChange={e => set({ bankName: e.target.value })} style={inp}>
              <option value="Chase">Chase</option><option value="Wells Fargo">Wells Fargo</option>
            </select>
          </div>
          <div><span style={lbl}>Account Type</span>
            <select value={formData.accountType} onChange={e => set({ accountType: e.target.value })} style={inp}>
              <option value="Checking">Checking</option><option value="Savings">Savings</option><option value="Credit">Credit Card</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Last 4</span><input value={formData.accountLast4} onChange={e => set({ accountLast4: e.target.value })} placeholder="2035" style={inp} /></div>
            <div><span style={lbl}>As of Date</span><input type="date" value={formData.date} onChange={e => set({ date: e.target.value })} style={inp} /></div>
          </div>
          <div><span style={lbl}>Current Balance ($)</span><input type="number" step="0.01" value={formData.bankBalance} onChange={e => set({ bankBalance: e.target.value })} placeholder="0.00" style={inp} /></div>
          <div><span style={lbl}>Notes</span><input value={formData.notes} onChange={e => set({ notes: e.target.value })} placeholder="e.g. Chase Ink Business" style={inp} /></div>
        </>}

        {t === 'accounts_payable' && <>
          <div><span style={lbl}>Vendor</span>
            <input value={formData.apVendor} onChange={e => set({ apVendor: e.target.value })} placeholder="e.g. Brett, ACD Distribution, Oscar" style={inp} />
            {vendors.length > 0 && formData.apVendor && (
              (() => {
                const matched = vendors.find((v: any) => v.vendor_name.toLowerCase() === formData.apVendor.toLowerCase() && v.is_active !== false)
                if (matched && !formData.apTerms_userSet) {
                  return <div style={{ marginTop: '6px', padding: '6px 8px', background: 'rgba(45,191,184,0.06)', borderRadius: '6px', fontSize: '11px', color: C.teal }}>
                    💾 Saved vendor — default terms: {PAYMENT_TERM_LABELS[matched.default_payment_terms as PaymentTerm] || 'Net 30'}
                  </div>
                }
                return null
              })()
            )}
          </div>
          <div><span style={lbl}>Description</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Collection purchase — 5,000 MTG cards" style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Invoice Date</span><input type="date" value={formData.date} onChange={e => { set({ date: e.target.value, apDue: formData.apTerms === 'custom' ? formData.apDue : calculateDueDate(e.target.value, (formData.apTerms || 'net_30') as PaymentTerm) }) }} style={inp} /></div>
            <div><span style={lbl}>Payment Terms</span>
              <select value={formData.apTerms || 'net_30'} onChange={e => onTermsChange(e.target.value)} style={inp}>
                {Object.entries(PAYMENT_TERM_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>
          {!formData.paymentPlan && (
            <div><span style={lbl}>Due Date {formData.apTerms !== 'custom' ? '(auto-calculated, can override)' : '(set manually)'}</span>
              <input type="date" value={formData.apDue} onChange={e => set({ apDue: e.target.value })} style={inp} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Total Amount ($)</span><input type="number" step="0.01" value={formData.apTotal} onChange={e => set({ apTotal: e.target.value })} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>Amount Paid ($)</span><input type="number" step="0.01" value={formData.amountPaid} onChange={e => set({ amountPaid: e.target.value })} placeholder="0.00" style={inp} /></div>
          </div>
          
          {/* PAYMENT PLAN TOGGLE + CONFIG */}
          <div style={{ padding: '12px', background: formData.paymentPlan ? 'rgba(45,191,184,0.06)' : C.inputBg, borderRadius: '10px', border: `1px solid ${formData.paymentPlan ? C.teal : C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: formData.paymentPlan ? '10px' : 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>📅 Payment Plan</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!formData.paymentPlan} onChange={e => set({ paymentPlan: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <span style={{ fontSize: '12px', color: C.muted }}>{formData.paymentPlan ? 'Enabled' : 'One-time'}</span>
              </label>
            </div>
            {formData.paymentPlan && <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div><span style={lbl}>Frequency</span>
                  <select value={formData.planFrequency || 'monthly'} onChange={e => set({ planFrequency: e.target.value })} style={inp}>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 Weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div><span style={lbl}>Payment Amount ($)</span><input type="number" step="0.01" value={formData.planPaymentAmount || ''} onChange={e => set({ planPaymentAmount: e.target.value })} placeholder="100.00" style={inp} /></div>
              </div>
              <div><span style={lbl}>First Payment Date</span><input type="date" value={formData.planStartDate || formData.date} onChange={e => set({ planStartDate: e.target.value })} style={inp} /></div>
              {formData.apTotal && formData.planPaymentAmount && (() => {
                const total = parseFloat(formData.apTotal) || 0
                const perPayment = parseFloat(formData.planPaymentAmount) || 0
                if (perPayment === 0) return null
                const numPayments = Math.ceil(total / perPayment)
                const startDate = formData.planStartDate || formData.date
                const d = new Date(startDate + 'T00:00:00')
                const lastD = new Date(d)
                if (formData.planFrequency === 'weekly') lastD.setDate(d.getDate() + (numPayments - 1) * 7)
                else if (formData.planFrequency === 'biweekly') lastD.setDate(d.getDate() + (numPayments - 1) * 14)
                else lastD.setMonth(d.getMonth() + (numPayments - 1))
                const endDate = lastD.toISOString().slice(0, 10)
                return (
                  <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(45,191,184,0.1)', borderRadius: '6px', fontSize: '12px', color: '#1A7A75' }}>
                    <strong>{numPayments}</strong> payments of <strong>${perPayment.toFixed(2)}</strong> {formData.planFrequency === 'weekly' ? 'weekly' : formData.planFrequency === 'biweekly' ? 'every 2 weeks' : 'monthly'} — ends approximately <strong>{endDate}</strong>
                  </div>
                )
              })()}
            </>}
          </div>

          <div><span style={lbl}>Card Count (optional)</span>
            <input type="number" value={formData.apCardCount || ''} onChange={e => set({ apCardCount: e.target.value })} placeholder="e.g. 5000" style={inp} />
            {formData.apCardCount && formData.apTotal && (
              <div style={{ marginTop: '4px', fontSize: '13px', color: C.teal, fontWeight: 700 }}>Cost per card: ${(parseFloat(formData.apTotal) / parseInt(formData.apCardCount)).toFixed(4)}</div>
            )}
          </div>
          <div><span style={lbl}>Notes</span><textarea value={formData.notes} onChange={e => set({ notes: e.target.value })} placeholder="Payment terms, card types, condition, context" style={{ ...inp, height: '60px', resize: 'vertical' }} /></div>
        </>}

        {t === 'mileage_log' && <>
          <div><span style={lbl}>Business Purpose</span><input value={formData.milePurpose} onChange={e => set({ milePurpose: e.target.value })} placeholder="e.g. USPS drop-off" style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>From</span><input value={formData.mileFrom} onChange={e => set({ mileFrom: e.target.value })} placeholder="Home" style={inp} /></div>
            <div><span style={lbl}>To</span><input value={formData.mileTo} onChange={e => set({ mileTo: e.target.value })} placeholder="USPS Moreno Valley" style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Miles</span><input type="number" step="0.1" value={formData.miles} onChange={e => set({ miles: e.target.value })} placeholder="0.0" style={inp} /></div>
            <div><span style={lbl}>Logged By</span>
              <select value={formData.userName} onChange={e => set({ userName: e.target.value })} style={inp}>
                <option value="Cam">Cam</option><option value="Kenny">Kenny</option>
              </select>
            </div>
          </div>
          {formData.miles && <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(45,191,184,0.08)', fontSize: '14px', color: '#1A7A75' }}>Deduction: <strong>{fmt(parseFloat(formData.miles) * MILEAGE_RATE)}</strong></div>}
        </>}

        {t === 'cogs_inventory' && <>
          <div><span style={lbl}>Inventory Type</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {[['collection','Collection'],['booster_box','Box'],['precon','Precon'],['sealed','Sealed'],['singles','Singles']].map(([id,l]) => (
                <button key={id} onClick={() => set({ cogsType: id })} style={{ padding: '8px', borderRadius: '8px', border: `1px solid ${formData.cogsType===id?C.teal:C.border}`, background: formData.cogsType===id?'rgba(45,191,184,0.1)':C.inputBg, fontSize: '12px', fontWeight: formData.cogsType===id?'bold':'normal', cursor: 'pointer', color: formData.cogsType===id?'#1A7A75':C.text, fontFamily: FONT }}>{l}</button>
              ))}
            </div>
          </div>
          <div><span style={lbl}>Description</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Renly's collection" style={inp} /></div>
          <div><span style={lbl}>Set / Product</span><input value={formData.cogsSet} onChange={e => set({ cogsSet: e.target.value })} placeholder="e.g. Edge of Eternities" style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Purchase Price ($)</span><input type="number" step="0.01" value={formData.cogsCost} onChange={e => set({ cogsCost: e.target.value })} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>Quantity</span><input type="number" value={formData.cogsQty} onChange={e => set({ cogsQty: e.target.value })} placeholder="1" style={inp} /></div>
          </div>
          {formData.cogsType==='collection' && <div><span style={lbl}>Total Card Count</span><input type="number" value={formData.cogsCards} onChange={e => set({ cogsCards: e.target.value })} placeholder="e.g. 200" style={inp} /></div>}
          {['booster_box','precon'].includes(formData.cogsType) && (
            <div><span style={lbl}>Cards Per Unit</span>
              <select value={formData.cogsCardsPerBox} onChange={e => set({ cogsCardsPerBox: e.target.value })} style={inp}>
                <option value="">Select...</option>
                <option value="540">MTG Draft Box (540)</option><option value="360">MTG Set/Play Box (360)</option>
                <option value="150">MTG Collector Box (150)</option><option value="100">MTG Commander Precon (100)</option>
                <option value="60">Pokemon Starter (60)</option><option value="240">YGO Box (240)</option>
              </select>
            </div>
          )}
          <div><span style={lbl}>Est. Sell Value ($)</span><input type="number" step="0.01" value={formData.cogsEstValue} onChange={e => set({ cogsEstValue: e.target.value })} placeholder="0.00" style={inp} /></div>
          {formData.cogsCost && (() => { const p = cogsPreview(); return (<div style={{ padding:'10px', borderRadius:'8px', background:'rgba(45,191,184,0.08)', fontSize:'14px', color:'#1A7A75', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}><span>Total: <strong>{fmt(p.total)}</strong></span><span>Units: <strong>{p.units.toLocaleString()}</strong></span><span>Per unit: <strong>${p.cpu.toFixed(3)}</strong></span>{formData.cogsEstValue&&<span>Margin: <strong>{p.total>0?(((parseFloat(formData.cogsEstValue)-p.total)/p.total)*100).toFixed(1)+'%':'—'}</strong></span>}</div>) })()}
        </>}

        {!['mileage_log','cogs_inventory','assets','bank_accounts','accounts_payable','supply_costs'].includes(t) && <>
          {t==='expenses' ? <>
            <div><span style={lbl}>Category</span>
              <select value={formData.category} onChange={e => set({ category: e.target.value })} style={inp}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><span style={lbl}>Description</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="Vendor / item purchased" style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Paid By</span>
                <select value={formData.userName} onChange={e => set({ userName: e.target.value })} style={inp}>
                  <option value="Cam">Cam</option><option value="Kenny">Kenny</option>
                </select>
              </div>
              <div><span style={lbl}>Reimbursed by LLC</span>
                <select value={String(formData.paidByCompany)} onChange={e => set({ paidByCompany: e.target.value === 'true' })} style={inp}>
                  <option value="true">Yes — Company paid</option><option value="false">No — Personal funds</option>
                </select>
              </div>
            </div>
          </> : <div><span style={lbl}>{t==='sales'?'Platform':t==='payroll'?'Employee':'Recipient'}</span><input value={formData.label} onChange={e => set({ label: e.target.value })} placeholder="..." style={inp} /></div>}
          <div><span style={lbl}>Amount ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" style={inp} /></div>
          {t==='sales' && <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Fees ($)</span><input type="number" step="0.01" value={formData.fees} onChange={e => set({ fees: e.target.value })} placeholder="0.00" style={inp} /></div>
              <div><span style={lbl}>Shipping Cost ($)</span><input type="number" step="0.01" value={formData.shipping} onChange={e => set({ shipping: e.target.value })} placeholder="0.00" style={inp} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Sales Tax Applied</span>
                <select value={String(formData.isTaxable)} onChange={e => set({ isTaxable: e.target.value === 'true' })} style={inp}>
                  <option value="false">No — Tax exempt / online</option>
                  <option value="true">Yes — In-person CA sale</option>
                </select>
              </div>
              <div><span style={lbl}>Tax Rate (%)</span><input type="number" step="0.01" value={formData.taxRate} onChange={e => set({ taxRate: e.target.value })} placeholder="7.75" disabled={!formData.isTaxable} style={{ ...inp, opacity: formData.isTaxable ? 1 : 0.4 }} /></div>
            </div>
            {formData.isTaxable && formData.amount && (() => {
              const gross = parseFloat(formData.amount) || 0
              const rate = (parseFloat(formData.taxRate) || 0) / 100
              const net = rate > 0 ? gross / (1 + rate) : gross
              const tax = gross - net
              return (
                <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(45,191,184,0.08)', fontSize: '13px', color: '#1A7A75', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <span>Net: <strong>{fmt(net)}</strong></span>
                  <span>Tax: <strong>{fmt(tax)}</strong></span>
                  <span>Gross: <strong>{fmt(gross)}</strong></span>
                </div>
              )
            })()}
          </>}
          {t==='payroll' && <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Hours Worked</span><input type="number" step="0.5" value={formData.hoursWorked} onChange={e => set({ hoursWorked: e.target.value })} placeholder="10" style={inp} /></div>
              <div><span style={lbl}>Hourly Rate ($)</span><input type="number" step="0.01" value={formData.hourlyRate} onChange={e => set({ hourlyRate: e.target.value })} placeholder="16.00" style={inp} /></div>
            </div>
            <div><span style={lbl}>Pay Period End Date</span><input type="date" value={formData.payPeriod} onChange={e => set({ payPeriod: e.target.value })} style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Roth IRA Eligible ($)</span><input type="number" step="0.01" value={formData.rothEligible} onChange={e => set({ rothEligible: e.target.value })} placeholder="0.00" style={inp} /></div>
              <div><span style={lbl}>Roth IRA Contributed ($)</span><input type="number" step="0.01" value={formData.rothContributed} onChange={e => set({ rothContributed: e.target.value })} placeholder="0.00" style={inp} /></div>
            </div>
          </>}
          {t==='disbursements' && <div><span style={lbl}>Notes</span><textarea value={formData.notes} onChange={e => set({ notes: e.target.value })} placeholder="Internal notes" style={{ ...inp, height: '70px', resize: 'vertical' }} /></div>}
        </>}

        <button onClick={onSave} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', padding: '16px', borderRadius: '12px', fontWeight: 900, border: 'none', fontSize: '16px', cursor: 'pointer', marginTop: '4px', fontFamily: FONT }}>
          {isEditing ? 'UPDATE RECORD' : 'SAVE RECORD'}
        </button>
      </div>
    </div>
  )
}
