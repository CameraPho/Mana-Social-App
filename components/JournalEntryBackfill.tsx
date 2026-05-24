'use client'
import React, { useState, useEffect } from 'react'
import { FONT } from '@/lib/constants'
import {
  generateSaleJE, generateExpenseJE, generateEquityJE,
  generateMemberLoanJE, generateLoanPaymentJE,
  generateSalesTaxRemittanceJE, generateDisbursementJE,
  generateBillPaymentJE, insertJE, deleteJEsBySource
} from '@/lib/journalEntryEngine'

type SourceConfig = {
  key: string
  title: string
  description: string
  records: any[]
  generator: (record: any, accounts: any[]) => any
}

export default function JournalEntryBackfill(p: any) {
  const { C, supabase, sales, expenses, equityTransactions, memberLoans, memberLoanPayments,
    salesTaxRemittances, disbursements, billPayments, accountsPayable } = p

  const [accounts, setAccounts] = useState<any[]>([])
  const [journalEntries, setJournalEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { success: number; failed: number; errors: string[] }>>({})

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const primaryBtn: React.CSSProperties = { background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }
  const dangerBtn: React.CSSProperties = { background: 'none', color: '#ef4444', border: `1px solid #ef444440`, borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: FONT }

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [accResult, jeResult] = await Promise.all([
      supabase.from('chart_of_accounts').select('*').eq('is_active', true),
      supabase.from('journal_entries').select('*'),
    ])
    if (accResult.data) setAccounts(accResult.data)
    if (jeResult.data) setJournalEntries(jeResult.data)
    setLoading(false)
  }

  const sources: SourceConfig[] = [
    { key: 'sale', title: 'Sales', description: 'Revenue, sales tax, platform fees, and AR', records: sales || [], generator: (r, accs) => generateSaleJE(r, accs) },
    { key: 'expense', title: 'Expenses', description: 'Operating expenses paid via bank or credit card', records: expenses || [], generator: (r, accs) => generateExpenseJE(r, accs) },
    { key: 'equity_transaction', title: 'Equity Transactions', description: 'Owner contributions and distributions', records: equityTransactions || [], generator: (r, accs) => generateEquityJE(r, accs) },
    { key: 'disbursement', title: 'Disbursements (Owner Draws)', description: 'Owner draws paid out as disbursements', records: disbursements || [], generator: (r, accs) => generateDisbursementJE(r, accs) },
    { key: 'member_loan', title: 'Member Loans', description: 'Loans from members to the LLC', records: memberLoans || [], generator: (r, accs) => generateMemberLoanJE(r, accs) },
    { key: 'member_loan_payment', title: 'Loan Repayments', description: 'Principal and interest payments on member loans', records: memberLoanPayments || [], generator: (r, accs) => generateLoanPaymentJE(r, accs, memberLoans || []) },
    { key: 'sales_tax_remittance', title: 'Sales Tax Remittances', description: 'CDTFA tax payments', records: salesTaxRemittances || [], generator: (r, accs) => generateSalesTaxRemittanceJE(r, accs) },
    { key: 'bill_payment', title: 'Bill Payments', description: 'Payments on accounts payable bills', records: billPayments || [], generator: (r, accs) => generateBillPaymentJE(r, accs, accountsPayable || []) },
  ]

  const getStats = (key: string, records: any[]) => {
    const existingIds = new Set(journalEntries.filter(je => je.source_type === key).map(je => je.source_id))
    const total = records.length
    const covered = records.filter(r => existingIds.has(r.id)).length
    return { total, covered, missing: total - covered }
  }

  const generateMissing = async (source: SourceConfig) => {
    if (generating) return
    setGenerating(source.key)
    setResults(prev => ({ ...prev, [source.key]: { success: 0, failed: 0, errors: [] } }))

    const existingIds = new Set(journalEntries.filter(je => je.source_type === source.key).map(je => je.source_id))
    const toProcess = source.records.filter(r => !existingIds.has(r.id))

    if (toProcess.length === 0) { setGenerating(null); return }

    let success = 0, failed = 0
    const errors: string[] = []

    for (const record of toProcess) {
      try {
        const payload = source.generator(record, accounts)
        if (!payload) {
          failed++
          if (errors.length < 5) errors.push(`Record ${record.id?.slice(0, 8)}: invalid data or missing accounts`)
          continue
        }
        const result = await insertJE(payload, supabase)
        if (result.success) success++
        else { failed++; if (errors.length < 5) errors.push(`Record ${record.id?.slice(0, 8)}: ${result.error}`) }
      } catch (err: any) {
        failed++
        if (errors.length < 5) errors.push(`Record ${record.id?.slice(0, 8)}: ${err.message}`)
      }
    }

    setResults(prev => ({ ...prev, [source.key]: { success, failed, errors } }))
    setGenerating(null)
    await fetchData()
  }

  const regenerateAll = async (source: SourceConfig) => {
    if (generating) return
    if (!confirm(`Delete ALL ${source.title} journal entries and regenerate from source records?\n\nThis is destructive but only affects auto-generated entries for this source type.`)) return

    setGenerating(source.key)
    const delResult = await deleteJEsBySource(supabase, source.key)
    if (delResult.error) { alert('Delete error: ' + delResult.error); setGenerating(null); return }

    await fetchData()
    setTimeout(() => generateMissing(source), 200)
  }

  const generateAllMissing = async () => {
    if (generating) return
    if (!confirm('Generate missing journal entries for ALL source types?\n\nThis can take a while if there are many records.')) return

    for (const source of sources) {
      const stats = getStats(source.key, source.records)
      if (stats.missing > 0) await generateMissing(source)
    }
  }

  if (loading) return <div style={{ ...card, padding: '40px', textAlign: 'center', color: C.muted }}>Loading...</div>

  if (accounts.length === 0) return (
    <div style={{ ...card, padding: '20px', background: 'rgba(239,68,68,0.06)', border: `1px solid #ef444440` }}>
      <div style={{ color: '#ef4444', fontWeight: 'bold' }}>Chart of Accounts is empty</div>
      <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>Run the Stage 9.1 SQL migration first.</div>
    </div>
  )

  const totalMissing = sources.reduce((s, src) => s + getStats(src.key, src.records).missing, 0)

  return (
    <div>
      <div style={{ ...card, padding: '14px 16px', background: 'rgba(124,58,237,0.06)', border: `1px solid rgba(124,58,237,0.2)` }}>
        <div style={{ fontSize: '13px', color: '#7C3AED', fontWeight: 'bold', marginBottom: '4px' }}>Generate Journal Entries</div>
        <div style={{ fontSize: '11px', color: C.muted, marginBottom: '10px' }}>
          Backfill journal entries from existing source records. Each source generates the correct double-entry pattern. Idempotent — re-running only creates missing entries.
        </div>
        {totalMissing > 0 && (
          <button onClick={generateAllMissing} disabled={!!generating} style={primaryBtn}>
            {generating ? 'Generating...' : `Generate All Missing (${totalMissing} total)`}
          </button>
        )}
      </div>

      {sources.map(source => {
        const stats = getStats(source.key, source.records)
        const isGenerating = generating === source.key
        const result = results[source.key]
        const progress = stats.total > 0 ? (stats.covered / stats.total) * 100 : 0

        return (
          <div key={source.key} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{source.title}</div>
                <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{source.description}</div>
              </div>
              <span style={{ padding: '3px 8px', borderRadius: '6px', background: stats.missing === 0 && stats.total > 0 ? '#10B98120' : stats.total === 0 ? '#94A3B820' : '#FBBF2420', color: stats.missing === 0 && stats.total > 0 ? '#10B981' : stats.total === 0 ? '#94A3B8' : '#FBBF24', fontSize: '10px', fontWeight: 'bold' }}>
                {stats.total === 0 ? 'EMPTY' : stats.missing === 0 ? 'COMPLETE' : `${stats.missing} MISSING`}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '10px', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase' }}>Records</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{stats.total}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase' }}>JEs Created</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: C.teal }}>{stats.covered}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase' }}>Missing</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: stats.missing > 0 ? '#FBBF24' : C.muted }}>{stats.missing}</div>
              </div>
            </div>

            {stats.total > 0 && (
              <div style={{ width: '100%', height: '4px', background: C.inputBg, borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#10B981' : C.teal, transition: 'width 0.3s ease' }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {stats.missing > 0 && (
                <button onClick={() => generateMissing(source)} disabled={!!generating} style={isGenerating ? { ...primaryBtn, opacity: 0.5, cursor: 'wait' } : primaryBtn}>
                  {isGenerating ? 'Generating...' : `Generate ${stats.missing} Missing`}
                </button>
              )}
              {stats.covered > 0 && (
                <button onClick={() => regenerateAll(source)} disabled={!!generating} style={isGenerating ? { ...dangerBtn, opacity: 0.5, cursor: 'wait' } : dangerBtn}>
                  Regenerate All
                </button>
              )}
            </div>

            {result && (
              <div style={{ marginTop: '10px', padding: '10px', background: result.failed === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: result.failed === 0 ? '#10B981' : '#ef4444' }}>
                  {result.success} succeeded, {result.failed} failed
                </div>
                {result.errors.length > 0 && (
                  <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>
                    {result.errors.slice(0, 3).map((e, i) => <div key={i}>· {e}</div>)}
                    {result.errors.length > 3 && <div>+ {result.errors.length - 3} more...</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
