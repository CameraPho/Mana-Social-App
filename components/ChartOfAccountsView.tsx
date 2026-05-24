'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { FONT } from '@/lib/constants'

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense', 'other_income', 'other_expense']
const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  cogs: 'Cost of Goods Sold',
  expense: 'Expenses',
  other_income: 'Other Income',
  other_expense: 'Other Expense',
}
const TYPE_COLORS: Record<string, string> = {
  asset: '#10B981',
  liability: '#EF4444',
  equity: '#7C3AED',
  revenue: '#2DD4BF',
  cogs: '#FBBF24',
  expense: '#F97316',
  other_income: '#06B6D4',
  other_expense: '#94A3B8',
}

export default function ChartOfAccountsView(p: any) {
  const { C, supabase } = p
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, fontSize: '13px', background: C.inputBg, fontFamily: FONT, color: C.text, width: '100%', boxSizing: 'border-box' }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('is_active', true)
      .order('account_number')
    if (!error && data) setAccounts(data)
    setLoading(false)
  }

  // Group accounts: by type, then by parent (hierarchy)
  const grouped = useMemo(() => {
    const result: Record<string, any[]> = {}
    const filtered = search.trim() 
      ? accounts.filter(a => 
          a.account_number.includes(search) || 
          a.account_name.toLowerCase().includes(search.toLowerCase())
        )
      : accounts
    
    TYPE_ORDER.forEach(t => { result[t] = [] })
    filtered.forEach(a => {
      if (!result[a.account_type]) result[a.account_type] = []
      result[a.account_type].push(a)
    })
    return result
  }, [accounts, search])

  const toggleType = (type: string) => setExpanded(prev => ({ ...prev, [type]: !prev[type] }))

  if (loading) return (
    <div style={{ ...card, padding: '40px', textAlign: 'center', color: C.muted }}>Loading chart of accounts...</div>
  )

  const totalAccounts = accounts.length
  const headerCount = accounts.filter(a => a.is_header).length
  const postableCount = totalAccounts - headerCount

  return (
    <div>
      <div style={{ ...card, padding: '14px 16px', background: 'rgba(124,58,237,0.06)', border: `1px solid rgba(124,58,237,0.2)` }}>
        <div style={{ fontSize: '13px', color: '#7C3AED', fontWeight: 'bold', marginBottom: '4px' }}>Chart of Accounts</div>
        <div style={{ fontSize: '11px', color: C.muted }}>
          {totalAccounts} accounts ({postableCount} postable · {headerCount} headers). Headers are parent groupings — journal entries can't post to them.
        </div>
      </div>

      <input
        type="text"
        placeholder="🔍 Search by number or name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...inp, marginBottom: '12px' }}
      />

      {TYPE_ORDER.map(type => {
        const typeAccounts = grouped[type] || []
        if (typeAccounts.length === 0) return null
        
        const isExpanded = expanded[type] !== false // default expanded
        const color = TYPE_COLORS[type]
        
        return (
          <div key={type} style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div
              onClick={() => toggleType(type)}
              style={{
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: `${color}10`,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{TYPE_LABELS[type]}</div>
                <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{typeAccounts.length} accounts</div>
              </div>
              <span style={{ color: C.muted, fontSize: '14px' }}>{isExpanded ? '▲' : '▼'}</span>
            </div>

            {isExpanded && (
              <div style={{ padding: '0 16px 12px' }}>
                {typeAccounts.map(acc => (
                  <div
                    key={acc.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '8px 0',
                      borderBottom: `1px solid ${C.border}`,
                      paddingLeft: acc.parent_account_id ? '20px' : '0',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: C.muted, minWidth: '40px' }}>{acc.account_number}</span>
                        <span style={{ fontSize: '13px', fontWeight: acc.is_header ? 700 : 500, color: C.text }}>
                          {acc.account_name}
                        </span>
                        {acc.is_header && (
                          <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: `${color}20`, color, fontWeight: 'bold', textTransform: 'uppercase' }}>HEADER</span>
                        )}
                      </div>
                      {acc.description && (
                        <div style={{ fontSize: '11px', color: C.muted, marginLeft: '48px', marginTop: '1px' }}>{acc.description}</div>
                      )}
                    </div>
                    <span style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', marginLeft: '8px', flexShrink: 0 }}>
                      {acc.normal_balance === 'debit' ? 'DR' : 'CR'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
