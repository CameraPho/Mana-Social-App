'use client'
import React, { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT, EXPENSE_CATEGORIES, BANK_ACCOUNTS } from '@/lib/constants'
import { fmt, getEntity, today } from '@/lib/format'
import { parseChaseStatementPDF } from '@/parsers/chasePDF'
import { parseWellsFargoStatementPDF } from '@/parsers/wellsFargoStatementPDF'
import { findVendorMatch, buildLedgerPayloadFromMatch } from '@/lib/vendorMatch'

export default function BankTab(p: any) {
  const { C, reconTransactions, bankAccounts, fetchData, expenses, sales, vendorMappings } = p

  const [account, setAccount] = useState('All')
  const [showReconciled, setShowReconciled] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [uploadPreview, setUploadPreview] = useState<any[]>([])
  const [uploadStatus, setUploadStatus] = useState('')
  const [statementEndBal, setStatementEndBal] = useState('')
  const [focusedTxn, setFocusedTxn] = useState<any | null>(null)
  const [actionType, setActionType] = useState<'create'|'split'>('create')
  const [createCat, setCreateCat] = useState('Supplies & Packaging')
  const [createPlatform, setCreatePlatform] = useState('')
  const [createNotes, setCreateNotes] = useState('')
  const [saveAsRule, setSaveAsRule] = useState(false)
  const [bulkApplying, setBulkApplying] = useState(false)
  const [splitLines, setSplitLines] = useState<{ amount: string, category: string, notes: string }[]>([
    { amount: '', category: 'Supplies & Packaging', notes: '' }
  ])
  const [newTxn, setNewTxn] = useState({ account_name: 'Chase Business Checking', transaction_date: today(), description: '', amount: '', category: 'Other', is_business: true, notes: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const inp: React.CSSProperties = { padding: '13px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, fontSize: '15px', width: '100%', background: C.inputBg, boxSizing: 'border-box', fontFamily: FONT, color: C.text }
  const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT }
  const secHdr: React.CSSProperties = { fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', fontFamily: FONT, display: 'block' }
  const editBtn: React.CSSProperties = { background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: C.muted, cursor: 'pointer', fontFamily: FONT }

  const handlePdf = async (file: File) => {
    setUploadPreview([])
    if (file.type !== 'application/pdf') { setUploadStatus('Please upload a PDF'); return }
    setUploadStatus('Detecting bank...')
    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as any)
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs'
      const buf = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      const page = await pdf.getPage(1)
      const content = await page.getTextContent()
      const firstPageText = content.items.map((item: any) => item.str).join(' ')
      const isWellsFargo = /wells fargo/i.test(firstPageText)

      setUploadStatus(isWellsFargo ? 'Reading Wells Fargo statement...' : 'Reading Chase statement...')
      const { records, meta } = isWellsFargo
        ? await parseWellsFargoStatementPDF(file)
        : await parseChaseStatementPDF(file)

      if (records.length === 0) {
        setUploadStatus('No transactions found — check that this is a supported bank statement.')
        return
      }
      setUploadPreview(records.map((r: any) => ({ ...r, _selected: true })))
      setUploadStatus(`Found ${records.length} transactions from ${meta.year}. (${isWellsFargo ? 'Wells Fargo' : 'Chase'})`)
    } catch (err: any) { setUploadStatus('Parse error: ' + err.message) }
  }

  const confirmImport = async () => {
    const toImport = uploadPreview.filter(r => r._selected)
    if (toImport.length === 0) return alert('Nothing selected')
    setUploadStatus('Importing...')
    const { error } = await supabase.from('bank_statement_transactions').insert(
      toImport.map(r => ({ account_name: r.account_name, transaction_date: r.transaction_date, description: r.description, amount: r.amount, category: 'Other', is_business: true, is_reconciled: false, entity: getEntity(r.transaction_date), notes: '' }))
    )
    if (error) { setUploadStatus('Error: ' + error.message); return }
    setUploadPreview([]); setUploadStatus(`Imported ${toImport.length} ✓`); fetchData()
    setTimeout(() => setUploadStatus(''), 4000)
  }

  // Extracts a learnable keyword from a bank description (first 2 alphabetic tokens, lowercased).
  const extractKeyword = (desc: string): string => {
    const tokens = (desc || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length >= 3)
    return tokens.slice(0, 2).join(' ').trim()
  }

  // Upsert vendor learning row when user checks "Save vendor for next time"
  const learnVendor = async (txn: any, category: string, isSale: boolean) => {
    const keyword = extractKeyword(txn.description)
    if (!keyword) return
    const vendorName = keyword.toUpperCase()
    const targetTable = isSale ? 'sales' : 'expenses'
    const { data: existing } = await supabase.from('vendor_mappings').select('id, vendor_keywords, correction_count').eq('vendor_name', vendorName).maybeSingle()
    if (existing) {
      const kws = Array.from(new Set([...(existing.vendor_keywords || []), keyword]))
      await supabase.from('vendor_mappings').update({ vendor_keywords: kws, default_category: category, default_table: targetTable, correction_count: (existing.correction_count || 0) + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('vendor_mappings').insert({ vendor_name: vendorName, vendor_keywords: [keyword], default_category: category, default_table: targetTable, correction_count: 1, created_by: 'Cam' })
    }
  }

  // Build a real ledger entry from a bank transaction, then lock it.
  const executeAction = async (txn: any) => {
    try {
      const isOutflow = txn.amount < 0
      const absAmt = Math.abs(txn.amount)
      if (actionType === 'create') {
        if (isOutflow) {
          await supabase.from('expenses').insert({ category: createCat, cost: absAmt, purchase_date: txn.transaction_date, notes: createNotes || txn.description, entity: getEntity(txn.transaction_date), user_name: 'Cam', paid_by_company: true, bank_txn_id: txn.id })
          if (saveAsRule) await learnVendor(txn, createCat, false)
        } else {
          const platform = (createPlatform || 'other').toLowerCase()
          await supabase.from('sales').insert({ platform, amount: absAmt, fees: 0, shipping: 0, sale_date: txn.transaction_date, period_start: txn.transaction_date, period_end: txn.transaction_date, entity: getEntity(txn.transaction_date), net_sales: absAmt, num_orders: 1, bank_txn_id: txn.id })
          if (saveAsRule) await learnVendor(txn, platform, true)
        }
      } else {
        const total = splitLines.reduce((a, l) => a + (parseFloat(l.amount) || 0), 0)
        if (Math.abs(total - absAmt) > 0.01) { alert(`Split total ${fmt(total)} must equal ${fmt(absAmt)}`); return }
        await supabase.from('expenses').insert(splitLines.map(l => ({ category: l.category, cost: parseFloat(l.amount) || 0, purchase_date: txn.transaction_date, notes: l.notes || `Split from: ${txn.description}`, entity: getEntity(txn.transaction_date), user_name: 'Cam', paid_by_company: true, bank_txn_id: txn.id })))
      }
      await supabase.from('bank_statement_transactions').update({ is_reconciled: true }).eq('id', txn.id)
      setFocusedTxn(null)
      setSplitLines([{ amount: '', category: 'Supplies & Packaging', notes: '' }])
      setCreateNotes(''); setCreatePlatform(''); setSaveAsRule(false)
      fetchData()
    } catch (err: any) { alert('Mapping error: ' + err.message) }
  }

  // Bulk: process every unreconciled transaction that has a vendor match
  const bulkAutoApply = async () => {
    setBulkApplying(true)
    try {
      const unreconciled = reconTransactions.filter((t: any) => !t.is_reconciled && (account === 'All' || t.account_name === account))
      const matches = unreconciled.map((t: any) => ({ txn: t, match: findVendorMatch(t.description, Number(t.amount), vendorMappings || []) })).filter(x => x.match)
      if (matches.length === 0) { alert('No matched transactions to auto-import'); setBulkApplying(false); return }
      if (!confirm(`Auto-import ${matches.length} matched transaction${matches.length !== 1 ? 's' : ''}?`)) { setBulkApplying(false); return }
      for (const { txn, match } of matches) {
        const entity = getEntity(txn.transaction_date)
        const { targetTable, payload } = buildLedgerPayloadFromMatch(txn, match!, entity, 'Cam')
        await supabase.from(targetTable).insert(payload)
        await supabase.from('bank_statement_transactions').update({ is_reconciled: true }).eq('id', txn.id)
      }
      fetchData()
      alert(`Imported ${matches.length} transactions ✓`)
    } catch (err: any) { alert('Bulk apply error: ' + err.message) }
    setBulkApplying(false)
  }

  const filtered = reconTransactions.filter((t: any) => account === 'All' || t.account_name === account)
  const visible = filtered.filter((t: any) => showReconciled || !t.is_reconciled)
  const reconciledSum = filtered.filter((t: any) => t.is_reconciled).reduce((a: number, t: any) => a + Number(t.amount), 0)
  const baseBal = bankAccounts.find((b: any) => `${b.bank_name} ${b.account_type}` === account)?.current_balance || 0
  const liveCleared = Number(baseBal) + reconciledSum
  const variance = (parseFloat(statementEndBal) || 0) - liveCleared

  const unreconciledForAccount = reconTransactions.filter((t: any) => !t.is_reconciled && (account === 'All' || t.account_name === account))
  const matchCount = unreconciledForAccount.filter((t: any) => findVendorMatch(t.description, Number(t.amount), vendorMappings || [])).length

  return (
    <div>
      <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(45,191,184,0.1)', border: `1px solid rgba(45,191,184,0.25)`, marginBottom: '12px', fontSize: '12px', color: '#1A7A75', fontWeight: 'bold', fontFamily: FONT }}>
        🏦 Bank Reconciliation — upload Chase or Wells Fargo statements, then map each transaction to a real expense or sale.
      </div>

      <div style={{ ...card, background: C.navyDark, color: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div>
            <span style={lbl}>Statement End Balance</span>
            <input type="number" placeholder="0.00" value={statementEndBal} onChange={e => setStatementEndBal(e.target.value)} style={{ ...inp, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }} />
          </div>
          <div>
            <span style={lbl}>Live Cleared</span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: C.teal, paddingTop: '4px' }}>{fmt(liveCleared)}</div>
          </div>
          <div>
            <span style={lbl}>Variance</span>
            <div style={{ fontSize: '20px', fontWeight: 900, color: Math.abs(variance) < 0.01 ? C.green : '#fda4af', paddingTop: '4px' }}>
              {Math.abs(variance) < 0.01 ? '✓ Balanced' : fmt(variance)}
            </div>
          </div>
        </div>
        <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '8px' }}>Pick a single account below for variance to calculate.</div>
      </div>

      <div style={{ ...card, padding: '14px' }}>
        <span style={secHdr}>Upload Bank Statement</span>
        <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${C.teal}`, background: 'rgba(45,191,184,0.08)', fontSize: '14px', fontWeight: 'bold', color: C.teal, cursor: 'pointer', fontFamily: FONT }}>Import File</button>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePdf(f); e.target.value = '' }} />
        <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px' }}>Chase · Wells Fargo · more banks coming soon</div>
        {uploadStatus && <div style={{ marginTop: '8px', fontSize: '13px', color: C.teal }}>{uploadStatus}</div>}
      </div>

      {uploadPreview.length > 0 && (
        <div style={{ ...card, border: `1px solid ${C.teal}` }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.teal, marginBottom: '8px', textTransform: 'uppercase' }}>Import Preview — {uploadPreview.filter(r => r._selected).length} selected</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <button onClick={() => setUploadPreview(uploadPreview.map(r => ({ ...r, _selected: true })))} style={editBtn}>Select All</button>
            <button onClick={() => setUploadPreview(uploadPreview.map(r => ({ ...r, _selected: false })))} style={editBtn}>Deselect All</button>
          </div>
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {uploadPreview.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <input type="checkbox" checked={r._selected} onChange={e => { const u = [...uploadPreview]; u[i]._selected = e.target.checked; setUploadPreview(u) }} style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div>
                  <div style={{ fontSize: '11px', color: C.muted }}>{r.transaction_date}</div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: r.amount >= 0 ? C.green : '#ef4444', flexShrink: 0 }}>{fmt(r.amount)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={confirmImport} style={{ padding: '10px 18px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Import Selected</button>
            <button onClick={() => { setUploadPreview([]); setUploadStatus('') }} style={{ padding: '10px 14px', background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.muted, cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {['All', ...BANK_ACCOUNTS].map(acct => (
          <button key={acct} onClick={() => setAccount(acct)} style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${account === acct ? C.teal : C.border}`, background: account === acct ? 'rgba(45,191,184,0.12)' : C.inputBg, fontSize: '12px', fontWeight: account === acct ? 'bold' : 'normal', color: account === acct ? C.teal : C.muted, cursor: 'pointer', fontFamily: FONT }}>
            {acct === 'All' ? 'All' : acct}
          </button>
        ))}
      </div>

      {matchCount > 0 && (
        <div style={{ ...card, padding: '12px', border: `1px solid ${C.teal}`, background: 'rgba(45,191,184,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '13px', color: C.text }}>✨ <b>{matchCount}</b> unreconciled transaction{matchCount !== 1 ? 's match' : ' matches'} a learned vendor</div>
            <button onClick={bulkAutoApply} disabled={bulkApplying} style={{ padding: '8px 14px', background: bulkApplying ? C.muted : `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: bulkApplying ? 'wait' : 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }}>
              {bulkApplying ? 'Working...' : 'Auto-import all'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: C.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={showReconciled} onChange={e => setShowReconciled(e.target.checked)} style={{ width: '16px', height: '16px' }} />
          Show reconciled
        </label>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>
          {showAddForm ? 'Cancel' : '+ Add Transaction'}
        </button>
      </div>

      {showAddForm && (
        <div style={{ ...card, border: `1px solid ${C.teal}` }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div><span style={lbl}>Account</span>
              <select value={newTxn.account_name} onChange={e => setNewTxn({ ...newTxn, account_name: e.target.value })} style={inp}>
                {BANK_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Date</span><input type="date" value={newTxn.transaction_date} onChange={e => setNewTxn({ ...newTxn, transaction_date: e.target.value })} style={inp} /></div>
              <div><span style={lbl}>Amount ($)</span><input type="number" step="0.01" placeholder="- for debits" value={newTxn.amount} onChange={e => setNewTxn({ ...newTxn, amount: e.target.value })} style={inp} /></div>
            </div>
            <div><span style={lbl}>Description</span><input value={newTxn.description} onChange={e => setNewTxn({ ...newTxn, description: e.target.value })} placeholder="e.g. USPS Postage" style={inp} /></div>
            <button onClick={async () => {
              if (!newTxn.description || !newTxn.amount) return alert('Missing fields')
              const { error } = await supabase.from('bank_statement_transactions').insert([{ ...newTxn, amount: parseFloat(newTxn.amount), is_reconciled: false, entity: getEntity(newTxn.transaction_date) }])
              if (error) return alert(error.message)
              setShowAddForm(false)
              setNewTxn({ account_name: 'Chase Business Checking', transaction_date: today(), description: '', amount: '', category: 'Other', is_business: true, notes: '' })
              fetchData()
            }} style={{ padding: '12px', background: C.green, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', fontFamily: FONT }}>Save Transaction</button>
          </div>
        </div>
      )}

      <div style={{ fontSize: '13px', color: C.muted, marginBottom: '8px' }}>
        {filtered.length} transaction{filtered.length !== 1 ? 's' : ''} · {filtered.filter((t: any) => t.is_reconciled).length} reconciled
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No transactions — upload a statement or add one manually</div>
      ) : visible.map((txn: any) => {
        const isFocused = focusedTxn?.id === txn.id
        const match = !txn.is_reconciled ? findVendorMatch(txn.description, Number(txn.amount), vendorMappings || []) : null
        const matchedExpenses = txn.is_reconciled ? (expenses || []).filter((x: any) => x.bank_txn_id === txn.id) : []
        const matchedSales = txn.is_reconciled ? (sales || []).filter((x: any) => x.bank_txn_id === txn.id) : []
        const totalMatched = matchedExpenses.length + matchedSales.length
        return (
          <div key={txn.id} style={{ ...card, padding: '14px', border: isFocused ? `1px solid ${C.teal}` : `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{txn.description}</div>
                <div style={{ fontSize: '12px', color: C.muted }}>{txn.transaction_date} · {txn.account_name}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '15px', fontWeight: 900, color: txn.amount >= 0 ? C.green : '#ef4444' }}>{fmt(txn.amount)}</span>
                {txn.is_reconciled && <span style={{ color: C.green, fontSize: '12px' }}>✓</span>}
              </div>
            </div>

            {!txn.is_reconciled && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${C.border}` }}>
                {match && (
                  <div style={{ marginBottom: '10px', padding: '8px 10px', background: 'rgba(45,191,184,0.08)', border: `1px solid rgba(45,191,184,0.25)`, borderRadius: '6px', fontSize: '12px', color: C.teal, fontFamily: FONT }}>
                    ✨ Suggested: <b>{match.suggestedCategory}</b> {match.isSale ? '(sale)' : '(expense)'} — matched <b>&quot;{match.matchedKeyword}&quot;</b>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button onClick={() => setActionType('create')} style={{ ...editBtn, background: actionType === 'create' ? C.teal : 'transparent', color: actionType === 'create' ? '#fff' : C.text, border: `1px solid ${C.teal}` }}>Categorize</button>
                  <button onClick={() => setActionType('split')} style={{ ...editBtn, background: actionType === 'split' ? C.teal : 'transparent', color: actionType === 'split' ? '#fff' : C.text, border: `1px solid ${C.teal}` }}>Split</button>
                </div>

                {actionType === 'create' && (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {txn.amount < 0 ? (
                      <div><span style={lbl}>Expense Category</span>
                        <select value={match && !match.isSale && createCat === 'Supplies & Packaging' ? match.suggestedCategory : createCat} onChange={e => setCreateCat(e.target.value)} style={inp}>
                          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div><span style={lbl}>Sales Platform</span>
                        <input value={match && match.isSale && !createPlatform ? match.mapping.vendor_name : createPlatform} onChange={e => setCreatePlatform(e.target.value)} placeholder="e.g. TCGplayer, eBay" style={inp} />
                      </div>
                    )}
                    <div><span style={lbl}>Notes</span><input value={createNotes} onChange={e => setCreateNotes(e.target.value)} placeholder="Optional memo" style={inp} /></div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: C.muted, cursor: 'pointer' }}>
                      <input type="checkbox" checked={saveAsRule} onChange={e => setSaveAsRule(e.target.checked)} style={{ width: '14px', height: '14px' }} />
                      Save vendor for next time
                    </label>
                    <button onClick={() => executeAction(txn)} style={{ padding: '10px', background: C.green, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>Confirm &amp; Clear Line</button>
                  </div>
                )}

                {actionType === 'split' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {splitLines.map((line, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '6px' }}>
                        <input type="number" placeholder="Amt" value={line.amount} onChange={e => { const u = [...splitLines]; u[idx].amount = e.target.value; setSplitLines(u) }} style={{ ...inp, width: '80px' }} />
                        <select value={line.category} onChange={e => { const u = [...splitLines]; u[idx].category = e.target.value; setSplitLines(u) }} style={{ ...inp, flex: 1 }}>
                          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setSplitLines([...splitLines, { amount: '', category: 'Supplies & Packaging', notes: '' }])} style={{ ...editBtn, border: `1px solid ${C.teal}`, color: C.teal }}>+ Line</button>
                      <button onClick={() => executeAction(txn)} style={{ padding: '8px 16px', background: C.green, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>Post Split</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {txn.is_reconciled && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.08em' }}>
                  Matched to {totalMatched} ledger entr{totalMatched === 1 ? 'y' : 'ies'}
                </div>
                {totalMatched === 0 ? (
                  <div style={{ fontSize: '13px', color: '#ef4444', padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px' }}>
                    ⚠️ Marked reconciled but no ledger entry found. May have been deleted.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {matchedExpenses.map((x: any) => (
                      <div key={`e-${x.id}`} style={{ padding: '10px', background: C.inputBg, borderRadius: '8px', border: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: C.teal, textTransform: 'uppercase' }}>Expense · {x.category}</span>
                          <span style={{ fontSize: '14px', fontWeight: 900, color: '#ef4444' }}>{fmt(-Math.abs(Number(x.cost)))}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: C.muted }}>{x.purchase_date} · {x.notes || '(no notes)'}</div>
                      </div>
                    ))}
                    {matchedSales.map((x: any) => (
                      <div key={`s-${x.id}`} style={{ padding: '10px', background: C.inputBg, borderRadius: '8px', border: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: C.teal, textTransform: 'uppercase' }}>Sale · {x.platform}</span>
                          <span style={{ fontSize: '14px', fontWeight: 900, color: C.green }}>{fmt(Math.abs(Number(x.amount)))}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: C.muted }}>{x.sale_date}</div>
                      </div>
                    ))}
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
