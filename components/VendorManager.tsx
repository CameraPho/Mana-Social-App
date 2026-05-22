'use client'
import React, { useState } from 'react'
import { FONT } from '@/lib/constants'
import { PAYMENT_TERM_LABELS, type PaymentTerm } from '@/lib/paymentTerms'

export default function VendorManager(p: any) {
  const { C, vendors, supabase, fetchData, onClose } = p
  const [editingVendor, setEditingVendor] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    vendor_name: '',
    default_payment_terms: 'net_30' as PaymentTerm,
    default_category: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    is_1099_eligible: false,
    w9_received: false,
    notes: '',
  })

  const inp: React.CSSProperties = { padding: '13px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, fontSize: '15px', width: '100%', background: C.inputBg, boxSizing: 'border-box', fontFamily: FONT, color: C.text }
  const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT }
  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }

  const startNew = () => {
    setEditingVendor(null)
    setFormData({
      vendor_name: '', default_payment_terms: 'net_30', default_category: '',
      contact_name: '', contact_email: '', contact_phone: '',
      is_1099_eligible: false, w9_received: false, notes: '',
    })
    setShowForm(true)
  }

  const startEdit = (v: any) => {
    setEditingVendor(v)
    setFormData({
      vendor_name: v.vendor_name,
      default_payment_terms: v.default_payment_terms || 'net_30',
      default_category: v.default_category || '',
      contact_name: v.contact_name || '',
      contact_email: v.contact_email || '',
      contact_phone: v.contact_phone || '',
      is_1099_eligible: !!v.is_1099_eligible,
      w9_received: !!v.w9_received,
      notes: v.notes || '',
    })
    setShowForm(true)
  }

  const save = async () => {
    if (!formData.vendor_name) return alert('Vendor name required')
    if (editingVendor?.id) {
      const { error } = await supabase.from('vendors').update(formData).eq('id', editingVendor.id)
      if (error) return alert(error.message)
    } else {
      const { error } = await supabase.from('vendors').insert([{ ...formData, entity: 'Mana Social LLC' }])
      if (error) return alert(error.message)
    }
    setShowForm(false)
    setEditingVendor(null)
    fetchData()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this vendor? Any bills will keep their vendor name but lose the link.')) return
    await supabase.from('vendors').update({ is_active: false }).eq('id', id)
    fetchData()
  }

  if (showForm) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontWeight: 900, fontSize: '16px', color: C.text }}>{editingVendor ? 'Edit Vendor' : 'New Vendor'}</h3>
          <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'grid', gap: '10px' }}>
          <div><span style={lbl}>Vendor Name *</span><input value={formData.vendor_name} onChange={e => setFormData({ ...formData, vendor_name: e.target.value })} placeholder="e.g. ACD Distribution" style={inp} /></div>
          <div><span style={lbl}>Default Payment Terms</span>
            <select value={formData.default_payment_terms} onChange={e => setFormData({ ...formData, default_payment_terms: e.target.value as PaymentTerm })} style={inp}>
              {Object.entries(PAYMENT_TERM_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div><span style={lbl}>Default Category</span><input value={formData.default_category} onChange={e => setFormData({ ...formData, default_category: e.target.value })} placeholder="e.g. Inventory" style={inp} /></div>
          <div><span style={lbl}>Contact Name</span><input value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })} placeholder="(optional)" style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Email</span><input type="email" value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })} placeholder="(optional)" style={inp} /></div>
            <div><span style={lbl}>Phone</span><input value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })} placeholder="(optional)" style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>1099 Eligible?</span>
              <select value={String(formData.is_1099_eligible)} onChange={e => setFormData({ ...formData, is_1099_eligible: e.target.value === 'true' })} style={inp}>
                <option value="false">No</option><option value="true">Yes</option>
              </select>
            </div>
            <div><span style={lbl}>W-9 Received?</span>
              <select value={String(formData.w9_received)} onChange={e => setFormData({ ...formData, w9_received: e.target.value === 'true' })} style={inp}>
                <option value="false">No</option><option value="true">Yes</option>
              </select>
            </div>
          </div>
          <div><span style={lbl}>Notes</span><textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Internal notes" style={{ ...inp, height: '60px', resize: 'vertical' }} /></div>
          <button onClick={save} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', padding: '14px', borderRadius: '10px', fontWeight: 900, border: 'none', fontSize: '15px', cursor: 'pointer', fontFamily: FONT }}>
            {editingVendor ? 'UPDATE VENDOR' : 'CREATE VENDOR'}
          </button>
        </div>
      </div>
    )
  }

  const activeVendors = (vendors || []).filter((v: any) => v.is_active !== false).sort((a: any, b: any) => a.vendor_name.localeCompare(b.vendor_name))

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontWeight: 900, fontSize: '16px', color: C.text }}>Vendors ({activeVendors.length})</h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={startNew} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>+ Vendor</button>
          {onClose && <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '6px 10px', fontSize: '12px', color: C.muted, cursor: 'pointer', fontFamily: FONT }}>Close</button>}
        </div>
      </div>
      {activeVendors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: '13px' }}>No vendors yet — tap "+ Vendor" to add one</div>
      ) : (
        activeVendors.map((v: any) => (
          <div key={v.id} style={{ padding: '12px', background: C.inputBg, borderRadius: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{v.vendor_name}</div>
              <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                {PAYMENT_TERM_LABELS[v.default_payment_terms as PaymentTerm] || 'Net 30'}
                {v.is_1099_eligible && ' · 1099'}
                {v.is_1099_eligible && !v.w9_received && ' · ⚠️ No W-9'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => startEdit(v)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '5px 10px', fontSize: '11px', color: C.muted, cursor: 'pointer', fontFamily: FONT }}>Edit</button>
              <button onClick={() => remove(v.id)} style={{ background: 'none', border: `1px solid ${C.pink}`, borderRadius: '6px', padding: '5px 10px', fontSize: '11px', color: C.pink, cursor: 'pointer', fontFamily: FONT }}>×</button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
