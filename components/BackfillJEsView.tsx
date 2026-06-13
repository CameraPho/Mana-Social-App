'use client'
import React, { useState, useEffect } from 'react'
import { FONT } from '@/lib/constants'
import { stageJEForRecord } from '@/lib/journalEntryEngine'

export default function BackfillJEsView(p: any) {
  const { C, supabase, onBack } = p
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [unposted, setUnposted] = useState<any[]>([])
  const [progress, setProgress] = useState({ done: 0, success: 0, failed: 0, errors: [] as string[] })

  useEffect(() => { findUnposted() }, [])

  const findUnposted = async () => {
    setLoading(true)
    const { data: expenses } = await supabase.from('expenses').select('*')
    const { data: jes } = await supabase.from('journal_entries').select('source_id').eq('source_type', 'expense')
    const postedIds = new Set((jes || []).map((j: any) => j.source_id))
    const missing = (expenses || []).filter((e: any) => !postedIds.has(e.id))
    setUnposted(missing)
    setLoading(false)
  }

  const runBackfill = async () => {
    setRunning(true)
    let done = 0
    let success = 0
    let failed = 0
    const errors: string[] = []
    const bankTxnIds = unposted.map((e: any) => e.bank_txn_id).filter(Boolean)
    let bankTxnsMap: Record<string, string> = {}
    if (bankTxnIds.length > 0) {
      const { data: bankTxns } = await supabase
        .from('bank_statement_transactions')
        .select('id, account_name')
        .in('id', bankTxnIds)
      bankTxnsMap = Object.fromEntries((bankTxns || []).map((b: any) => [b.id, b.account_name]))
    }
    for (const exp of unposted) {
      try {
        let workingExp = exp
        if (!exp.payment_method && exp.bank_txn_id && bankTxnsMap[exp.bank_txn_id]) {
          const acctName = bankTxnsMap[exp.bank_txn_id]
          await supabase.from('expenses').update({ payment_method: acctName }).eq('id', exp.id)
          workingExp = { ...exp, payment_method: acctName }
        }
        const result = await stageJEForRecord('expense', workingExp, supabase)
        if (result.success) {
          success++
        } else {
          failed++
          errors.push(`${(exp.id || '').slice(0, 8)}: ${result.error || 'unknown'}`)
        }
      } catch (e: any) {
        failed++
        errors.push(`${(exp.id || '').slice(0, 8)}: ${e.message || 'exception'}`)
      }
      done++
      setProgress({ done, success, failed, errors: errors.slice(-5) })
    }
    setRunning(false)
    await findUnposted()
  }

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const btn: React.CSSProperties = { background: C.teal, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 700, cursor: running ? 'wait' : 'pointer', fontFamily: FONT }
  const backBtn: React.CSSProperties = { background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: FONT, marginBottom: '12px' }

  if (loading) return <div style={{ padding: 20, fontFamily: FONT, color: C.muted }}>Loading...</div>

  return (
    <div>
      <button onClick={onBack} style={backBtn}>← Reports</button>

      <div style={card}>
        <div style={{ fontSize: '20px', fontWeight: 900, color: C.text, marginBottom: '8px', fontFamily: FONT }}>Backfill Journal Entries</div>
        <div style={{ fontSize: '14px', color: C.muted, fontFamily: FONT }}>
          Generate journal entries for expenses that exist in the database but have no JE yet. Auto-populates payment_method from the linked bank transaction.
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: C.text, marginBottom: '12px', fontFamily: FONT }}>
          Expenses without JEs: <span style={{ color: C.teal }}>{unposted.length}</span>
        </div>

        {!running && unposted.length > 0 && (
          <button onClick={runBackfill} style={btn}>Run Backfill ({unposted.length})</button>
        )}

        {running && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '14px', color: C.text, marginBottom: '8px' }}>
              Processing: {progress.done} / {unposted.length}
            </div>
            <div style={{ height: '8px', background: C.inputBg, borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(progress.done / Math.max(unposted.length, 1)) * 100}%`, background: C.teal, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px' }}>
              ✓ Success: {progress.success} · ✗ Failed: {progress.failed}
            </div>
            {progress.errors.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#EF4444' }}>
                Recent errors:
                {progress.errors.map((e, i) => <div key={i}>· {e}</div>)}
              </div>
            )}
          </div>
        )}

        {!running && unposted.length === 0 && (
          <div style={{ fontSize: '14px', color: C.teal, fontFamily: FONT }}>✓ All expenses have JEs.</div>
        )}
      </div>

      {!running && progress.done > 0 && (
        <div style={card}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Last run summary</div>
          <div style={{ fontSize: '13px', color: C.muted }}>
            Processed {progress.done} · {progress.success} succeeded · {progress.failed} failed
          </div>
          {progress.errors.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#EF4444' }}>
              {progress.errors.map((e, i) => <div key={i}>· {e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
