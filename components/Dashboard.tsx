'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'
import { FONT, LIGHT_COLORS, DARK_COLORS, USEFUL_LIFE } from '@/lib/constants'
import { today } from '@/lib/format'
import Nav from '@/components/Nav'
import QuickAddModal from '@/components/QuickAddModal'
import RecordForm from '@/components/RecordForm'
import HomeTab from '@/tabs/HomeTab'
import MoneyInTab from '@/tabs/MoneyInTab'
import MoneyOutTab from '@/tabs/MoneyOutTab'
import BankTab from '@/tabs/BankTab'
import ReportsTab from '@/tabs/ReportsTab'

export const emptyForm = {
  label: '', amount: '', date: today(),
  fees: '', shipping: '', notes: '', itemCount: '', category: 'Supplies & Packaging',
  isTaxable: false, taxRate: '7.75',
  miles: '', mileFrom: '', mileTo: '', milePurpose: '',
  cogsType: 'collection', cogsSet: '', cogsCost: '', cogsQty: '1',
  cogsCards: '', cogsCardsPerBox: '', cogsEstValue: '', amountPaid: '',
  userName: 'Cam', paidByCompany: true, assetCategory: 'Equipment', assetLife: '5',
  payPeriod: '', hoursWorked: '', hourlyRate: '16', rothEligible: '', rothContributed: '',
  bankName: 'Chase', accountType: 'Checking', accountLast4: '', bankBalance: '',
  apVendor: '', apTotal: '', apPaid: '', apDue: '', apTerms: 'net_30', apVendorId: '',
  paymentPlan: false, planFrequency: 'monthly', planPaymentAmount: '', planStartDate: '',
  supplyItem: '', supplyUnit: '', supplyCost: '',
}

export default function Dashboard() {
  const supabase = useMemo(() => createClient(), [])
  const [themeMode, setThemeMode] = useState<'light'|'dark'|'auto'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('mana_theme') as any) || 'auto'
    return 'auto'
  })
  const isDark = (() => {
    if (themeMode === 'dark') return true
    if (themeMode === 'light') return false
    const h = new Date().getHours()
    return h >= 19 || h < 7
  })()
  const C = isDark ? DARK_COLORS : LIGHT_COLORS

  const [activeTab, setActiveTab] = useState('home')
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(0)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<{ table: string, data?: any } | null>(null)
  const [formData, setFormData] = useState(emptyForm)

  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [accountsPayable, setAccountsPayable] = useState<any[]>([])
  const [payroll, setPayroll] = useState<any[]>([])
  const [disbursements, setDisbursements] = useState<any[]>([])
  const [mileageLog, setMileageLog] = useState<any[]>([])
  const [cogsInventory, setCogsInventory] = useState<any[]>([])
  const [allCogsInventory, setAllCogsInventory] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [supplyCosts, setSupplyCosts] = useState<any[]>([])
  const [reconTransactions, setReconTransactions] = useState<any[]>([])
  const [vendorMappings, setVendorMappings] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [equityTransactions, setEquityTransactions] = useState<any[]>([])
  const [memberLoans, setMemberLoans] = useState<any[]>([])
  const [memberLoanPayments, setMemberLoanPayments] = useState<any[]>([])
  const [salesTaxRemittances, setSalesTaxRemittances] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [billPayments, setBillPayments] = useState<any[]>([])

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Grotesk:wght@300;400;500;600;700&display=swap'
    document.head.appendChild(link)
  }, [])
  useEffect(() => { document.body.style.background = isDark ? '#232D42' : '#F0F2F8' }, [isDark])

  const fetchData = useCallback(async () => {
    const fd = (data: any[], key: string) => (data || []).filter(i => {
      const d = new Date(i[key])
      return d.getFullYear() === selectedYear && (selectedMonth === 0 || (d.getMonth() + 1) === selectedMonth)
    })
    const [s, e, ap, p, d, ml, ci, allCI, ast, ba, sc, bst, vm, col, eq, mln, mlp, str, ven, bpay] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('accounts_payable').select('*').order('invoice_date', { ascending: false }),
      supabase.from('payroll').select('*').order('pay_date', { ascending: false }),
      supabase.from('disbursements').select('*'),
      supabase.from('mileage_log').select('*').order('date', { ascending: false }),
      supabase.from('cogs_inventory').select('*').order('date', { ascending: false }),
      supabase.from('cogs_inventory').select('*').order('date', { ascending: true }),
      supabase.from('assets').select('*').order('purchase_date', { ascending: false }),
      supabase.from('bank_accounts').select('*'),
      supabase.from('supply_costs').select('*').order('effective_date', { ascending: false }),
      supabase.from('bank_statement_transactions').select('*').order('transaction_date', { ascending: false }),
      supabase.from('vendor_mappings').select('*').order('correction_count', { ascending: false }),
      supabase.from('collections').select('*').order('due_date', { ascending: true }),
      supabase.from('equity_transactions').select('*').order('transaction_date', { ascending: false }),
      supabase.from('member_loans').select('*').eq('is_active', true).order('loan_date', { ascending: false }),
      supabase.from('member_loan_payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('sales_tax_remittances').select('*').order('quarter_year', { ascending: false }),
      supabase.from('vendors').select('*').order('vendor_name', { ascending: true }),
      supabase.from('bill_payments').select('*').order('payment_date', { ascending: false }),
    ])
    setSales(fd(s.data || [], 'sale_date'))
    setExpenses(fd(e.data || [], 'purchase_date'))
    setAccountsPayable(ap.data || [])
    setPayroll(fd(p.data || [], 'pay_date'))
    setDisbursements(fd(d.data || [], 'disbursement_date'))
    setMileageLog((ml.data || []).filter((i: any) => new Date(i.date).getFullYear() === selectedYear))
    setCogsInventory((ci.data || []).filter((i: any) => new Date(i.date).getFullYear() === selectedYear))
    setAllCogsInventory(allCI.data || [])
    setAssets(ast.data || [])
    setBankAccounts(ba.data || [])
    setSupplyCosts(sc.data || [])
    setReconTransactions(fd(bst.data || [], 'transaction_date'))
    setVendorMappings(vm.data || [])
    setCollections(col.data || [])
    setEquityTransactions(eq.data || [])
    setMemberLoans(mln.data || [])
    setMemberLoanPayments(mlp.data || [])
    setSalesTaxRemittances(str.data || [])
    setVendors(ven.data || [])
    setBillPayments(bpay.data || [])
  }, [selectedYear, selectedMonth, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const startEdit = (table: string, row: any) => {
    const pre: any = { ...emptyForm, date: row.invoice_date || row.sale_date || row.purchase_date || row.due_date || row.pay_date || row.disbursement_date || row.date || emptyForm.date }
    if (table === 'sales') { pre.label = row.platform; pre.amount = String(row.amount); pre.fees = String(row.fees || 0); pre.shipping = String(row.shipping || 0); pre.isTaxable = !!row.is_taxable; pre.taxRate = String(row.tax_rate_applied ? (Number(row.tax_rate_applied) * 100).toFixed(2) : '7.75') }
    else if (table === 'accounts_payable') { 
      pre.apVendor = row.vendor_name; 
      pre.label = row.description || ''; 
      pre.apTotal = String(row.total_amount); 
      pre.amountPaid = String(row.amount_paid || 0); 
      pre.apDue = row.due_date || ''; 
      pre.apTerms = row.payment_terms || 'net_30'; 
      pre.apVendorId = row.vendor_id || ''; 
      pre.notes = row.notes || '';
      pre.paymentPlan = !!row.payment_plan;
      pre.planFrequency = row.plan_frequency || 'monthly';
      pre.planPaymentAmount = String(row.plan_payment_amount || '');
      pre.planStartDate = row.plan_start_date || '';
    }
    else if (table === 'expenses') { pre.label = row.notes || ''; pre.amount = String(row.cost); pre.category = row.category || 'Other'; pre.userName = row.user_name || 'Cam'; pre.paidByCompany = row.paid_by_company ?? true }
    else if (table === 'payroll') { pre.label = row.employee_name; pre.amount = String(row.amount); pre.hoursWorked = String(row.hours_worked || ''); pre.hourlyRate = String(row.hourly_rate || 16); pre.payPeriod = row.pay_period || '' }
    else if (table === 'disbursements') { pre.label = row.recipient; pre.amount = String(row.amount); pre.notes = row.notes || '' }
    else if (table === 'mileage_log') { pre.milePurpose = row.purpose; pre.mileFrom = row.from_location; pre.mileTo = row.to_location; pre.miles = String(row.miles); pre.userName = row.user_name || 'Cam' }
    else if (table === 'cogs_inventory') { pre.label = row.description; pre.cogsType = row.inventory_type; pre.cogsSet = row.set_name || ''; pre.cogsCost = String(row.purchase_price); pre.cogsQty = String(row.quantity || 1); pre.cogsCards = String(row.card_count || ''); pre.cogsCardsPerBox = String(row.cards_per_box || ''); pre.cogsEstValue = String(row.est_sell_value || '') }
    else if (table === 'assets') { pre.label = row.description; pre.amount = String(row.cost); pre.assetCategory = row.category || 'Equipment'; pre.assetLife = String(row.useful_life_yrs || 5); pre.notes = row.notes || ''; pre.userName = row.user_name || 'Cam' }
    else if (table === 'bank_accounts') { pre.bankName = row.bank_name; pre.accountType = row.account_type; pre.accountLast4 = row.account_last4 || ''; pre.bankBalance = String(row.current_balance || 0); pre.notes = row.notes || '' }
    else if (table === 'supply_costs') { pre.supplyItem = row.item_name; pre.supplyUnit = row.unit_description; pre.supplyCost = String(row.cost_per_unit); pre.notes = row.notes || '' }
    setFormData(pre); setEditingItem({ table, data: row })
  }

  const handleSave = async () => {
    const t = editingItem?.table
    if (!t) return
    const { getEntity } = await import('@/lib/format')
    const { calculateDueDate } = await import('@/lib/paymentTerms')
    let payload: any = {}
    if (t === 'sales') {
      if (!formData.amount || !formData.label) return alert('Missing fields')
      const gross = Number(formData.amount)
      const rate = formData.isTaxable ? (Number(formData.taxRate) || 0) / 100 : 0
      const tax = rate > 0 ? gross - (gross / (1 + rate)) : 0
      payload = { 
        platform: formData.label, amount: gross, 
        fees: Number(formData.fees || 0), shipping: Number(formData.shipping || 0), 
        sale_date: formData.date, period_start: formData.date, period_end: formData.date, 
        entity: getEntity(formData.date), net_sales: gross - Number(formData.fees || 0), 
        num_orders: editingItem!.data?.num_orders ?? 1,
        is_taxable: !!formData.isTaxable, tax_rate_applied: rate,
        sales_tax_collected: Math.round(tax * 100) / 100,
      }
    } else if (t === 'accounts_payable') {
      if (!formData.apTotal || !formData.apVendor) return alert('Missing fields')
      const cardCount = parseInt((formData as any).apCardCount || '0') || 0
      const terms = (formData as any).apTerms || 'net_30'
      const dueDate = terms === 'custom' 
        ? (formData.apDue || formData.date) 
        : (formData.apDue || calculateDueDate(formData.date, terms as any))
      const total = Number(formData.apTotal)
      const paid = Number(formData.amountPaid || 0)
      const status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'open'
      payload = { 
        vendor_name: formData.apVendor, 
        vendor_id: (formData as any).apVendorId || null,
        description: formData.label, 
        invoice_date: formData.date, 
        due_date: dueDate, 
        payment_terms: terms,
        total_amount: total, amount_paid: paid, status,
        entity: getEntity(formData.date), 
        notes: formData.notes + (cardCount > 0 ? ` | ${cardCount.toLocaleString()} cards @ $${(parseFloat(formData.apTotal)/cardCount).toFixed(4)}/card` : '') ,
        payment_plan: !!formData.paymentPlan,
        plan_frequency: formData.paymentPlan ? formData.planFrequency : null,
        plan_payment_amount: formData.paymentPlan ? Number(formData.planPaymentAmount) || null : null,
        plan_start_date: formData.paymentPlan ? (formData.planStartDate || formData.date) : null,
        plan_next_due: null,
      }
    } else if (t === 'expenses') {
      if (!formData.amount) return alert('Missing amount')
      payload = { category: formData.category, cost: Number(formData.amount), purchase_date: formData.date, notes: formData.label, entity: getEntity(formData.date), user_name: formData.userName || 'Cam', paid_by_company: formData.paidByCompany }
    } else if (t === 'payroll') {
      if (!formData.amount || !formData.label) return alert('Missing fields')
      payload = { employee_name: formData.label, amount: Number(formData.amount), pay_date: formData.date, hours_worked: Number(formData.hoursWorked || 0), hourly_rate: Number(formData.hourlyRate || 0), pay_period: formData.payPeriod || formData.date, roth_ira_eligible: Number(formData.rothEligible || 0), roth_ira_contributed: Number(formData.rothContributed || 0) }
    } else if (t === 'disbursements') {
      if (!formData.amount || !formData.label) return alert('Missing fields')
      payload = { recipient: formData.label, amount: Number(formData.amount), notes: formData.notes, disbursement_date: formData.date }
    } else if (t === 'mileage_log') {
      if (!formData.miles || !formData.milePurpose) return alert('Missing fields')
      payload = { date: formData.date, purpose: formData.milePurpose, from_location: formData.mileFrom, to_location: formData.mileTo, miles: parseFloat(formData.miles) || 0, user_name: formData.userName || 'Cam' }
    } else if (t === 'cogs_inventory') {
      if (!formData.cogsCost || !formData.label) return alert('Missing fields')
      const cost = parseFloat(formData.cogsCost) || 0, qty = parseInt(formData.cogsQty) || 1, totalCost = cost * qty
      const totalUnits = formData.cogsType === 'collection' ? parseInt(formData.cogsCards) || 0 : ['booster_box','precon'].includes(formData.cogsType) ? (parseInt(formData.cogsCardsPerBox) || 0) * qty : qty
      payload = { date: formData.date, inventory_type: formData.cogsType, description: formData.label, set_name: formData.cogsSet || null, purchase_price: cost, quantity: qty, card_count: parseInt(formData.cogsCards) || 0, cards_per_box: parseInt(formData.cogsCardsPerBox) || 0, total_cost: totalCost, cost_per_unit: totalUnits > 0 ? totalCost / totalUnits : 0, total_units: totalUnits, sold_units: 0, est_sell_value: parseFloat(formData.cogsEstValue) || 0, entity: getEntity(formData.date) }
    } else if (t === 'assets') {
      if (!formData.amount || !formData.label) return alert('Missing fields')
      payload = { purchase_date: formData.date, description: formData.label, category: formData.assetCategory, cost: Number(formData.amount), tax_paid: Number(formData.fees || 0), useful_life_yrs: parseInt(formData.assetLife) || USEFUL_LIFE[formData.assetCategory] || 5, depreciation_method: 'both', entity: getEntity(formData.date), notes: formData.notes, user_name: formData.userName || 'Cam' }
    } else if (t === 'bank_accounts') {
      if (!formData.bankBalance) return alert('Missing balance')
      payload = { bank_name: formData.bankName, account_type: formData.accountType, account_last4: formData.accountLast4, current_balance: Number(formData.bankBalance), as_of_date: formData.date, notes: formData.notes }
    } else if (t === 'supply_costs') {
      if (!formData.supplyItem || !formData.supplyCost) return alert('Missing fields')
      const qty = parseFloat((formData as any).supplyQty || '1') || 1
      const totalCost = parseFloat((formData as any).supplyTotalCost || '0') || (parseFloat(formData.supplyCost) * qty)
      payload = { item_name: formData.supplyItem, unit_description: formData.supplyUnit || 'each', cost_per_unit: parseFloat(formData.supplyCost), effective_date: formData.date, notes: formData.notes, quantity: qty, total_cost: totalCost, vendor: (formData as any).supplyVendor || null, source: 'manual' }
    }
    if (editingItem!.data?.id) {
      const { error } = await supabase.from(t).update(payload).eq('id', editingItem!.data.id)
      if (error) return alert(error.message)
    } else {
      const { data: inserted, error } = await supabase.from(t).insert([payload]).select().single()
      if (error) return alert(error.message)
      if (t === 'expenses' && inserted && (payload.category === 'Equipment' || payload.category === 'Furniture & Fixtures')) {
        const life = payload.category === 'Furniture & Fixtures' ? 7 : 5
        await supabase.from('assets').insert({ purchase_date: payload.purchase_date, description: payload.notes || 'Auto-created from expense', category: payload.category, cost: Number(payload.cost), tax_paid: 0, useful_life_yrs: life, depreciation_method: 'both', entity: payload.entity, user_name: payload.user_name || 'Cam', source_expense_id: inserted.id, is_auto_created: true })
        await supabase.from('expenses').update({ asset_created: true }).eq('id', inserted.id)
      }
    }
    setEditingItem(null); setFormData(emptyForm); fetchData()
  }

  const handleDelete = async (table: string, id: string) => {
    if (!confirm('Delete?')) return
    await supabase.from(table).delete().eq('id', id)
    fetchData()
  }

  const cycleTheme = () => {
    const next = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'auto' : 'light'
    setThemeMode(next); localStorage.setItem('mana_theme', next)
  }
  const themeIcon = themeMode === 'light' ? '☀️' : themeMode === 'dark' ? '🌙' : '🌓'

  const shared = { C, isDark, fetchData, startEdit, handleDelete, selectedYear, selectedMonth,
    sales, expenses, accountsPayable, payroll, disbursements, mileageLog,
    cogsInventory, allCogsInventory, assets, bankAccounts, supplyCosts, reconTransactions,
    vendorMappings, collections, equityTransactions, memberLoans, memberLoanPayments,
    salesTaxRemittances, vendors, billPayments, setEditingItem, supabase }

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', paddingBottom: '140px', color: C.text }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>
        <header style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 900, color: C.navy, fontSize: '17px', fontFamily: FONT }}>MANA SOCIAL LLC</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={cycleTheme} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '6px 10px', fontSize: '15px', cursor: 'pointer' }}>{themeIcon}</button>
              <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '6px 14px', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: FONT }}>Sign out</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `2px solid ${C.border}`, fontWeight: 'bold', background: C.white, fontFamily: FONT, fontSize: '14px', color: C.text }}>
              <option value={2026}>2026</option>
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 2, padding: '10px', borderRadius: '10px', border: `2px solid ${C.border}`, fontWeight: 'bold', background: C.white, fontFamily: FONT, fontSize: '14px', color: C.text }}>
              <option value={0}>Full Year</option>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
            </select>
          </div>
        </header>

        {editingItem ? (
          <RecordForm table={editingItem.table} isEditing={!!editingItem.data?.id} formData={formData} setFormData={setFormData} onSave={handleSave} onClose={() => { setEditingItem(null); setFormData(emptyForm) }} C={C} vendors={vendors} />
        ) : (
          <>
            {activeTab === 'home'    && <HomeTab {...shared} setActiveTab={setActiveTab} />}
            {activeTab === 'in'      && <MoneyInTab {...shared} />}
            {activeTab === 'out'     && <MoneyOutTab {...shared} />}
            {activeTab === 'bank'    && <BankTab {...shared} />}
            {activeTab === 'reports' && <ReportsTab {...shared} />}
          </>
        )}

        {!editingItem && (
          <button onClick={() => setIsQuickAddOpen(true)} style={{ position: 'fixed', bottom: '120px', right: '20px', width: '62px', height: '62px', borderRadius: '31px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', fontSize: '30px', border: '3px solid #fff', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', zIndex: 500, cursor: 'pointer' }}>+</button>
        )}

        <QuickAddModal open={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} onPick={(table) => setEditingItem({ table })} onBulk={() => setEditingItem({ table: 'expenses' })} onDraw={() => setEditingItem({ table: 'disbursements' })} C={C} />
      </div>
      <Nav activeTab={activeTab} setActiveTab={setActiveTab} C={C} isDark={isDark} />
    </div>
  )
}
