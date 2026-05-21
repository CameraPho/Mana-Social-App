'use client'
import React, { useState } from 'react'
import { FONT, EXPENSE_CATEGORIES, DEDUCTIBILITY } from '@/lib/constants'
import { fmt } from '@/lib/format'
import SalesTaxSection from '@/components/SalesTaxSection'

export default function MoneyOutTab(p: any) {
  const { C, expenses, payroll, accountsPayable, supplyCosts, sales, salesTaxRemittances, fetchData, startEdit, handleDelete, setEditingItem } = p
  const [view, setView] = useState<'expenses'|'payroll'>('expenses')
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({})

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const secHdr: React.CSSProperties = { fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', fontFamily: FONT, display: 'block' }
  const editBtn: React.CSSProperties = { background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: C.muted, cursor: 'pointer', fontFamily: FONT }
  const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '18px', fontFamily: FONT }

  const opExpenses = expenses.filter((e: any) => !e.asset_created).reduce((s: number, r: any) => s + Number(r.cost), 0)
  const totalAPOwed = accountsPayable.reduce((a: number, r: any) => a + Math.max(0, (Number(r.total_amount) || 0) - (Number(r.amount_paid) || 0)), 0)
  const staffing = payroll.reduce((s: number, r: any) => s + Number(r.amount), 0)

  const toggle = (k: string) => setExpandedTiles(prev => ({ ...prev, [k]: !prev[k] }))

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {(['expenses','payroll'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${view===v?C.teal:C.border}`, background: view===v?'rgba(45,191,184,0.1)':C.cardBg, fontSize: '14px', fontWeight: view===v?900:400, color: view===v?C.teal:C.muted, cursor: 'pointer', fontFamily: FONT, textTransform: 'capitalize' }}>{v}</button>
        ))}
      </div>

      {view === 'expenses' && <>
        <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL EXPENSES + A/P</div>
          <div style={{ fontSize: '30px', fontWeight: 900, color: '#fda4af' }}>{fmt(opExpenses + totalAPOwed)}</div>
        </div>

        <SalesTaxSection C={C} sales={sales} salesTaxRemittances={salesTaxRemittances} fetchData={fetchData} />

        <div style={{ ...card, border: `1px solid rgba(240,192,64,0.4)`, padding: 0, overflow: 'hidden' }}>
          <div onClick={() => toggle('ap')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: '15px', color: '#7A5A00' }}>Accounts Payable</div>
              <div style={{ fontSize: '12px', color: C.muted }}>{accountsPayable.length} transaction{accountsPayable.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontWeight: 900, fontSize: '17px', color: totalAPOwed > 0 ? C.pink : C.teal }}>{fmt(totalAPOwed)}</div>
              <button onClick={e => { e.stopPropagation(); setEditingItem({ table: 'accounts_payable' }) }} style={{ background: C.gold, color: '#7A5A00', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>+ Add</button>
              <span style={{ color: C.muted }}>{expandedTiles.ap ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedTiles.ap && (
            <div style={{ borderTop: `1px solid rgba(240,192,64,0.3)` }}>
              {accountsPayable.length === 0 ? <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '13px' }}>None recorded</div> :
                accountsPayable.map((b: any) => {
                  const paid = Number(b.amount_paid||0), owed = Number(b.total_amount) - paid
                  return (
                    <div key={b.id} style={{ padding: '14px 16px', borderBottom: `1px solid rgba(240,192,64,0.2)` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{b.vendor_name}</div>
                          {b.description && <div style={{ fontSize: '12px', color: C.muted }}>{b.description}</div>}
                          <div style={{ fontSize: '11px', color: C.muted }}>{b.invoice_date}{b.due_date && b.due_date !== b.invoice_date ? ` · Due ${b.due_date}` : ''}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: owed > 0 ? C.pink : C.teal }}>{fmt(owed)} {owed <= 0 ? '✓' : 'left'}</div>
                          <div style={{ fontSize: '11px', color: C.muted }}>of {fmt(Number(b.total_amount))}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <button onClick={() => startEdit('accounts_payable', b)} style={editBtn}>Update</button>
                        <button onClick={() => handleDelete('accounts_payable', b.id)} style={{ ...editBtn, color: C.pink }}>Delete</button>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {EXPENSE_CATEGORIES.filter((cat: string) => expenses.some((e: any) => e.category === cat)).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No expenses this period — tap + to add one</div>
        ) : EXPENSE_CATEGORIES.filter((cat: string) => expenses.some((e: any) => e.category === cat)).map((cat: string) => {
          const catExp = expenses.filter((e: any) => e.category === cat)
          const catTotal = catExp.reduce((a: number, e: any) => a + Number(e.cost), 0)
          const rule = DEDUCTIBILITY[cat]
          return (
            <div key={cat} style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div onClick={() => toggle(`e_${cat}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '15px', color: C.navy }}>{cat}</div>
                  <div style={{ fontSize: '12px', color: C.muted }}>{catExp.length} item{catExp.length !== 1 ? 's' : ''}{rule ? ` · ${rule.label}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 900, color: '#ef4444', fontSize: '18px' }}>{fmt(-catTotal)}</span>
                  <span style={{ color: C.muted }}>{expandedTiles[`e_${cat}`] ? '▲' : '▼'}</span>
                </div>
              </div>
              {expandedTiles[`e_${cat}`] && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {catExp.map((e: any) => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                      <div>
                        {e.notes && <div style={{ fontSize: '13px', fontWeight: 600 }}>{e.notes}</div>}
                        <div style={{ fontSize: '12px', color: C.muted }}>{e.purchase_date} · {e.user_name || 'Cam'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '15px' }}>{fmt(-Number(e.cost))}</span>
                        <button onClick={() => startEdit('expenses', e)} style={editBtn}>Edit</button>
                        <button onClick={() => handleDelete('expenses', e.id)} style={delBtn}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </>}

      {view === 'payroll' && <>
        <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL PAYROLL</div>
          <div style={{ fontSize: '30px', fontWeight: 900, color: '#fda4af' }}>{fmt(staffing)}</div>
          <div style={{ fontSize: '13px', opacity: 0.5, marginTop: '2px' }}>FICA: {fmt(staffing * 0.153)} · FUTA: {fmt(staffing * 0.006)}</div>
        </div>
        {Array.from(new Set(payroll.map((p: any) => p.employee_name))).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No payroll this period — tap + to add one</div>
        ) : Array.from(new Set(payroll.map((p: any) => p.employee_name))).map((emp: any) => {
          const empPay = payroll.filter((p: any) => p.employee_name === emp)
          const empTotal = empPay.reduce((a: number, p: any) => a + Number(p.amount), 0)
          return (
            <div key={emp} style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div onClick={() => toggle(`p_${emp}`)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '15px', color: C.navy }}>{emp}</div>
                  <div style={{ fontSize: '12px', color: C.muted }}>{empPay.length} payment{empPay.length !== 1 ? 's' : ''} · FICA {fmt(empTotal * 0.153)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: 900, fontSize: '18px' }}>{fmt(empTotal)}</span>
                  <span style={{ color: C.muted }}>{expandedTiles[`p_${emp}`] ? '▲' : '▼'}</span>
                </div>
              </div>
              {expandedTiles[`p_${emp}`] && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {empPay.map((pay: any) => (
                    <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{pay.pay_date}</div>
                        {pay.hours_worked > 0 && <div style={{ fontSize: '12px', color: C.muted }}>{pay.hours_worked} hrs @ ${pay.hourly_rate}/hr</div>}
                        {pay.roth_ira_contributed > 0 && <div style={{ fontSize: '12px', color: C.teal }}>Roth IRA: {fmt(pay.roth_ira_contributed)}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px' }}>{fmt(Number(pay.amount))}</span>
                        <button onClick={() => startEdit('payroll', pay)} style={editBtn}>Edit</button>
                        <button onClick={() => handleDelete('payroll', pay.id)} style={delBtn}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </>}
    </div>
  )
}
