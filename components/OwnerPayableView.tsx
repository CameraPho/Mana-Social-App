'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { FONT } from '@/lib/constants'
import { fmt } from '@/lib/format'

export default function OwnerPayableView(p: any) {
  const { C, supabase, onBack } = p
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<any[]>([])
  const [lines, setLines] = useState<any[]>([])

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const secHdr: React.CSSProperties = { fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px', fontFamily: FONT }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: acctData } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .order('account_number')
    const filtered = (acctData || []).filter((a: any) => {
      const n = a.account_number || ''
      return n.startsWith('2500') || n.startsWith('2600') || n.startsWith('2610') || n.startsWith('2620')
    })
    const acctIds = filtered.map((a: any) => a.id)
    let lineData: any[] = []
    if (acctIds.length > 0) {
      const { data } = await supabase
        .from('journal_entry_lines')
        .select('account_id, debit, credit')
        .in('account_id', acctIds)
      lineData = data || []
    }
    setAccounts(filtered)
    setLines(lineData)
    setLoading(false)
  }

  const balances = useMemo(() => {
    const map: Record<string, number> = {}
    for (const l of lines) {
      const credit = Number(l.credit) || 0
      const debit = Number(l.debit) || 0
      map[l.account_id] = (map[l.account_id] || 0) + credit - debit
    }
    return map
  }, [lines])

  const groupBy = (prefix: string) => accounts.filter(a => a.account_number.startsWith(prefix) && !a.is_header)
  const sumGroup = (accs: any[]) => accs.reduce((s, a) => s + (balances[a.id] || 0), 0)

  const cam2610 = groupBy('2610')
  const kenny2620 = groupBy('2620')
  const camLoan = groupBy('2500.01')
  const kennyLoan = groupBy('2500.02')

  const renderGroup = (title: string, accs: any[]) => {
    const total = sumGroup(accs)
    if (accs.length === 0) return null
    return (
      <div style={card}>
        <div style={secHdr}>{title}</div>
        <div style={{ fontSize: '24px', fontWeight: 900, color: total > 0 ? '#EF4444' : C.muted, marginBottom: '12px', fontFamily: FONT }}>
          {fmt(total)}
        </div>
        {accs.map(a => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', borderTop: `1px solid ${C.border}` }}>
            <span style={{ color: C.text }}>{a.account_number} · {a.account_name}</span>
            <span style={{ fontWeight: 700, color: C.text }}>{fmt(balances[a.id] || 0)}</span>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <div style={{ padding: 20, fontFamily: FONT, color: C.muted }}>Loading...</div>

  if (accounts.length === 0) {
    return (
      <div>
        <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: FONT, marginBottom: '12px' }}>← Reports</button>
        <div style={card}>No owner-payable accounts found. Verify 2500/2610/2620 exist in chart_of_accounts.</div>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: FONT, marginBottom: '12px' }}>← Reports</button>

      <div style={card}>
        <div style={{ fontSize: '14px', color: C.muted, fontFamily: FONT }}>
          What the LLC owes its members. Personal cards & sole-prop accounts roll up to Due-to-Cam (2610.x); formal loans sit in 2500.0x.
        </div>
      </div>

      {renderGroup('Due to Cam (2610)', cam2610)}
      {renderGroup('Due to Kenny (2620)', kenny2620)}
      {renderGroup('Cam Member Loan (2500.01)', camLoan)}
      {renderGroup('Kenny Member Loan (2500.02)', kennyLoan)}
    </div>
  )
}
