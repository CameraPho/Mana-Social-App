'use client'
import React, { useState, useRef } from 'react'
import { FONT, EXPENSE_CATEGORIES, BANK_ACCOUNTS, CHECKING_ACCOUNTS, CREDIT_CARD_ACCOUNTS } from '@/lib/constants'
import { fmt, getEntity, today } from '@/lib/format'
import { parsePDF } from '@/parsers/universalPDF'
import { findVendorMatch, buildLedgerPayloadFromMatch } from '@/lib/vendorMatch'
import {
  ActionType, ACTION_LABELS, ACTION_HINTS, getValidActions, suggestActionType,
} from '@/lib/bankActions'

function buildOwnerContributionPayload(txn: any, memberName: string, entity: string, notes?: string) {
  return {
    targetTable: 'equity_transactions',
    payload: {
      member_name: memberName,
      amount: Math.abs(Number(txn.amount)),
      transaction_date: txn.transaction_date,
      type: 'contribution',
      notes: notes || `Owner Contribution via bank sync: ${txn.description}`,
      entity,
      bank_txn_id: txn.id,
    },
  }
}

function buildOwnerLoanPayload(txn: any, memberName: string, entity: string, rate?: number, notes?: string) {
  return {
    targetTable: 'member_loans',
    payload: {
      member_name: memberName,
      principal: Math.abs(Number(txn.amount)),
      outstanding_balance: Math.abs(Number(txn.amount)),
      loan_date: txn.transaction_date,
      interest_rate: rate || 0,
      notes: notes || `Member Loan from ${memberName}`,
      entity,
      is_active: true,
      bank_txn_id: txn.id,
    },
  }
}

function buildOwnerDrawPayload(txn: any, recipient: string, notes?: string) {
  return {
    targetTable: 'disbursements',
    payload: {
      recipient,
      amount: Math.abs(Number(txn.amount)),
      disbursement_date: txn.transaction_date,
      notes: notes || `Owner Draw: ${txn.description}`,
      bank_txn_id: txn.id,
    },
  }
}

function buildLoanRepaymentPayload(txn: any, loanId: string, principal: number, interest: number, notes?: string) {
  return {
    targetTable: 'member_loan_payments',
    payload: {
      loan_id: loanId,
      principal_paid: principal,
      interest_paid: interest,
      payment_date: txn.transaction_date,
      notes: notes || 'Loan repayment tracking',
      bank_txn_id: txn.id,
    },
  }
}

type FilterMode = 'unreconciled' | 'reconciled' | 'all'

const MEMBERS = ['Cam', 'Kenny']

export default function BankTab(p: any) {
  const { C, reconTransactions, bankAccounts, fetchData, expenses, sales, vendorMappings,
    collections, equityTransactions, memberLoans, memberLoanPayments,
    accountsPayable, supabase } = p

  const [account, setAccount] = useState('All')
  const [filterMode, setFilterMode] = useState<FilterMode>('unreconciled')
  const [searchText, setSearchText] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [uploadPreview, setUploadPreview] = useState<any[]>([])
  const [uploadStatus, setUploadStatus] = useState('')
  const [statementEndBal, setStatementEndBal] = useState('')
  const [importing, setImporting] = useState(false)

  const [stmtMeta, setStmtMeta] = useState({
    detectedAccount: '',
    startingBalance: '',
    endingBalance: '',
    periodStart: '',
    periodEnd: '',
    fileName: '',
    isCreditCard: false,
  })

  const [actionByTxn, setActionByTxn] = useState<Record<string, ActionType>>({})
  const [formByTxn, setFormByTxn] = useState<Record<string, any>>({})
  const [bulkApplying, setBulkApplying] = useState(false)
  const [splitLinesByTxn, setSplitLinesByTxn] = useState<Record<string, { amount: string, category: string, notes: string }[]>>({})

  const [newTxn, setNewTxn] = useState({
    account_name: 'Chase Business Checking',
    transaction_date: today(),
    description: '',
    amount: '',
    category: 'Other',
    is_business: true,
    notes: '',
  })
  const fileRef = useRef<HTMLInputElement>(null)

  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const inp: React.CSSProperties = { padding: '13px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, fontSize: '15px', width: '100%', background: C.inputBg, boxSizing: 'border-box', fontFamily: FONT, color: C.text }
  const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT }
  const secHdr: React.CSSProperties = { fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', fontFamily: FONT, display: 'block' }
  const editBtn: React.CSSProperties = { background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: C.muted, cursor: 'pointer', fontFamily: FONT }

  const getForm = (txnId: string) => formByTxn[txnId] || {}
  const setForm = (txnId: string, patch: any) =>
    setFormByTxn(prev => ({ ...prev, [txnId]: { ...(prev[txnId] || {}), ...patch } }))
  const getAction = (txn: any): ActionType => {
    if (actionByTxn[txn.id]) return actionByTxn[txn.id]
    return suggestActionType(txn.description, Number(txn.amount)).action
  }
  const setAction = (txnId: string, a: ActionType) =>
    setActionByTxn(prev => ({ ...prev, [txnId]: a }))
  const getSplitLines = (txnId: string) =>
    splitLinesByTxn[txnId] || [{ amount: '', category: 'Supplies & Packaging', notes: '' }]
  const setSplitLines = (txnId: string, lines: any[]) =>
    setSplitLinesByTxn(prev => ({ ...prev, [txnId]: lines }))

  const handlePdf = async (file: File) => {
    setUploadPreview([])
    setStmtMeta({ detectedAccount: '', startingBalance: '', endingBalance: '', periodStart: '', periodEnd: '', fileName: '', isCreditCard: false })

    if (file.type !== 'application/pdf') {
      setUploadStatus('Please upload a PDF')
      return
    }

    setUploadStatus('Parsing statement...')

    try {
      const result = await parsePDF(file, 'Chase Business Checking')
      const { records, meta } = result as any

      if (records.length === 0) {
        setUploadStatus(`No transactions found. Check the file format.`)
        return
      }

      setStmtMeta({
        detectedAccount: meta.detectedAccount || '',
        startingBalance: meta.startingBalance != null ? String(meta.startingBalance) : '',
        endingBalance: meta.endingBalance != null ? String(meta.endingBalance) : '',
        periodStart: meta.periodStart || '',
        periodEnd: meta.periodEnd || '',
        fileName: file.name,
        isCreditCard: !!meta.isCreditCard,
      })

      setUploadPreview(records.map((r: any) => ({ ...r, _selected: true })))
      setUploadStatus(`Found ${records.length} transactions. (${meta.detectedAccount || 'Unknown'})`)
    } catch (err: any) {
      setUploadStatus('Parse error: ' + err.message)
    }
  }

  const confirmImport = async () => {
    const selected = uploadPreview.filter(r => r._selected)
    if (selected.length === 0) return alert('No transactions selected')
    
    setImporting(true)
    try {
      const { data: stmt, error: stmtErr } = await supabase
        .from('bank_statements')
        .insert({
          account_name: stmtMeta.detectedAccount,
          statement_period_start: stmtMeta.periodStart || selected[selected.length - 1].transaction_date,
          statement_period_end: stmtMeta.periodEnd || selected[0].transaction_date,
          starting_balance: stmtMeta.startingBalance ? parseFloat(stmtMeta.startingBalance) : null,
          ending_balance: stmtMeta.endingBalance ? parseFloat(stmtMeta.endingBalance) : null,
          transaction_count: selected.length,
          source_file_name: stmtMeta.fileName,
          entity: 'Mana Social LLC',
        })
        .select()
        .single()
      
      if (stmtErr) throw stmtErr

      const txnRecords = selected.map((r: any) => ({
        account_name: r.account_name,
        transaction_date: r.transaction_date,
        description: r.description,
        amount: r.amount,
        is_reconciled: false,
        entity: getEntity(r.transaction_date),
        statement_id: stmt.id,
      }))
      
      const { error: txnErr } = await supabase
        .from('bank_statement_transactions')
        .insert(txnRecords)
      
      if (txnErr) throw txnErr

      setUploadPreview([])
      setUploadStatus('')
      setStmtMeta({ detectedAccount: '', startingBalance: '', endingBalance: '', periodStart: '', periodEnd: '', fileName: '', isCreditCard: false })
      fetchData()
      alert(`Imported ${selected.length} transactions ✓`)
    } catch (err: any) {
      alert('Import error: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  const learnVendor = async (txn: any, keyword: string, isSale: boolean) => {
    try {
      const vendorName = (txn.description || '').trim().slice(0, 200) || keyword || 'Unknown Vendor'
      const targetTable = isSale ? 'sales' : 'expenses'
      const defaultCategory = isSale ? undefined : keyword
      const defaultPlatform = isSale ? keyword : undefined

      const { data: existing } = await supabase
        .from('vendor_mappings')
        .select('id, vendor_keywords, correction_count')
        .eq('vendor_name', vendorName)
        .maybeSingle()

      if (existing) {
        const kws = Array.from(new Set([...(existing.vendor_keywords || []), keyword]))
        await supabase
          .from('vendor_mappings')
          .update({
            vendor_keywords: kws,
            default_category: defaultCategory || null,
            default_table: targetTable,
            default_platform: defaultPlatform || null,
            correction_count: (existing.correction_count || 0) + 1
          })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('vendor_mappings')
          .insert({
            vendor_name: vendorName,
            vendor_keywords: [keyword],
            default_category: defaultCategory || null,
            default_table: targetTable,
            default_platform: defaultPlatform || null,
            correction_count: 1,
            created_by: 'Cam'
          })
      }
    } catch (err) {
      console.warn('learnVendor error', err)
    }
  }

  const executeAction = async (txn: any) => {
    const action = getAction(txn)
    const f = getForm(txn.id)
    const absAmt = Math.abs(Number(txn.amount))
    const entity = getEntity(txn.transaction_date)

    try {
      if (action === 'categorize') {
        const isOutflow = txn.amount < 0
        if (isOutflow) {
          const category = f.category || 'Supplies & Packaging'
          await supabase.from('expenses').insert({ category, cost: absAmt, purchase_date: txn.transaction_date, notes: f.notes || txn.description, entity, user_name: 'Cam', paid_by_company: true, bank_txn_id: txn.id })
          if (f.saveAsRule) await learnVendor(txn, category, false)
        } else {
          const platform = (f.platform || 'other').toLowerCase()
          await supabase.from('sales').insert({ platform, amount: absAmt, fees: 0, shipping: 0, sale_date: txn.transaction_date, period_start: txn.transaction_date, period_end: txn.transaction_date, entity, net_sales: absAmt, num_orders: 1, bank_txn_id: txn.id })
          if (f.saveAsRule) await learnVendor(txn, platform, true)
        }
      } else if (action === 'split') {
        const lines = getSplitLines(txn.id)
        const total = lines.reduce((a, l) => a + (parseFloat(l.amount) || 0), 0)
        if (Math.abs(total - absAmt) > 0.01) { alert(`Split total ${fmt(total)} must equal ${fmt(absAmt)}`); return }
        await supabase.from('expenses').insert(lines.map(l => ({ category: l.category, cost: parseFloat(l.amount) || 0, purchase_date: txn.transaction_date, notes: l.notes || `Split from: ${txn.description}`, entity, user_name: 'Cam', paid_by_company: true, bank_txn_id: txn.id })))
      } else if (action === 'platform_payout' || action === 'card_payment' || action === 'transfer') {
        // reconcile-only
      } else if (action === 'owner_contribution') {
        const memberName = f.memberName || 'Cam'
        const built = buildOwnerContributionPayload(txn, memberName, entity, f.notes)
        if (built) await supabase.from(built.targetTable).insert(built.payload)
      } else if (action === 'owner_loan') {
        const memberName = f.memberName || 'Cam'
        const rate = f.interestRate ? parseFloat(f.interestRate) : undefined
        const built = buildOwnerLoanPayload(txn, memberName, entity, rate, f.notes)
        if (built) await supabase.from(built.targetTable).insert(built.payload)
      } else if (action === 'loan_repayment') {
        if (!f.loanId) { alert('Pick a loan to repay'); return }
        const principalPaid = parseFloat(f.principalPaid || '0') || 0
        const interestPaid = parseFloat(f.interestPaid || '0') || 0
        if (Math.abs(principalPaid + interestPaid - absAmt) > 0.01) {
          alert(`Principal (${fmt(principalPaid)}) + Interest (${fmt(interestPaid)}) must equal ${fmt(absAmt)}`); return
        }
        const built = buildLoanRepaymentPayload(txn, f.loanId, principalPaid, interestPaid, f.notes)
        if (built) await supabase.from(built.targetTable).insert(built.payload)
        const loan = (memberLoans || []).find((l: any) => l.id === f.loanId)
        if (loan) {
          const newBalance = Math.max(0, Number(loan.outstanding_balance) - principalPaid)
          await supabase.from('member_loans').update({ outstanding_balance: newBalance, is_active: newBalance > 0 }).eq('id', f.loanId)
        }
      } else if (action === 'owner_draw') {
        const recipient = f.memberName || 'Cam'
        const built = buildOwnerDrawPayload(txn, recipient, f.notes)
        if (built) await supabase.from(built.targetTable).insert(built.payload)
      } else if (action === 'ap_payment') {
        if (!f.apId) { alert('Pick an AP bill to apply this payment to'); return }
        const ap = (accountsPayable || []).find((a: any) => a.id === f.apId)
        if (!ap) { alert('AP bill not found'); return }
        const newPaid = Number(ap.amount_paid || 0) + absAmt
        await supabase.from('accounts_payable').update({ amount_paid: newPaid, payment_date: txn.transaction_date, bank_txn_id: txn.id }).eq('id', f.apId)
      } else if (action === 'collection_payment') {
        if (!f.collectionId) { alert('Pick a collection to apply this payment to'); return }
        const col = (collections || []).find((c: any) => c.id === f.collectionId)
        if (!col) { alert('Collection not found'); return }
        const newPaid = Number(col.amount_paid || 0) + absAmt
        await supabase.from('collections').update({ amount_paid: newPaid, bank_txn_id: txn.id }).eq('id', f.collectionId)
      }

      await supabase.from('bank_statement_transactions').update({ is_reconciled: true, action_type: action }).eq('id', txn.id)
      setFormByTxn(prev => { const next = { ...prev }; delete next[txn.id]; return next })
      setSplitLinesByTxn(prev => { const next = { ...prev }; delete next[txn.id]; return next })
      setActionByTxn(prev => { const next = { ...prev }; delete next[txn.id]; return next })
      fetchData()
    } catch (err: any) {
      alert(`Action error (${action}): ` + err.message)
    }
  }

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
        await supabase.from('bank_statement_transactions').update({ is_reconciled: true, action_type: 'categorize' }).eq('id', txn.id)
      }
      fetchData()
      alert(`Imported ${matches.length} transactions ✓`)
    } catch (err: any) { alert('Bulk apply error: ' + err.message) }
    setBulkApplying(false)
  }

  const deleteTxn = async (txn: any) => {
    if (txn.is_reconciled) { alert('Cannot delete a reconciled transaction. Unreconcile it first.'); return }
    if (!confirm(`Delete this transaction?\n\n${txn.description}\n${fmt(txn.amount)}`)) return
    const { error } = await supabase.from('bank_statement_transactions').delete().eq('id', txn.id)
    if (error) { alert('Delete failed: ' + error.message); return }
    fetchData()
  }

  const bulkUnreconcile = async (txns: any[]) => {
    if (txns.length === 0) return
    if (!confirm(`Unreconcile ${txns.length} transaction${txns.length === 1 ? '' : 's'}?\n\nThis will reverse ALL linked ledger entries (expenses, sales, disbursements, equity, loans, AP payments, collections) and mark all selected bank lines as unreconciled.\n\nThis cannot be undone.`)) return
    try {
      const txnIds = txns.map(t => t.id)
      const linkedE = (expenses || []).filter((x: any) => txnIds.includes(x.bank_txn_id))
      const linkedS = (sales || []).filter((x: any) => txnIds.includes(x.bank_txn_id))
      const linkedD = (p.disbursements || []).filter((x: any) => txnIds.includes(x.bank_txn_id))
      const linkedEq = (equityTransactions || []).filter((x: any) => txnIds.includes(x.bank_txn_id))
      const linkedLoans = (memberLoans || []).filter((x: any) => txnIds.includes(x.bank_txn_id))
      const linkedLoanPmts = (memberLoanPayments || []).filter((x: any) => txnIds.includes(x.bank_txn_id))
      const linkedAp = (accountsPayable || []).filter((x: any) => txnIds.includes(x.bank_txn_id))
      const linkedCol = (collections || []).filter((x: any) => txnIds.includes(x.bank_txn_id))

      if (linkedE.length > 0) await supabase.from('expenses').delete().in('id', linkedE.map((x: any) => x.id))
      if (linkedS.length > 0) await supabase.from('sales').delete().in('id', linkedS.map((x: any) => x.id))
      if (linkedD.length > 0) await supabase.from('disbursements').delete().in('id', linkedD.map((x: any) => x.id))
      if (linkedEq.length > 0) await supabase.from('equity_transactions').delete().in('id', linkedEq.map((x: any) => x.id))
      for (const pmt of linkedLoanPmts) {
        const loan = (memberLoans || []).find((l: any) => l.id === pmt.loan_id)
        if (loan) await supabase.from('member_loans').update({ outstanding_balance: Number(loan.outstanding_balance) + Number(pmt.principal_paid), is_active: true }).eq('id', loan.id)
      }
      if (linkedLoanPmts.length > 0) await supabase.from('member_loan_payments').delete().in('id', linkedLoanPmts.map((x: any) => x.id))
      if (linkedLoans.length > 0) await supabase.from('member_loans').delete().in('id', linkedLoans.map((x: any) => x.id))
      for (const ap of linkedAp) {
        const txn = txns.find(t => t.id === ap.bank_txn_id)
        if (!txn) continue
        const newPaid = Math.max(0, Number(ap.amount_paid || 0) - Math.abs(Number(txn.amount)))
        await supabase.from('accounts_payable').update({ amount_paid: newPaid, payment_date: null, bank_txn_id: null }).eq('id', ap.id)
      }
      for (const col of linkedCol) {
        const txn = txns.find(t => t.id === col.bank_txn_id)
        if (!txn) continue
        const newPaid = Math.max(0, Number(col.amount_paid || 0) - Math.abs(Number(txn.amount)))
        await supabase.from('collections').update({ amount_paid: newPaid, bank_txn_id: null }).eq('id', col.id)
      }
      await supabase.from('bank_statement_transactions').update({ is_reconciled: false, action_type: null }).in('id', txnIds)
      fetchData()
      alert(`Unreconciled ${txns.length} transaction${txns.length === 1 ? '' : 's'}.`)
    } catch (err: any) { alert('Bulk unreconcile error: ' + err.message) }
  }

  const bulkDelete = async (txns: any[]) => {
    if (txns.length === 0) return
    const hasReconciled = txns.some(t => t.is_reconciled)
    if (hasReconciled) {
      alert('Cannot delete reconciled transactions. Unreconcile them first.')
      return
    }
    if (!confirm(`Delete ${txns.length} unreconciled transaction${txns.length === 1 ? '' : 's'}?\n\nThis permanently removes the bank lines. This cannot be undone.`)) return
    const { error } = await supabase.from('bank_statement_transactions').delete().in('id', txns.map(t => t.id))
    if (error) { alert('Bulk delete failed: ' + error.message); return }
    fetchData()
    alert(`Deleted ${txns.length} transaction${txns.length === 1 ? '' : 's'}.`)
  }

  const unreconcileTxn = async (txn: any) => {
    const linkedE = (expenses || []).filter((x: any) => x.bank_txn_id === txn.id)
    const linkedS = (sales || []).filter((x: any) => x.bank_txn_id === txn.id)
    const linkedD = (p.disbursements || []).filter((x: any) => x.bank_txn_id === txn.id)
    const linkedEq = (equityTransactions || []).filter((x: any) => x.bank_txn_id === txn.id)
    const linkedLoans = (memberLoans || []).filter((x: any) => x.bank_txn_id === txn.id)
    const linkedLoanPmts = (memberLoanPayments || []).filter((x: any) => x.bank_txn_id === txn.id)
    const linkedAp = (accountsPayable || []).filter((x: any) => x.bank_txn_id === txn.id)
    const linkedCol = (collections || []).filter((x: any) => x.bank_txn_id === txn.id)
    const total = linkedE.length + linkedS.length + linkedD.length + linkedEq.length + linkedLoans.length + linkedLoanPmts.length + linkedAp.length + linkedCol.length
    if (!confirm(`Unreconcile this transaction?\n\nThis will reverse ${total} linked ledger entr${total === 1 ? 'y' : 'ies'} and mark the bank line as unreconciled.`)) return
    try {
      if (linkedE.length > 0) await supabase.from('expenses').delete().in('id', linkedE.map((x: any) => x.id))
      if (linkedS.length > 0) await supabase.from('sales').delete().in('id', linkedS.map((x: any) => x.id))
      if (linkedD.length > 0) await supabase.from('disbursements').delete().in('id', linkedD.map((x: any) => x.id))
      if (linkedEq.length > 0) await supabase.from('equity_transactions').delete().in('id', linkedEq.map((x: any) => x.id))
      for (const pmt of linkedLoanPmts) {
        const loan = (memberLoans || []).find((l: any) => l.id === pmt.loan_id)
        if (loan) await supabase.from('member_loans').update({ outstanding_balance: Number(loan.outstanding_balance) + Number(pmt.principal_paid), is_active: true }).eq('id', loan.id)
      }
      if (linkedLoanPmts.length > 0) await supabase.from('member_loan_payments').delete().in('id', linkedLoanPmts.map((x: any) => x.id))
      if (linkedLoans.length > 0) await supabase.from('member_loans').delete().in('id', linkedLoans.map((x: any) => x.id))
      for (const ap of linkedAp) {
        const newPaid = Math.max(0, Number(ap.amount_paid || 0) - Math.abs(Number(txn.amount)))
        await supabase.from('accounts_payable').update({ amount_paid: newPaid, payment_date: null, bank_txn_id: null }).eq('id', ap.id)
      }
      for (const col of linkedCol) {
        const newPaid = Math.max(0, Number(col.amount_paid || 0) - Math.abs(Number(txn.amount)))
        await supabase.from('collections').update({ amount_paid: newPaid, bank_txn_id: null }).eq('id', col.id)
      }
      await supabase.from('bank_statement_transactions').update({ is_reconciled: false, action_type: null }).eq('id', txn.id)
      fetchData()
    } catch (err: any) { alert('Unreconcile error: ' + err.message) }
  }

  const byAccount = reconTransactions.filter((t: any) => account === 'All' || t.account_name === account)
  const search = searchText.trim().toLowerCase()
  const matchesLinkedLedger = (txnId: string, q: string) => {
    const hit = (arr: any[] | undefined, fields: string[]) =>
      (arr || []).some((x: any) =>
        x.bank_txn_id === txnId &&
        fields.some(f => (x[f] != null ? String(x[f]) : '').toLowerCase().includes(q))
      )
    return (
      hit(expenses, ['notes', 'category', 'label']) ||
      hit(sales, ['notes', 'platform']) ||
      hit(p.disbursements, ['notes', 'recipient']) ||
      hit(equityTransactions, ['notes', 'member_name', 'type']) ||
      hit(memberLoans, ['notes', 'member_name']) ||
      hit(memberLoanPayments, ['notes']) ||
      hit(accountsPayable, ['notes', 'vendor_name', 'description']) ||
      hit(collections, ['notes', 'seller_name'])
    )
  }
  const bySearch = !search ? byAccount : byAccount.filter((t: any) => {
    return (t.description || '').toLowerCase().includes(search)
      || (t.account_name || '').toLowerCase().includes(search)
      || String(t.amount).includes(search)
      || matchesLinkedLedger(t.id, search)
  })
  const visible = bySearch.filter((t: any) => {
    if (filterMode === 'unreconciled') return !t.is_reconciled
    if (filterMode === 'reconciled') return t.is_reconciled
    return true
  })

  const unreconciledCount = bySearch.filter((t: any) => !t.is_reconciled).length
  const reconciledCount = bySearch.filter((t: any) => t.is_reconciled).length
  const allCount = bySearch.length

  const reconciledSum = byAccount.filter((t: any) => t.is_reconciled).reduce((a: number, t: any) => a + Number(t.amount), 0)
  const baseBal = bankAccounts.find((b: any) => `${b.bank_name} ${b.account_type}` === account)?.current_balance || 0
  const liveCleared = Number(baseBal) + reconciledSum
  const variance = (parseFloat(statementEndBal) || 0) - liveCleared

  const matchCount = byAccount.filter((t: any) => !t.is_reconciled && findVendorMatch(t.description, Number(t.amount), vendorMappings || [])).length

  const previewSum = uploadPreview.filter(r => r._selected).reduce((sum: number, r: any) => sum + Number(r.amount), 0)
  const previewStart = parseFloat(stmtMeta.startingBalance) || 0
  const previewEnd = parseFloat(stmtMeta.endingBalance) || 0
  const expectedDelta = stmtMeta.isCreditCard 
    ? previewStart - previewEnd 
    : previewEnd - previewStart
  const previewVariance = Math.abs(previewSum - expectedDelta)
  const hasBalances = !!(stmtMeta.startingBalance && stmtMeta.endingBalance)

  const tabBtn = (mode: FilterMode): React.CSSProperties => ({
    flex: 1, padding: '8px 10px', borderRadius: '8px', border: `1px solid ${filterMode === mode ? C.teal : C.border}`,
    background: filterMode === mode ? 'rgba(45,191,184,0.12)' : C.inputBg,
    color: filterMode === mode ? C.teal : C.muted,
    fontSize: '12px', fontWeight: filterMode === mode ? 'bold' : 'normal',
    cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap'
  })

  const renderActionForm = (txn: any, action: ActionType) => {
    const f = getForm(txn.id)
    const isOutflow = txn.amount < 0
    const absAmt = Math.abs(Number(txn.amount))

    if (action === 'categorize') {
      const match = findVendorMatch(txn.description, Number(txn.amount), vendorMappings || [])
      const currentCategory = f.category ?? (match && !match.isSale ? match.suggestedCategory : 'Supplies & Packaging')
      const currentPlatform = f.platform ?? (match && match.isSale ? match.mapping.vendor_name : '')
      return (
        <div style={{ display: 'grid', gap: '10px' }}>
          {isOutflow ? (
            <div><span style={lbl}>Expense Category</span>
              <select value={currentCategory} onChange={e => setForm(txn.id, { category: e.target.value })} style={inp}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ) : (
            <div><span style={lbl}>Sales Platform</span>
              <input value={currentPlatform} onChange={e => setForm(txn.id, { platform: e.target.value })} placeholder="e.g. TCGplayer, eBay" style={inp} />
            </div>
          )}
          <div><span style={lbl}>Notes</span><input value={f.notes || ''} onChange={e => setForm(txn.id, { notes: e.target.value })} placeholder="Optional memo" style={inp} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: C.muted, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!f.saveAsRule} onChange={e => setForm(txn.id, { saveAsRule: e.target.checked })} style={{ width: '14px', height: '14px' }} />
            Save vendor for next time
          </label>
        </div>
      )
    }

    if (action === 'split') {
      const lines = getSplitLines(txn.id)
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {lines.map((line, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px' }}>
              <input type="number" placeholder="Amt" value={line.amount} onChange={e => { const u = [...lines]; u[idx].amount = e.target.value; setSplitLines(txn.id, u) }} style={{ ...inp, width: '80px' }} />
              <select value={line.category} onChange={e => { const u = [...lines]; u[idx].category = e.target.value; setSplitLines(txn.id, u) }} style={{ ...inp, flex: 1 }}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ))}
          <button onClick={() => setSplitLines(txn.id, [...lines, { amount: '', category: 'Supplies & Packaging', notes: '' }])} style={{ ...editBtn, border: `1px solid ${C.teal}`, color: C.teal, alignSelf: 'flex-start' }}>+ Line</button>
        </div>
      )
    }

    if (action === 'platform_payout') return <div style={{ padding: '10px', background: C.inputBg, borderRadius: '6px', fontSize: '13px', color: C.muted }}>ℹ️ This will mark the deposit as reconciled. The actual sale revenue should already be in your books from the CSV import for this platform&apos;s sales period.</div>
    if (action === 'card_payment') return <div style={{ padding: '10px', background: C.inputBg, borderRadius: '6px', fontSize: '13px', color: C.muted }}>ℹ️ This is a transfer from bank to credit card. It reduces your card liability — not an expense.</div>
    if (action === 'transfer') return <div style={{ padding: '10px', background: C.inputBg, borderRadius: '6px', fontSize: '13px', color: C.muted }}>ℹ️ Moving money between your own accounts. No ledger entry will be created.</div>

    if (action === 'owner_contribution') {
      return (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div><span style={lbl}>Member</span>
            <select value={f.memberName || 'Cam'} onChange={e => setForm(txn.id, { memberName: e.target.value })} style={inp}>
              {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><span style={lbl}>Notes</span><input value={f.notes || ''} onChange={e => setForm(txn.id, { notes: e.target.value })} placeholder="e.g. Business funding" style={inp} /></div>
        </div>
      )
    }

    if (action === 'owner_loan') {
      return (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div><span style={lbl}>Lender</span>
            <select value={f.memberName || 'Cam'} onChange={e => setForm(txn.id, { memberName: e.target.value })} style={inp}>
              {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><span style={lbl}>Interest Rate (annual %, optional)</span>
            <input type="number" step="0.01" value={f.interestRate || ''} onChange={e => setForm(txn.id, { interestRate: e.target.value })} placeholder="e.g. 5.5" style={inp} />
          </div>
          <div><span style={lbl}>Notes</span><input value={f.notes || ''} onChange={e => setForm(txn.id, { notes: e.target.value })} placeholder="Loan terms / purpose" style={inp} /></div>
        </div>
      )
    }

    if (action === 'loan_repayment') {
      const activeLoans = (memberLoans || []).filter((l: any) => l.is_active)
      return (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div><span style={lbl}>Loan</span>
            <select value={f.loanId || ''} onChange={e => setForm(txn.id, { loanId: e.target.value })} style={inp}>
              <option value="">— Pick an active loan —</option>
              {activeLoans.map((l: any) => (
                <option key={l.id} value={l.id}>{l.member_name} · {l.loan_date} · {fmt(l.outstanding_balance)} owed</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span style={lbl}>Principal Paid</span><input type="number" step="0.01" value={f.principalPaid || ''} onChange={e => setForm(txn.id, { principalPaid: e.target.value })} style={inp} /></div>
            <div><span style={lbl}>Interest Paid</span><input type="number" step="0.01" value={f.interestPaid || '0'} onChange={e => setForm(txn.id, { interestPaid: e.target.value })} style={inp} /></div>
          </div>
          <div style={{ fontSize: '12px', color: C.muted }}>Total payment: <b>{fmt(absAmt)}</b>. Principal + Interest must equal this amount.</div>
          <div><span style={lbl}>Notes</span><input value={f.notes || ''} onChange={e => setForm(txn.id, { notes: e.target.value })} style={inp} /></div>
        </div>
      )
    }

    if (action === 'owner_draw') {
      return (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div><span style={lbl}>Recipient</span>
            <select value={f.memberName || 'Cam'} onChange={e => setForm(txn.id, { memberName: e.target.value })} style={inp}>
              {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><span style={lbl}>Notes</span><input value={f.notes || ''} onChange={e => setForm(txn.id, { notes: e.target.value })} placeholder="Optional memo" style={inp} /></div>
        </div>
      )
    }

    if (action === 'ap_payment') {
      const openAp = (accountsPayable || []).filter((a: any) => Number(a.amount_paid || 0) < Number(a.total_amount))
      return (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div><span style={lbl}>AP Bill to Apply Payment To</span>
            <select value={f.apId || ''} onChange={e => setForm(txn.id, { apId: e.target.value })} style={inp}>
              <option value="">— Pick an open bill —</option>
              {openAp.map((a: any) => {
                const owed = Number(a.total_amount) - Number(a.amount_paid || 0)
                return <option key={a.id} value={a.id}>{a.vendor_name} · {a.invoice_date} · {fmt(owed)} owed</option>
              })}
            </select>
          </div>
          {openAp.length === 0 && <div style={{ fontSize: '12px', color: C.muted, padding: '8px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: '6px' }}>No open AP bills found.</div>}
        </div>
      )
    }

    if (action === 'collection_payment') {
      const openCol = (collections || []).filter((c: any) => Number(c.amount_paid || 0) < Number(c.total_cost))
      return (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div><span style={lbl}>Collection (Buyout) to Apply Payment To</span>
            <select value={f.collectionId || ''} onChange={e => setForm(txn.id, { collectionId: e.target.value })} style={inp}>
              <option value="">— Pick an open collection —</option>
              {openCol.map((c: any) => {
                const owed = Number(c.total_cost) - Number(c.amount_paid || 0)
                return <option key={c.id} value={c.id}>{c.seller_name} · due {c.due_date} · {fmt(owed)} owed</option>
              })}
            </select>
          </div>
          {openCol.length === 0 && <div style={{ fontSize: '12px', color: C.muted, padding: '8px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: '6px' }}>No open collections found.</div>}
        </div>
      )
    }

    return null
  }

  return (
    <div>
      <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(45,191,184,0.1)', border: `1px solid rgba(45,191,184,0.25)`, marginBottom: '12px', fontSize: '12px', color: '#1A7A75', fontWeight: 'bold', fontFamily: FONT }}>
        🏦 Bank Statement Import — upload statements, capture balances, then reconcile in the Reports tab.
      </div>

      <div style={{ ...card, padding: '14px' }}>
        <span style={secHdr}>Upload Bank Statement</span>
        <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${C.teal}`, background: 'rgba(45,191,184,0.08)', fontSize: '14px', fontWeight: 'bold', color: C.teal, cursor: 'pointer', fontFamily: FONT }}>Import File</button>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePdf(f); e.target.value = '' }} />
        <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px' }}>Auto-detects: Chase · Wells Fargo · Costco Citi · Citi Diamond · Amazon Chase · Chase Sapphire · Barclays</div>
        {uploadStatus && <div style={{ marginTop: '8px', fontSize: '13px', color: C.teal }}>{uploadStatus}</div>}
      </div>

      {uploadPreview.length > 0 && (
        <div style={{ ...card, border: `1px solid ${C.teal}` }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.teal, marginBottom: '8px', textTransform: 'uppercase' }}>Import Preview — {uploadPreview.filter(r => r._selected).length} selected</div>
          
          <div style={{ background: C.inputBg, padding: '12px', borderRadius: '10px', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginBottom: '8px' }}>Statement Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <span style={lbl}>Account</span>
                <input value={stmtMeta.detectedAccount} onChange={e => setStmtMeta({ ...stmtMeta, detectedAccount: e.target.value })} placeholder="Account name" style={inp} />
              </div>
              <div>
                <span style={lbl}>Period</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input type="date" value={stmtMeta.periodStart} onChange={e => setStmtMeta({ ...stmtMeta, periodStart: e.target.value })} style={{ ...inp, fontSize: '12px' }} />
                  <input type="date" value={stmtMeta.periodEnd} onChange={e => setStmtMeta({ ...stmtMeta, periodEnd: e.target.value })} style={{ ...inp, fontSize: '12px' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <span style={lbl}>{stmtMeta.isCreditCard ? 'Previous Balance' : 'Starting Balance'}</span>
                <input type="number" step="0.01" value={stmtMeta.startingBalance} onChange={e => setStmtMeta({ ...stmtMeta, startingBalance: e.target.value })} placeholder="0.00" style={inp} />
              </div>
              <div>
                <span style={lbl}>{stmtMeta.isCreditCard ? 'New Balance' : 'Ending Balance'}</span>
                <input type="number" step="0.01" value={stmtMeta.endingBalance} onChange={e => setStmtMeta({ ...stmtMeta, endingBalance: e.target.value })} placeholder="0.00" style={inp} />
              </div>
            </div>
            
            {hasBalances && (
              <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '6px', background: previewVariance < 0.01 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${previewVariance < 0.01 ? C.green : '#ef4444'}40` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: C.muted, fontWeight: 'bold' }}>Statement Integrity Check:</span>
                  <span style={{ fontWeight: 'bold', color: previewVariance < 0.01 ? C.green : '#ef4444' }}>
                    {previewVariance < 0.01 ? '✓ Balanced' : `${fmt(previewVariance)} variance`}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                  Sum: {fmt(previewSum)} · Expected: {fmt(expectedDelta)}
                </div>
                <div style={{ fontSize: '10px', color: C.muted, marginTop: '4px', fontStyle: 'italic' }}>
                  Verifies PDF extraction. Final reconciliation against your books happens in the Reports tab.
                </div>
              </div>
            )}
          </div>

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
            <button onClick={confirmImport} disabled={importing} style={{ padding: '10px 18px', background: importing ? C.muted : `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: importing ? 'wait' : 'pointer', fontSize: '14px', fontFamily: FONT }}>
              {importing ? 'Importing...' : 'Import Selected'}
            </button>
            <button onClick={() => { setUploadPreview([]); setUploadStatus(''); setStmtMeta({ detectedAccount: '', startingBalance: '', endingBalance: '', periodStart: '', periodEnd: '', fileName: '', isCreditCard: false }) }} style={{ padding: '10px 14px', background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.muted, cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '10px' }}>
        <span style={lbl}>Account</span>
        <select value={account} onChange={e => setAccount(e.target.value)} style={inp}>
          <option value="All">All Accounts</option>
          <optgroup label="Checking Accounts">
            {CHECKING_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
          </optgroup>
          <optgroup label="Credit Cards">
            {CREDIT_CARD_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
          </optgroup>
        </select>
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

      <input type="text" placeholder="🔍 Search description, account, amount..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ ...inp, marginBottom: '8px' }} />

      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <button onClick={() => setFilterMode('unreconciled')} style={tabBtn('unreconciled')}>Unreconciled ({unreconciledCount})</button>
        <button onClick={() => setFilterMode('reconciled')} style={tabBtn('reconciled')}>Reconciled ({reconciledCount})</button>
        <button onClick={() => setFilterMode('all')} style={tabBtn('all')}>All ({allCount})</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {filterMode === 'reconciled' && visible.length > 0 && (
            <button onClick={() => bulkUnreconcile(visible)} style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: `1px solid #dc2626`, borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>
              ↩ Unreconcile All ({visible.length})
            </button>
          )}
          {filterMode === 'unreconciled' && visible.length > 0 && (
            <button onClick={() => bulkDelete(visible)} style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: `1px solid #dc2626`, borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>
              🗑️ Delete All ({visible.length})
            </button>
          )}
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>
          {showAddForm ? 'Cancel' : '+ Add Transaction'}
        </button>
      </div>

      {showAddForm && (
        <div style={{ ...card, border: `1px solid ${C.teal}` }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div><span style={lbl}>Account</span>
              <select value={newTxn.account_name} onChange={e => setNewTxn({ ...newTxn, account_name: e.target.value })} style={inp}>
                <optgroup label="Checking Accounts">
                  {CHECKING_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                </optgroup>
                <optgroup label="Credit Cards">
                  {CREDIT_CARD_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                </optgroup>
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

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
          {search ? 'No transactions match your search' : filterMode === 'unreconciled' ? 'Nothing to reconcile ✓' : filterMode === 'reconciled' ? 'No reconciled transactions yet' : 'No transactions — upload a statement or add one manually'}
        </div>
      ) : visible.map((txn: any) => {
        const currentAction = getAction(txn)
        const validActions = getValidActions(Number(txn.amount))
        const suggestion = suggestActionType(txn.description, Number(txn.amount))
        const matchedExpenses = txn.is_reconciled ? (expenses || []).filter((x: any) => x.bank_txn_id === txn.id) : []
        const matchedSales = txn.is_reconciled ? (sales || []).filter((x: any) => x.bank_txn_id === txn.id) : []
        const matchedDisb = txn.is_reconciled ? (p.disbursements || []).filter((x: any) => x.bank_txn_id === txn.id) : []
        const matchedEquity = txn.is_reconciled ? (equityTransactions || []).filter((x: any) => x.bank_txn_id === txn.id) : []
        const matchedLoans = txn.is_reconciled ? (memberLoans || []).filter((x: any) => x.bank_txn_id === txn.id) : []
        const matchedLoanPmts = txn.is_reconciled ? (memberLoanPayments || []).filter((x: any) => x.bank_txn_id === txn.id) : []
        const matchedAp = txn.is_reconciled ? (accountsPayable || []).filter((x: any) => x.bank_txn_id === txn.id) : []
        const matchedCol = txn.is_reconciled ? (collections || []).filter((x: any) => x.bank_txn_id === txn.id) : []
        const totalMatched = matchedExpenses.length + matchedSales.length + matchedDisb.length + matchedEquity.length + matchedLoans.length + matchedLoanPmts.length + matchedAp.length + matchedCol.length

        return (
          <div key={txn.id} style={{ ...card, padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{txn.description}</div>
                <div style={{ fontSize: '12px', color: C.muted }}>{txn.transaction_date} · {txn.account_name}{txn.action_type ? ` · ${ACTION_LABELS[txn.action_type as ActionType] || txn.action_type}` : ''}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 900, color: txn.amount >= 0 ? C.green : '#ef4444' }}>{fmt(txn.amount)}</span>
                {txn.is_reconciled && <span style={{ color: C.green, fontSize: '12px' }}>✓</span>}
                {!txn.is_reconciled && <button onClick={() => deleteTxn(txn)} title="Delete" style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '16px', padding: '2px 4px' }}>🗑️</button>}
              </div>
            </div>

            {!txn.is_reconciled && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${C.border}` }}>
                {suggestion.note && (
                  <div style={{ marginBottom: '8px', padding: '6px 10px', background: 'rgba(45,191,184,0.06)', border: `1px solid rgba(45,191,184,0.2)`, borderRadius: '6px', fontSize: '11px', color: C.teal }}>
                    ℹ️ {suggestion.note}
                  </div>
                )}

                <div style={{ marginBottom: '12px' }}>
                  <span style={lbl}>Action Type</span>
                  <select value={currentAction} onChange={e => setAction(txn.id, e.target.value as ActionType)} style={inp}>
                    {validActions.map(a => (
                      <option key={a} value={a}>
                        {ACTION_LABELS[a]}
                        {a === suggestion.action ? ' ✨' : ''}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>
                    {ACTION_HINTS[currentAction]}
                  </div>
                </div>

                {renderActionForm(txn, currentAction)}

                <button onClick={() => executeAction(txn)} style={{ marginTop: '12px', padding: '10px', background: C.green, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT, width: '100%' }}>
                  Confirm & Clear Line
                </button>
              </div>
            )}

            {txn.is_reconciled && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Matched to {totalMatched} ledger entr{totalMatched === 1 ? 'y' : 'ies'}
                  </div>
                  <button onClick={() => unreconcileTxn(txn)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: C.muted, cursor: 'pointer', fontFamily: FONT }}>↩ Unreconcile</button>
                </div>

                {totalMatched === 0 && (txn.action_type === 'platform_payout' || txn.action_type === 'card_payment' || txn.action_type === 'transfer') ? (
                  <div style={{ fontSize: '13px', color: C.muted, padding: '8px 10px', background: 'rgba(45,191,184,0.04)', borderRadius: '6px' }}>
                    ℹ️ Reconcile-only action ({ACTION_LABELS[txn.action_type as ActionType]}) — no ledger entry required.
                  </div>
                ) : totalMatched === 0 ? (
                  <div style={{ fontSize: '13px', color: '#ef4444', padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px' }}>
                    ⚠️ Marked reconciled but no ledger entry found.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {matchedExpenses.map((x: any) => (
                      <div key={`exp-${x.id}`} style={{ padding: '8px 10px', background: 'rgba(45,191,184,0.06)', borderLeft: `3px solid ${C.teal}`, borderRadius: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>Expense · {x.category || 'Uncategorized'}</span>
                          <span>{fmt(Number(x.cost))}</span>
                        </div>
                        <div style={{ color: C.muted, marginTop: '2px' }}>{x.purchase_date}{x.label ? ` · ${x.label}` : ''}</div>
                        {x.notes && <div style={{ color: C.text, marginTop: '4px', fontStyle: 'italic' }}>📝 {x.notes}</div>}
                      </div>
                    ))}
                    {matchedSales.map((x: any) => (
                      <div key={`sale-${x.id}`} style={{ padding: '8px 10px', background: 'rgba(45,191,184,0.06)', borderLeft: `3px solid ${C.teal}`, borderRadius: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>Sale · {x.platform || 'other'}</span>
                          <span>{fmt(Number(x.amount))}</span>
                        </div>
                        <div style={{ color: C.muted, marginTop: '2px' }}>{x.date}</div>
                        {x.notes && <div style={{ color: C.text, marginTop: '4px', fontStyle: 'italic' }}>📝 {x.notes}</div>}
                      </div>
                    ))}
                    {matchedDisb.map((x: any) => (
                      <div key={`disb-${x.id}`} style={{ padding: '8px 10px', background: 'rgba(45,191,184,0.06)', borderLeft: `3px solid ${C.teal}`, borderRadius: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>Disbursement · {x.recipient || 'Unknown'}</span>
                          <span>{fmt(Number(x.amount))}</span>
                        </div>
                        <div style={{ color: C.muted, marginTop: '2px' }}>{x.disbursement_date || x.date}</div>
                        {x.notes && <div style={{ color: C.text, marginTop: '4px', fontStyle: 'italic' }}>📝 {x.notes}</div>}
                      </div>
                    ))}
                    {matchedEquity.map((x: any) => (
                      <div key={`eq-${x.id}`} style={{ padding: '8px 10px', background: 'rgba(45,191,184,0.06)', borderLeft: `3px solid ${C.teal}`, borderRadius: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>Equity · {x.type} · {x.member_name}</span>
                          <span>{fmt(Number(x.amount))}</span>
                        </div>
                        <div style={{ color: C.muted, marginTop: '2px' }}>{x.transaction_date}</div>
                        {x.notes && <div style={{ color: C.text, marginTop: '4px', fontStyle: 'italic' }}>📝 {x.notes}</div>}
                      </div>
                    ))}
                    {matchedLoans.map((x: any) => (
                      <div key={`ln-${x.id}`} style={{ padding: '8px 10px', background: 'rgba(45,191,184,0.06)', borderLeft: `3px solid ${C.teal}`, borderRadius: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>Member Loan · {x.member_name}</span>
                          <span>{fmt(Number(x.principal))}</span>
                        </div>
                        <div style={{ color: C.muted, marginTop: '2px' }}>{x.loan_date} · {x.interest_rate}% interest</div>
                        {x.notes && <div style={{ color: C.text, marginTop: '4px', fontStyle: 'italic' }}>📝 {x.notes}</div>}
                      </div>
                    ))}
                    {matchedLoanPmts.map((x: any) => (
                      <div key={`lp-${x.id}`} style={{ padding: '8px 10px', background: 'rgba(45,191,184,0.06)', borderLeft: `3px solid ${C.teal}`, borderRadius: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>Loan Repayment</span>
                          <span>{fmt(Number(x.principal) + Number(x.interest || 0))}</span>
                        </div>
                        <div style={{ color: C.muted, marginTop: '2px' }}>{x.payment_date} · Principal {fmt(Number(x.principal))} + Interest {fmt(Number(x.interest || 0))}</div>
                        {x.notes && <div style={{ color: C.text, marginTop: '4px', fontStyle: 'italic' }}>📝 {x.notes}</div>}
                      </div>
                    ))}
                    {matchedAp.map((x: any) => (
                      <div key={`ap-${x.id}`} style={{ padding: '8px 10px', background: 'rgba(45,191,184,0.06)', borderLeft: `3px solid ${C.teal}`, borderRadius: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>AP Payment · {x.vendor_name || 'Unknown vendor'}</span>
                          <span>{fmt(Number(x.amount_paid || x.total_amount))}</span>
                        </div>
                        <div style={{ color: C.muted, marginTop: '2px' }}>{x.invoice_date}{x.due_date ? ` · due ${x.due_date}` : ''}</div>
                        {x.notes && <div style={{ color: C.text, marginTop: '4px', fontStyle: 'italic' }}>📝 {x.notes}</div>}
                      </div>
                    ))}
                    {matchedCol.map((x: any) => (
                      <div key={`col-${x.id}`} style={{ padding: '8px 10px', background: 'rgba(45,191,184,0.06)', borderLeft: `3px solid ${C.teal}`, borderRadius: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>Collection · {x.seller_name || 'Unknown'}</span>
                          <span>{fmt(Number(x.amount))}</span>
                        </div>
                        <div style={{ color: C.muted, marginTop: '2px' }}>{x.collection_date || x.date}</div>
                        {x.notes && <div style={{ color: C.text, marginTop: '4px', fontStyle: 'italic' }}>📝 {x.notes}</div>}
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
