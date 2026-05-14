'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const FONT = "'Calibri', sans-serif"

const C = {
  navy: '#1B2A4A', navyDark: '#111D33', teal: '#2DBFB8',
  pink: '#E8407A', purple: '#6B3FA0', gold: '#F0C040',
  bg: '#F0F2F8', white: '#FFFFFF', muted: '#8A96B0',
  text: '#1B2A4A', border: 'rgba(27,42,74,0.12)', green: '#10b981',
}

const fmt = (n: number) => {
  if (n < 0) return '-$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const fmtK = (n: number) => {
  if (Math.abs(n) >= 1000) return (n < 0 ? '-$' : '$') + (Math.abs(n) / 1000).toFixed(1) + 'k'
  return fmt(n)
}
const pctFmt = (n: number, d: number) => d === 0 ? '—' : (n / d * 100).toFixed(1) + '%'
const getEntity = (date: string) => new Date(date) < new Date('2026-03-18') ? 'sole_prop' : 'llc'
const LLC_START = new Date('2026-03-18')

const DEDUCTIBILITY: Record<string, { pct: number | null, label: string, line: string }> = {
  'Shipping & Postage':         { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Selling Fees & Commissions': { pct: 100,  label: '100% deductible',             line: 'Sch C Line 10'  },
  'Software & Subscriptions':   { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Supplies & Packaging':       { pct: 100,  label: '100% deductible',             line: 'Sch C Line 22'  },
  'Advertising & Marketing':    { pct: 100,  label: '100% deductible',             line: 'Sch C Line 8'   },
  'Professional Services':      { pct: 100,  label: '100% deductible',             line: 'Sch C Line 17'  },
  'Banking & Finance Charges':  { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Taxes & Licenses':           { pct: 100,  label: '100% deductible',             line: 'Sch C Line 23'  },
  'Equipment':                  { pct: 100,  label: 'Sec 179 or depreciate',       line: 'Sch C Line 13'  },
  'Furniture & Fixtures':       { pct: 100,  label: 'Sec 179 or depreciate',       line: 'Sch C Line 13'  },
  'Travel & Conventions':       { pct: 100,  label: '100% deductible',             line: 'Sch C Line 24a' },
  'Trade Shows & Conventions':  { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Meals & Entertainment':      { pct: 50,   label: '50% deductible',              line: 'Sch C Line 24b' },
  'Internet & Phone':           { pct: null, label: 'Partial — business use %',    line: 'Sch C Line 25'  },
  'Education & Training':       { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Home Office':                { pct: null, label: 'Partial — set % in settings', line: 'Sch C Line 30'  },
  'Other':                      { pct: null, label: 'Needs review',                line: 'Sch C Line 27a' },
}
const EXPENSE_CATEGORIES = Object.keys(DEDUCTIBILITY)
const MILEAGE_RATE = 0.67
const ASSET_CATEGORIES = ['Equipment', 'Furniture & Fixtures', 'Vehicle']
const USEFUL_LIFE: Record<string, number> = { Equipment: 5, 'Furniture & Fixtures': 7, Vehicle: 5 }

function parseTCGplayerXLSX(file: File): Promise<{ records: any[], meta: any }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const sheetName = wb.SheetNames[0]
        const dateMatch = sheetName.match(/(\d{8})_(\d{8})$/)
        let periodStart = '', periodEnd = '', entity = 'llc'
        if (dateMatch) {
          const s = dateMatch[1], en = dateMatch[2]
          periodStart = `${s.slice(4)}-${s.slice(0, 2)}-${s.slice(2, 4)}`
          periodEnd   = `${en.slice(4)}-${en.slice(0, 2)}-${en.slice(2, 4)}`
          entity = new Date(periodEnd) < LLC_START ? 'sole_prop' : 'llc'
        }
        const rows: any[] = XLSX.utils.sheet_to_json(ws)
        let grossSales = 0, netSales = 0, netShipping = 0, netTCGTax = 0, numOrders = 0
        for (const row of rows) {
          const state = row['State'] || row['state']
          if (!state || String(state).length !== 2) continue
          grossSales  += Number(row['Gross Sales']     || 0)
          netSales    += Number(row['Net Sales']        || 0)
          netShipping += Number(row['Net Shipping Amt'] || row['Shipping Amt'] || 0)
          netTCGTax   += Number(row['Net TCG Tax Amt']  || row['TCG Tax Amt']  || 0)
          numOrders   += Number(row['Number of Orders'] || 0)
        }
        const derivedFees = parseFloat((grossSales - netSales - netTCGTax - netShipping).toFixed(2))
        const saleDate = periodEnd || new Date().toISOString().split('T')[0]
        resolve({
          records: [{ platform: 'tcgplayer', amount: parseFloat(grossSales.toFixed(2)), fees: derivedFees, shipping: parseFloat(netShipping.toFixed(2)), sale_date: saleDate, period_start: periodStart || saleDate, period_end: periodEnd || saleDate, entity, net_sales: parseFloat(netSales.toFixed(2)), num_orders: numOrders }],
          meta: { periodStart, periodEnd, entity, numOrders, grossSales, derivedFees, netSales, netShipping }
        })
      } catch (err: any) { reject(new Error('TCGplayer parse failed: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsArrayBuffer(file)
  })
}

function parseEbayCSV(file: File): Promise<{ records: any[], meta: any }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string
        const wb = XLSX.read(text, { type: 'string', raw: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws)
        const pd = (v: any) => parseFloat(String(v || '0').replace(/[$,\s]/g, '')) || 0
        let totalGross = 0, totalFees = 0, totalNet = 0, totalShippingLabels = 0, rowCount = 0
        for (const row of rows) {
          if (!row['Listing title']) continue
          const itemSales = pd(row['Item sales'])
          const totalSellingCost = pd(row['Total selling costs'])
          const shippingLabels = pd(row['Shipping labels cost (Amount you paid to buy shipping labels on eBay)'])
          const netSales = pd(row['Net sales (Net of taxes and selling costs)'])
          if (itemSales === 0 && Number(row['Quantity sold'] || 0) === 0) continue
          totalGross += itemSales
          totalFees += parseFloat((totalSellingCost - shippingLabels).toFixed(2))
          totalNet += netSales
          totalShippingLabels += shippingLabels
          rowCount++
        }
        const saleDate = new Date().toISOString().split('T')[0]
        resolve({
          records: [{ platform: 'ebay', amount: parseFloat(totalGross.toFixed(2)), fees: parseFloat(totalFees.toFixed(2)), shipping: parseFloat(totalShippingLabels.toFixed(2)), sale_date: saleDate, period_start: saleDate, period_end: saleDate, entity: 'llc', net_sales: parseFloat(totalNet.toFixed(2)), num_orders: rowCount }],
          meta: { totalGross, totalFees, totalNet, totalShippingLabels, rows: rowCount }
        })
      } catch (err: any) { reject(new Error('eBay parse failed: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsText(file)
  })
}

async function parseFileWithAI(file: File, mode: 'sales' | 'expenses'): Promise<any[]> {
  try {
    const isImage = file.type.startsWith('image/')
    const isPDF = file.type === 'application/pdf'
    const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv'
    const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    let content: any[] = []
    if (isCSV || isXLSX) {
      const text = await file.text()
      const prompt = mode === 'sales'
        ? `ManaPool sales report. Extract sales. Return ONLY JSON array:\n[{"platform":"manapool","amount":0,"fees":0,"shipping":0,"date":"YYYY-MM-DD"}]\n\n${text.slice(0, 8000)}`
        : `Expense receipt. Extract expenses. Return ONLY JSON array:\n[{"category":"${EXPENSE_CATEGORIES.join('|')}","cost":0,"date":"YYYY-MM-DD","notes":"vendor"}]\n\n${text.slice(0, 8000)}`
      content = [{ type: 'text', text: prompt }]
    } else if (isImage || isPDF) {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const prompt = mode === 'sales'
        ? 'Sales receipt. Return ONLY JSON array: [{"platform":"tcgplayer|ebay|manapool|other","amount":0,"fees":0,"shipping":0,"date":"YYYY-MM-DD"}]'
        : `Expense receipt. Return ONLY JSON array: [{"category":"${EXPENSE_CATEGORIES.join('|')}","cost":0,"date":"YYYY-MM-DD","notes":"vendor"}]`
      content = [
        { type: isImage ? 'image' : 'document', source: { type: 'base64', media_type: file.type || 'application/pdf', data: base64 } },
        { type: 'text', text: prompt }
      ]
    } else return []
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content }] })
    })
    const data = await res.json()
    const text = data.content?.[0]?.text || '[]'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch { return [] }
}

function calcDepreciation(cost: number, life: number, purchaseDate: string, year: number) {
  const purchaseYear = new Date(purchaseDate).getFullYear()
  const yearsIn = year - purchaseYear
  if (yearsIn < 0 || yearsIn >= life) return { slAnnual: 0, slAccumulated: 0, slBookValue: cost, sec179: cost }
  const slAnnual = parseFloat((cost / life).toFixed(2))
  const slAccumulated = parseFloat((slAnnual * (yearsIn + 1)).toFixed(2))
  const slBookValue = parseFloat(Math.max(0, cost - slAccumulated).toFixed(2))
  return { slAnnual, slAccumulated, slBookValue, sec179: cost }
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else onLogin()
    setLoading(false)
  }
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg,${C.navyDark},${C.navy})`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: FONT }}>
      <div style={{ background: C.white, borderRadius: '20px', padding: '40px 32px', width: '100%', maxWidth: '360px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', textAlign: 'center' }}>
        <h1 style={{ fontFamily: FONT, fontSize: '22px', color: C.navy, marginBottom: '28px', fontWeight: 700 }}>Mana Social</h1>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: '10px', fontSize: '14px', background: '#F5F6FA', width: '100%', fontFamily: FONT }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: '10px', fontSize: '14px', background: '#F5F6FA', width: '100%', fontFamily: FONT }} />
          {error && <div style={{ padding: '8px 12px', background: '#FEE8EF', color: '#C0254A', borderRadius: '8px', fontSize: '13px' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ marginTop: '8px', padding: '14px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ marginTop: '24px', fontSize: '11px', color: '#C0C8D8', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONT }}>Culture · Community · Games</p>
      </div>
    </div>
  )
}

export default function ManaSocialApp() {
  const [authed, setAuthed] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(0)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<{ table: string, data?: any } | null>(null)
  const [homeOfficePct, setHomeOfficePct] = useState(10)
  const [internetPct, setInternetPct] = useState(50)
  const [showSettings, setShowSettings] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadPreview, setUploadPreview] = useState<any[]>([])
  const [uploadMode, setUploadMode] = useState<'sales' | 'expenses'>('sales')
  const [syncStatus, setSyncStatus] = useState('')
  const [acctDrilldown, setAcctDrilldown] = useState<string | null>(null)
  const salesFileRef = useRef<HTMLInputElement>(null)
  const expFileRef = useRef<HTMLInputElement>(null)

  const emptyForm = {
    label: '', amount: '', date: new Date().toISOString().split('T')[0],
    fees: '', shipping: '', notes: '', itemCount: '', category: 'Supplies & Packaging',
    miles: '', mileFrom: '', mileTo: '', milePurpose: '',
    cogsType: 'collection', cogsSet: '', cogsCost: '', cogsQty: '1',
    cogsCards: '', cogsCardsPerBox: '', cogsEstValue: '', amountPaid: '',
    userName: 'Cam', paidByCompany: true,
    assetCategory: 'Equipment', assetLife: '5',
    payPeriod: '', hoursWorked: '', hourlyRate: '16', rothEligible: '', rothContributed: '',
    bankName: 'Chase', accountType: 'Checking', accountLast4: '', bankBalance: '',
    apVendor: '', apTotal: '', apPaid: '', apDue: '',
  }
  const [formData, setFormData] = useState(emptyForm)

  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [payroll, setPayroll] = useState<any[]>([])
  const [disbursements, setDisbursements] = useState<any[]>([])
  const [mileageLog, setMileageLog] = useState<any[]>([])
  const [cogsInventory, setCogsInventory] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [accountsPayable, setAccountsPayable] = useState<any[]>([])
  const [allCogsInventory, setAllCogsInventory] = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setAuthed(!!session); setCheckingAuth(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session))
    return () => subscription.unsubscribe()
  }, [])

  const fetchData = useCallback(async () => {
    if (!authed) return
    const fd = (data: any[], key: string) => (data || []).filter(i => {
      const d = new Date(i[key])
      return d.getFullYear() === selectedYear && (selectedMonth === 0 || (d.getMonth() + 1) === selectedMonth)
    })
    const [s, e, b, p, d, ml, ci, allCI, ast, ba, ap] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('collections').select('*').order('due_date', { ascending: false }),
      supabase.from('payroll').select('*').order('pay_date', { ascending: false }),
      supabase.from('disbursements').select('*'),
      supabase.from('mileage_log').select('*').order('date', { ascending: false }),
      supabase.from('cogs_inventory').select('*').order('date', { ascending: false }),
      supabase.from('cogs_inventory').select('*').order('date', { ascending: true }),
      supabase.from('assets').select('*').order('purchase_date', { ascending: false }),
      supabase.from('bank_accounts').select('*'),
      supabase.from('accounts_payable').select('*').order('invoice_date', { ascending: false }),
    ])
    setSales(fd(s.data || [], 'sale_date'))
    setExpenses(fd(e.data || [], 'purchase_date'))
    setCollections(fd(b.data || [], 'due_date'))
    setPayroll(fd(p.data || [], 'pay_date'))
    setDisbursements(fd(d.data || [], 'disbursement_date'))
    setMileageLog((ml.data || []).filter(i => new Date(i.date).getFullYear() === selectedYear))
    setCogsInventory((ci.data || []).filter(i => new Date(i.date).getFullYear() === selectedYear))
    setAllCogsInventory(allCI.data || [])
    setAssets(ast.data || [])
    setBankAccounts(ba.data || [])
    setAccountsPayable(ap.data || [])
  }, [authed, selectedYear, selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  const gross = sales.reduce((s, r) => s + Number(r.amount), 0)
  const totalPlatformFees = sales.reduce((s, r) => s + Number(r.fees || 0), 0)
  const totalShippingExpense = sales.reduce((s, r) => s + Number(r.shipping || 0), 0)
  const totalFees = totalPlatformFees + totalShippingExpense
  const netSalesAmt = sales.reduce((s, r) => s + Number(r.net_sales || r.amount), 0)
  const expByCategory = EXPENSE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = expenses.filter(e => e.category === cat).reduce((s, r) => s + Number(r.cost), 0)
    return acc
  }, {} as Record<string, number>)
  const opExpenses = Object.values(expByCategory).reduce((a, b) => a + b, 0)
  const inventoryCosts = collections.reduce((s, r) => s + Number(r.total_cost), 0)
  const totalPaid = collections.reduce((s, r) => s + Number(r.amount_paid || 0), 0)
  const totalOwed = inventoryCosts - totalPaid
  const staffingCosts = payroll.reduce((s, r) => s + Number(r.amount), 0)
  const totalCosts = totalFees + opExpenses + inventoryCosts + staffingCosts
  const netRevenue = gross - totalCosts
  const cogsRecognized = cogsInventory.reduce((a, r) => {
    const ratio = r.total_units > 0 ? Math.min((r.sold_units || 0) / r.total_units, 1) : 0
    return a + (parseFloat(r.total_cost || 0) * ratio)
  }, 0)
  const totalMiles = mileageLog.reduce((a, r) => a + parseFloat(r.miles || 0), 0)
  const mileageDeduction = totalMiles * MILEAGE_RATE
  const totalDeductibleExpenses = expenses.reduce((a, r) => {
    const rule = DEDUCTIBILITY[r.category] || DEDUCTIBILITY['Other']
    if (rule.pct === 100) return a + Number(r.cost)
    if (rule.pct === 50) return a + Number(r.cost) * 0.5
    if (r.category === 'Home Office') return a + Number(r.cost) * (homeOfficePct / 100)
    if (r.category === 'Internet & Phone') return a + Number(r.cost) * (internetPct / 100)
    return a
  }, 0)
  const totalDeductions = totalDeductibleExpenses + mileageDeduction
  const fedSavings = totalDeductions * 0.22
  const caSavings = totalDeductions * 0.093
  const totalDepreciation = assets.reduce((a, r) => {
    const life = parseInt(r.useful_life_yrs) || USEFUL_LIFE[r.category] || 5
    const { slAnnual } = calcDepreciation(parseFloat(r.cost), life, r.purchase_date, selectedYear)
    return a + slAnnual
  }, 0)
  const totalAssetCost = assets.reduce((a, r) => a + parseFloat(r.cost || 0), 0)
  const totalAccumulatedDep = assets.reduce((a, r) => {
    const life = parseInt(r.useful_life_yrs) || USEFUL_LIFE[r.category] || 5
    const { slAccumulated } = calcDepreciation(parseFloat(r.cost), life, r.purchase_date, selectedYear)
    return a + slAccumulated
  }, 0)
  const totalBookValue = totalAssetCost - totalAccumulatedDep
  const grossMargin = netSalesAmt - cogsRecognized
  const totalOpEx = opExpenses + staffingCosts + totalPlatformFees + totalDepreciation
  const netIncome = grossMargin - totalOpEx
  const totalAPOwed = accountsPayable.reduce((a, r) => a + Math.max(0, Number(r.total_amount) - Number(r.amount_paid || 0)), 0)
  const totalCash = bankAccounts.filter(b => b.account_type !== 'Credit').reduce((a, r) => a + Number(r.current_balance || 0), 0)
  const totalCreditDebt = bankAccounts.filter(b => b.account_type === 'Credit').reduce((a, r) => a + Math.abs(Number(r.current_balance || 0)), 0)
  const endingInventory = allCogsInventory.reduce((a, r) => {
    const ratio = r.total_units > 0 ? Math.min((r.sold_units || 0) / r.total_units, 1) : 0
    return a + parseFloat(r.total_cost || 0) * (1 - ratio)
  }, 0)
  const totalCurrentAssets = totalCash + endingInventory + totalOwed
  const totalAssets = totalCurrentAssets + totalBookValue
  const totalLiabilities = totalAPOwed + totalCreditDebt
  const ownerEquity = totalAssets - totalLiabilities

  const quarters = [
    { label: 'Q1', start: '2026-01-01', end: '2026-03-31', due941: 'Apr 30', due1040: 'Apr 15' },
    { label: 'Q2', start: '2026-04-01', end: '2026-06-30', due941: 'Jul 31', due1040: 'Jun 16' },
    { label: 'Q3', start: '2026-07-01', end: '2026-09-30', due941: 'Oct 31', due1040: 'Sep 15' },
    { label: 'Q4', start: '2026-10-01', end: '2026-12-31', due941: 'Jan 31', due1040: 'Jan 15' },
  ].map(q => {
    const inQ = (arr: any[], key: string) => arr.filter(r => r[key] >= q.start && r[key] <= q.end)
    const qS = inQ(sales, 'sale_date'), qE = inQ(expenses, 'purchase_date'), qP = inQ(payroll, 'pay_date')
    const netRev = qS.reduce((a, r) => a + Number(r.amount), 0) - qS.reduce((a, r) => a + Number(r.fees || 0) + Number(r.shipping || 0), 0)
    const exp = qE.reduce((a, r) => a + Number(r.cost), 0)
    const grossPay = qP.reduce((a, r) => a + Number(r.amount), 0)
    const taxable = Math.max(0, netRev - exp - grossPay)
    const fica = grossPay * 0.153, futa = grossPay * 0.006, caUI = grossPay * 0.034
    const fedEst = taxable * 0.22, caEst = taxable * 0.093
    return { ...q, netRev, exp, grossPay, taxable, fica, futa, caUI, fedEst, caEst, grand: fica + futa + caUI + fedEst + caEst }
  })
  const ytdTax = quarters.reduce((a, q) => a + q.grand, 0)

  const buildInventoryFlow = () => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const beginningBalance = allCogsInventory.filter(r => new Date(r.date).getFullYear() < selectedYear).reduce((a, r) => a + parseFloat(r.total_cost || 0), 0)
    let running = beginningBalance
    const flow: { label: string, amount: number, isAddition: boolean }[] = []
    if (beginningBalance > 0) flow.push({ label: `Beginning Inventory — Jan 1 ${selectedYear}`, amount: beginningBalance, isAddition: true })
    for (let m = 0; m < 12; m++) {
      const mRows = allCogsInventory.filter(r => { const d = new Date(r.date); return d.getFullYear() === selectedYear && d.getMonth() === m })
      const purchased = mRows.reduce((a, r) => a + parseFloat(r.total_cost || 0), 0)
      const cogs = mRows.reduce((a, r) => { const ratio = r.total_units > 0 ? Math.min((r.sold_units || 0) / r.total_units, 1) : 0; return a + parseFloat(r.total_cost || 0) * ratio }, 0)
      if (purchased > 0) { running += purchased; flow.push({ label: `${months[m]} — Purchases`, amount: purchased, isAddition: true }) }
      if (cogs > 0) { running -= cogs; flow.push({ label: `${months[m]} — Cost of Goods Sold`, amount: cogs, isAddition: false }) }
    }
    return { flow, endingBalance: running }
  }
  const { flow: inventoryFlow, endingBalance } = buildInventoryFlow()

  const card: React.CSSProperties = { background: C.white, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const inp: React.CSSProperties = { padding: '13px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, fontSize: '15px', width: '100%', background: '#F5F6FA', boxSizing: 'border-box', fontFamily: FONT }
  const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: C.muted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: FONT }
  const editBtn: React.CSSProperties = { background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: C.muted, cursor: 'pointer', fontFamily: FONT }
  const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '18px', fontFamily: FONT }
  const secHdr: React.CSSProperties = { fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', fontFamily: FONT, display: 'block' }

  const handleFileUpload = async (file: File, mode: 'sales' | 'expenses') => {
    setUploadMode(mode); setUploadPreview([])
    if (mode === 'sales') {
      const isTCG = file.name.toLowerCase().includes('tcgplayer') || /SellerTaxReport/i.test(file.name)
      const isEbay = file.name.toLowerCase().includes('ebay') || file.name.toLowerCase().includes('listing')
      const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
      const isCSV = file.name.endsWith('.csv')
      if (isXLSX && (isTCG || !isEbay)) {
        setUploadStatus('Parsing TCGplayer report...')
        try {
          const { records, meta } = await parseTCGplayerXLSX(file)
          setUploadPreview(records.map(r => ({ ...r, _displayLabel: `TCGplayer · ${meta.periodStart} – ${meta.periodEnd}`, _meta: meta })))
          setUploadStatus(`TCGplayer: ${meta.periodStart} – ${meta.periodEnd} · ${meta.numOrders} orders · ${meta.entity === 'llc' ? 'LLC' : 'Sole Prop'} · Gross ${fmt(meta.grossSales)} · Fees ${fmt(meta.derivedFees)} · Net ${fmt(meta.netSales)}`)
        } catch (err: any) { setUploadStatus('Error: ' + err.message) }
        return
      }
      if (isCSV && (isEbay || file.name.toLowerCase().includes('listing'))) {
        setUploadStatus('Parsing eBay report...')
        try {
          const { records, meta } = await parseEbayCSV(file)
          setUploadPreview(records.map(r => ({ ...r, _displayLabel: `eBay · ${meta.rows} listings`, _meta: meta })))
          setUploadStatus(`eBay: ${meta.rows} listings · Gross ${fmt(meta.totalGross)} · Fees ${fmt(meta.totalFees)} · Net ${fmt(meta.totalNet)}`)
        } catch (err: any) { setUploadStatus('Error: ' + err.message) }
        return
      }
    }
    setUploadStatus('Reading file with AI...')
    const results = await parseFileWithAI(file, mode)
    if (!results.length) { setUploadStatus('Could not extract data.'); return }
    setUploadPreview(results)
    setUploadStatus(`Found ${results.length} item(s) — review and confirm`)
  }

  const confirmUpload = async () => {
    setUploadStatus('Saving...')
    if (uploadMode === 'sales') {
      const inserts = uploadPreview.map(r => ({ platform: r.platform || 'other', amount: parseFloat(r.amount) || 0, fees: parseFloat(r.fees) || 0, shipping: parseFloat(r.shipping) || 0, sale_date: r.sale_date || r.date || new Date().toISOString().split('T')[0], period_start: r.period_start || r.sale_date || new Date().toISOString().split('T')[0], period_end: r.period_end || r.sale_date || new Date().toISOString().split('T')[0], entity: r.entity || getEntity(r.sale_date || new Date().toISOString().split('T')[0]), net_sales: parseFloat(r.net_sales) || 0, num_orders: parseInt(r.num_orders) || 0 }))
      const { error } = await supabase.from('sales').insert(inserts)
      if (error) { setUploadStatus('Error: ' + error.message); return }
    } else {
      const inserts = uploadPreview.map(r => ({ category: r.category || 'Other', cost: parseFloat(r.cost) || 0, purchase_date: r.date || new Date().toISOString().split('T')[0], notes: r.notes || '', entity: getEntity(r.date || new Date().toISOString().split('T')[0]), user_name: 'Cam', paid_by_company: true }))
      const { error } = await supabase.from('expenses').insert(inserts)
      if (error) { setUploadStatus('Error: ' + error.message); return }
    }
    setUploadPreview([]); setUploadStatus('Saved!'); fetchData()
    setTimeout(() => setUploadStatus(''), 3000)
  }

  const syncManaPool = async () => {
    setSyncStatus('Syncing ManaPool...')
    try {
      const res = await fetch('/api/sync-manapool')
      const data = await res.json()
      if (data.error) setSyncStatus('Error: ' + data.error)
      else { setSyncStatus(data.message || 'Synced'); fetchData() }
    } catch { setSyncStatus('Sync failed') }
    setTimeout(() => setSyncStatus(''), 6000)
  }

  const handleSave = async () => {
    const t = editingItem?.table
    if (!t) return
    let payload: any = {}
    if (t === 'sales') {
      if (!formData.amount || !formData.label) return alert('Missing fields')
      payload = { platform: formData.label, amount: Number(formData.amount), fees: Number(formData.fees || 0), shipping: Number(formData.shipping || 0), sale_date: formData.date, period_start: formData.date, period_end: formData.date, entity: getEntity(formData.date), net_sales: Number(formData.amount) - Number(formData.fees || 0), num_orders: 1 }
    } else if (t === 'collections') {
      if (!formData.amount || !formData.label) return alert('Missing fields')
      payload = { seller_name: formData.label, total_cost: Number(formData.amount), amount_paid: Number(formData.amountPaid || 0), notes: `Qty: ${formData.itemCount} | ${formData.notes}`, due_date: formData.date, entity: getEntity(formData.date) }
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
      payload = { date: formData.date, purpose: formData.milePurpose, from_location: formData.mileFrom, to_location: formData.mileTo, miles: parseFloat(formData.miles) || 0 }
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
    } else if (t === 'accounts_payable') {
      if (!formData.apTotal || !formData.apVendor) return alert('Missing fields')
      payload = { vendor_name: formData.apVendor, description: formData.label, invoice_date: formData.date, due_date: formData.apDue || formData.date, total_amount: Number(formData.apTotal), amount_paid: Number(formData.apPaid || 0), entity: getEntity(formData.date), notes: formData.notes }
    }
    if (editingItem.data?.id) {
      const { error } = await supabase.from(t).update(payload).eq('id', editingItem.data.id)
      if (error) return alert(error.message)
    } else {
      const { error } = await supabase.from(t).insert([payload])
      if (error) return alert(error.message)
    }
    setEditingItem(null); setFormData(emptyForm); fetchData()
  }

  const startEdit = (table: string, row: any) => {
    const pre: any = { ...emptyForm, date: row.sale_date || row.purchase_date || row.due_date || row.pay_date || row.disbursement_date || row.date || emptyForm.date }
    if (table === 'sales') { pre.label = row.platform; pre.amount = String(row.amount); pre.fees = String(row.fees || 0); pre.shipping = String(row.shipping || 0) }
    else if (table === 'collections') { pre.label = row.seller_name; pre.amount = String(row.total_cost); pre.amountPaid = String(row.amount_paid || 0); pre.notes = row.notes || '' }
    else if (table === 'expenses') { pre.label = row.notes || ''; pre.amount = String(row.cost); pre.category = row.category || 'Other'; pre.userName = row.user_name || 'Cam'; pre.paidByCompany = row.paid_by_company ?? true }
    else if (table === 'payroll') { pre.label = row.employee_name; pre.amount = String(row.amount); pre.hoursWorked = String(row.hours_worked || ''); pre.hourlyRate = String(row.hourly_rate || 16); pre.payPeriod = row.pay_period || '' }
    else if (table === 'disbursements') { pre.label = row.recipient; pre.amount = String(row.amount); pre.notes = row.notes || '' }
    else if (table === 'assets') { pre.label = row.description; pre.amount = String(row.cost); pre.assetCategory = row.category || 'Equipment'; pre.assetLife = String(row.useful_life_yrs || 5); pre.notes = row.notes || ''; pre.userName = row.user_name || 'Cam' }
    else if (table === 'bank_accounts') { pre.bankName = row.bank_name; pre.accountType = row.account_type; pre.accountLast4 = row.account_last4 || ''; pre.bankBalance = String(row.current_balance || 0); pre.notes = row.notes || '' }
    else if (table === 'accounts_payable') { pre.apVendor = row.vendor_name; pre.label = row.description || ''; pre.apTotal = String(row.total_amount); pre.apPaid = String(row.amount_paid || 0); pre.apDue = row.due_date || ''; pre.notes = row.notes || '' }
    setFormData(pre); setEditingItem({ table, data: row })
  }

  const handleUpdatePaid = async (id: string, amount_paid: number) => { await supabase.from('collections').update({ amount_paid }).eq('id', id); fetchData() }
  const handleUpdateSold = async (id: string, sold_units: number) => { await supabase.from('cogs_inventory').update({ sold_units }).eq('id', id); fetchData() }
  const handleDelete = async (table: string, id: string) => { if (!confirm('Delete?')) return; await supabase.from(table).delete().eq('id', id); fetchData() }
  const signOut = async () => { await supabase.auth.signOut() }

  const renderUploadPreview = () => {
    if (!uploadPreview.length && !uploadStatus) return null
    return (
      <div style={{ ...card, border: `1px solid ${C.teal}` }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.teal, marginBottom: '8px', textTransform: 'uppercase' }}>Import Preview</div>
        {uploadStatus && <div style={{ fontSize: '13px', color: C.muted, marginBottom: '8px' }}>{uploadStatus}</div>}
        {uploadPreview.map((r, i) => (
          <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700 }}>{r._displayLabel || (uploadMode === 'sales' ? r.platform : r.category)} · {r.sale_date || r.date || '?'}</span>
              <span style={{ fontWeight: 700, color: uploadMode === 'sales' ? C.green : '#ef4444' }}>{fmt(uploadMode === 'sales' ? (r.amount || 0) : -(r.cost || 0))}</span>
            </div>
            {uploadMode === 'sales' && r.fees != null && (
              <div style={{ fontSize: '12px', color: C.muted, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span>Gross: {fmt(r.amount || 0)}</span><span>Fees: {fmt(r.fees || 0)}</span>
                <span>Shipping: {fmt(r.shipping || 0)}</span><span>Net: {fmt(r.net_sales || 0)}</span>
                {r.entity && <span style={{ color: r.entity === 'llc' ? C.teal : C.gold }}>{r.entity === 'llc' ? 'LLC' : 'Sole Prop'}</span>}
              </div>
            )}
          </div>
        ))}
        {uploadPreview.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={confirmUpload} style={{ padding: '10px 18px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Save all</button>
            <button onClick={() => { setUploadPreview([]); setUploadStatus('') }} style={{ padding: '10px 14px', background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.muted, cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Cancel</button>
          </div>
        )}
      </div>
    )
  }

  const renderForm = () => {
    if (!editingItem) return null
    const t = editingItem.table
    const isEditing = !!editingItem.data?.id
    const cogsPreview = () => {
      const cost = parseFloat(formData.cogsCost) || 0, qty = parseInt(formData.cogsQty) || 1, total = cost * qty
      const units = formData.cogsType === 'collection' ? parseInt(formData.cogsCards) || 0 : ['booster_box','precon'].includes(formData.cogsType) ? (parseInt(formData.cogsCardsPerBox) || 0) * qty : qty
      return { total, units, cpu: units > 0 ? total / units : 0 }
    }
    return (
      <div style={{ ...card, border: `1px solid ${C.teal}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontWeight: 900, color: C.navy, fontSize: '16px', fontFamily: FONT }}>{isEditing ? 'EDIT' : 'ADD'} {t.replace(/_/g,' ').toUpperCase()}</h2>
          <button onClick={() => { setEditingItem(null); setFormData(emptyForm) }} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {t !== 'bank_accounts' && <div><span style={lbl}>Date</span><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} style={inp} /></div>}
          {!['mileage_log','cogs_inventory','assets','bank_accounts','accounts_payable'].includes(t) && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', fontFamily: FONT, background: getEntity(formData.date) === 'sole_prop' ? 'rgba(240,192,64,0.12)' : 'rgba(45,191,184,0.1)', color: getEntity(formData.date) === 'sole_prop' ? '#7A5A00' : '#1A7A75' }}>
              {getEntity(formData.date) === 'sole_prop' ? 'Camera Pho (Sole Prop)' : 'Mana Social LLC'}
            </div>
          )}
          {t === 'assets' && <>
            <div><span style={lbl}>Category</span>
              <select value={formData.assetCategory} onChange={e => setFormData({ ...formData, assetCategory: e.target.value, assetLife: String(USEFUL_LIFE[e.target.value] || 5) })} style={inp}>
                {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><span style={lbl}>Description</span><input value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="e.g. Epson DS-530 II Scanner" style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Cost ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" style={inp} /></div>
              <div><span style={lbl}>Tax Paid ($)</span><input type="number" step="0.01" value={formData.fees} onChange={e => setFormData({ ...formData, fees: e.target.value })} placeholder="0.00" style={inp} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Useful Life (yrs)</span><input type="number" value={formData.assetLife} onChange={e => setFormData({ ...formData, assetLife: e.target.value })} style={inp} /></div>
              <div><span style={lbl}>Purchased By</span>
                <select value={formData.userName} onChange={e => setFormData({ ...formData, userName: e.target.value })} style={inp}>
                  <option value="Cam">Cam</option><option value="Kenny">Kenny</option>
                </select>
              </div>
            </div>
            {formData.amount && (() => { const cost = parseFloat(formData.amount)||0, life = parseInt(formData.assetLife)||5, sl = cost/life; return (<div style={{ padding:'10px',borderRadius:'8px',background:'rgba(45,191,184,0.08)',fontSize:'13px',color:'#1A7A75',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px' }}><span>Sec 179: <strong>{fmt(cost)}</strong></span><span>SL/yr: <strong>{fmt(sl)}</strong></span><span>Life: <strong>{life} yrs</strong></span><span>Yr 1 book: <strong>{fmt(cost-sl)}</strong></span></div>) })()}
            <div><span style={lbl}>Notes / PO#</span><input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Order number or notes" style={inp} /></div>
          </>}
          {t === 'bank_accounts' && <>
            <div><span style={lbl}>Bank</span>
              <select value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} style={inp}>
                <option value="Chase">Chase</option><option value="Wells Fargo">Wells Fargo</option>
              </select>
            </div>
            <div><span style={lbl}>Account Type</span>
              <select value={formData.accountType} onChange={e => setFormData({ ...formData, accountType: e.target.value })} style={inp}>
                <option value="Checking">Checking</option><option value="Savings">Savings</option><option value="Credit">Credit Card</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Last 4</span><input value={formData.accountLast4} onChange={e => setFormData({ ...formData, accountLast4: e.target.value })} placeholder="2035" style={inp} /></div>
              <div><span style={lbl}>As of Date</span><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} style={inp} /></div>
            </div>
            <div><span style={lbl}>Current Balance ($)</span><input type="number" step="0.01" value={formData.bankBalance} onChange={e => setFormData({ ...formData, bankBalance: e.target.value })} placeholder="0.00" style={inp} /></div>
            <div><span style={lbl}>Notes</span><input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="e.g. Chase Ink Business" style={inp} /></div>
          </>}
          {t === 'accounts_payable' && <>
            <div><span style={lbl}>Vendor / Seller Name</span><input value={formData.apVendor} onChange={e => setFormData({ ...formData, apVendor: e.target.value })} placeholder="e.g. Oscar Espinosa" style={inp} /></div>
            <div><span style={lbl}>Description</span><input value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="e.g. Collection purchase" style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Invoice Date</span><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} style={inp} /></div>
              <div><span style={lbl}>Due Date</span><input type="date" value={formData.apDue} onChange={e => setFormData({ ...formData, apDue: e.target.value })} style={inp} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Total Amount ($)</span><input type="number" step="0.01" value={formData.apTotal} onChange={e => setFormData({ ...formData, apTotal: e.target.value })} placeholder="0.00" style={inp} /></div>
              <div><span style={lbl}>Amount Paid ($)</span><input type="number" step="0.01" value={formData.apPaid} onChange={e => setFormData({ ...formData, apPaid: e.target.value })} placeholder="0.00" style={inp} /></div>
            </div>
            <div><span style={lbl}>Notes</span><textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Payment terms, context" style={{ ...inp, height: '60px', resize: 'vertical' }} /></div>
          </>}
          {t === 'mileage_log' && <>
            <div><span style={lbl}>Business Purpose</span><input value={formData.milePurpose} onChange={e => setFormData({ ...formData, milePurpose: e.target.value })} placeholder="e.g. USPS drop-off, card show" style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>From</span><input value={formData.mileFrom} onChange={e => setFormData({ ...formData, mileFrom: e.target.value })} placeholder="Home" style={inp} /></div>
              <div><span style={lbl}>To</span><input value={formData.mileTo} onChange={e => setFormData({ ...formData, mileTo: e.target.value })} placeholder="USPS Moreno Valley" style={inp} /></div>
            </div>
            <div><span style={lbl}>Miles</span><input type="number" step="0.1" value={formData.miles} onChange={e => setFormData({ ...formData, miles: e.target.value })} placeholder="0.0" style={inp} /></div>
            {formData.miles && <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(45,191,184,0.08)', fontSize: '14px', color: '#1A7A75' }}>Deduction: <strong>{fmt(parseFloat(formData.miles)*MILEAGE_RATE)}</strong></div>}
          </>}
          {t === 'cogs_inventory' && <>
            <div><span style={lbl}>Inventory Type</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {[['collection','Collection'],['booster_box','Box'],['precon','Precon'],['sealed','Sealed'],['singles','Singles']].map(([id,l]) => (
                  <button key={id} onClick={() => setFormData({ ...formData, cogsType: id })} style={{ padding: '8px', borderRadius: '8px', border: `1px solid ${formData.cogsType===id?C.teal:C.border}`, background: formData.cogsType===id?'rgba(45,191,184,0.1)':'#F5F6FA', fontSize: '12px', fontWeight: formData.cogsType===id?'bold':'normal', cursor: 'pointer', color: formData.cogsType===id?'#1A7A75':C.text, fontFamily: FONT }}>{l}</button>
                ))}
              </div>
            </div>
            <div><span style={lbl}>Description</span><input value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="e.g. Renly's collection" style={inp} /></div>
            <div><span style={lbl}>Set / Product</span><input value={formData.cogsSet} onChange={e => setFormData({ ...formData, cogsSet: e.target.value })} placeholder="e.g. Edge of Eternities" style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Purchase Price ($)</span><input type="number" step="0.01" value={formData.cogsCost} onChange={e => setFormData({ ...formData, cogsCost: e.target.value })} placeholder="0.00" style={inp} /></div>
              <div><span style={lbl}>Quantity</span><input type="number" value={formData.cogsQty} onChange={e => setFormData({ ...formData, cogsQty: e.target.value })} placeholder="1" style={inp} /></div>
            </div>
            {formData.cogsType==='collection' && <div><span style={lbl}>Total Card Count</span><input type="number" value={formData.cogsCards} onChange={e => setFormData({ ...formData, cogsCards: e.target.value })} placeholder="e.g. 200" style={inp} /></div>}
            {['booster_box','precon'].includes(formData.cogsType) && <div><span style={lbl}>Cards Per Unit</span>
              <select value={formData.cogsCardsPerBox} onChange={e => setFormData({ ...formData, cogsCardsPerBox: e.target.value })} style={inp}>
                <option value="">Select...</option>
                <option value="540">MTG Draft Box (540)</option><option value="360">MTG Set/Play Box (360)</option>
                <option value="150">MTG Collector Box (150)</option><option value="100">MTG Commander Precon (100)</option>
                <option value="360">Pokemon Box (360)</option><option value="60">Pokemon Starter (60)</option><option value="240">YGO Box (240)</option>
              </select>
            </div>}
            <div><span style={lbl}>Est. Sell Value ($)</span><input type="number" step="0.01" value={formData.cogsEstValue} onChange={e => setFormData({ ...formData, cogsEstValue: e.target.value })} placeholder="0.00" style={inp} /></div>
            {formData.cogsCost && (() => { const p = cogsPreview(); return (<div style={{ padding:'10px',borderRadius:'8px',background:'rgba(45,191,184,0.08)',fontSize:'14px',color:'#1A7A75',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px' }}><span>Total: <strong>{fmt(p.total)}</strong></span><span>Units: <strong>{p.units.toLocaleString()}</strong></span><span>Per unit: <strong>${p.cpu.toFixed(3)}</strong></span>{formData.cogsEstValue&&<span>Margin: <strong>{p.total>0?(((parseFloat(formData.cogsEstValue)-p.total)/p.total)*100).toFixed(1)+'%':'—'}</strong></span>}</div>) })()}
          </>}
          {!['mileage_log','cogs_inventory','assets','bank_accounts','accounts_payable'].includes(t) && <>
            {t==='expenses' ? <>
              <div><span style={lbl}>Category</span>
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} style={inp}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><span style={lbl}>Description</span><input value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="Vendor / item purchased" style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><span style={lbl}>Paid By</span>
                  <select value={formData.userName} onChange={e => setFormData({ ...formData, userName: e.target.value })} style={inp}>
                    <option value="Cam">Cam</option><option value="Kenny">Kenny</option>
                  </select>
                </div>
                <div><span style={lbl}>Reimbursed by LLC</span>
                  <select value={String(formData.paidByCompany)} onChange={e => setFormData({ ...formData, paidByCompany: e.target.value === 'true' })} style={inp}>
                    <option value="true">Yes — Company paid</option><option value="false">No — Personal funds</option>
                  </select>
                </div>
              </div>
            </> : <div><span style={lbl}>{t==='sales'?'Platform':t==='collections'?'Seller Name':t==='payroll'?'Employee':'Recipient'}</span><input value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="..." style={inp} /></div>}
            <div><span style={lbl}>Amount ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" style={inp} /></div>
            {t==='collections' && <>
              <div><span style={lbl}>Amount Paid So Far ($)</span><input type="number" step="0.01" value={formData.amountPaid} onChange={e => setFormData({ ...formData, amountPaid: e.target.value })} placeholder="0.00" style={inp} /></div>
              <div><span style={lbl}>Card Count</span><input type="number" value={formData.itemCount} onChange={e => setFormData({ ...formData, itemCount: e.target.value })} placeholder="# of cards" style={inp} /></div>
            </>}
            {t==='sales' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Fees ($)</span><input type="number" step="0.01" value={formData.fees} onChange={e => setFormData({ ...formData, fees: e.target.value })} placeholder="0.00" style={inp} /></div>
              <div><span style={lbl}>Shipping Cost ($)</span><input type="number" step="0.01" value={formData.shipping} onChange={e => setFormData({ ...formData, shipping: e.target.value })} placeholder="0.00" style={inp} /></div>
            </div>}
            {t==='payroll' && <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><span style={lbl}>Hours Worked</span><input type="number" step="0.5" value={formData.hoursWorked} onChange={e => setFormData({ ...formData, hoursWorked: e.target.value })} placeholder="10" style={inp} /></div>
                <div><span style={lbl}>Hourly Rate ($)</span><input type="number" step="0.01" value={formData.hourlyRate} onChange={e => setFormData({ ...formData, hourlyRate: e.target.value })} placeholder="16.00" style={inp} /></div>
              </div>
              <div><span style={lbl}>Pay Period End Date</span><input type="date" value={formData.payPeriod} onChange={e => setFormData({ ...formData, payPeriod: e.target.value })} style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><span style={lbl}>Roth IRA Eligible ($)</span><input type="number" step="0.01" value={formData.rothEligible} onChange={e => setFormData({ ...formData, rothEligible: e.target.value })} placeholder="0.00" style={inp} /></div>
                <div><span style={lbl}>Roth IRA Contributed ($)</span><input type="number" step="0.01" value={formData.rothContributed} onChange={e => setFormData({ ...formData, rothContributed: e.target.value })} placeholder="0.00" style={inp} /></div>
              </div>
            </>}
            {['collections','disbursements'].includes(t) && <div><span style={lbl}>Notes</span><textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Internal notes" style={{ ...inp, height: '70px', resize: 'vertical' }} /></div>}
          </>}
          <button onClick={handleSave} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', padding: '16px', borderRadius: '12px', fontWeight: 900, border: 'none', fontSize: '16px', cursor: 'pointer', marginTop: '4px', fontFamily: FONT }}>
            {isEditing ? 'UPDATE RECORD' : 'SAVE RECORD'}
          </button>
        </div>
      </div>
    )
  }

  const PLRow = ({ label, value, indent = false, bold = false, isNegative = false, showDrilldown = false, drillId = '' }: any) => (
    <div onClick={showDrilldown ? () => setAcctDrilldown(acctDrilldown === drillId ? null : drillId) : undefined}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${bold ? '12px' : '8px'} 0`, borderBottom: `1px solid ${C.border}`, paddingLeft: indent ? '16px' : '0', cursor: showDrilldown ? 'pointer' : 'default', background: showDrilldown && acctDrilldown === drillId ? 'rgba(45,191,184,0.04)' : 'transparent' }}>
      <span style={{ fontSize: bold ? '15px' : '14px', fontWeight: bold ? 700 : 400, color: bold ? C.navy : C.text, fontFamily: FONT }}>
        {showDrilldown && '▸ '}{label}
      </span>
      <span style={{ fontSize: bold ? '16px' : '14px', fontWeight: bold ? 700 : 400, color: (value < 0 || isNegative) ? '#ef4444' : (bold && value > 0 ? C.green : C.text), fontFamily: FONT }}>
        {(value < 0 || isNegative) ? `(${fmt(Math.abs(value))})` : fmt(Math.abs(value))}
      </span>
    </div>
  )

  const DD = ({ children }: any) => <div style={{ background: '#F5F6FA', borderRadius: '8px', padding: '10px', marginBottom: '4px' }}>{children}</div>
  const DDRow = ({ label, value, neg = false }: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: neg ? '#ef4444' : C.green }}>{neg ? `(${fmt(value)})` : fmt(value)}</span>
    </div>
  )

  const renderTab = () => {
    switch (activeTab) {
      case 'summary': return (
        <div>
          <div style={{ background: `linear-gradient(135deg,${C.navyDark},${C.navy})`, color: '#fff', padding: '28px', borderRadius: '20px', marginBottom: '12px', fontFamily: FONT }}>
            <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>GROSS REVENUE</div>
            <div style={{ fontSize: '32px', fontWeight: 900, marginBottom: '16px' }}>{fmtK(gross)}</div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', marginBottom: '16px' }} />
            <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>TOTAL COSTS</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#fda4af', marginBottom: '16px' }}>{fmtK(-totalCosts)}</div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', marginBottom: '16px' }} />
            <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>NET REVENUE</div>
            <div style={{ fontSize: '46px', fontWeight: 900, color: netRevenue >= 0 ? '#4ade80' : '#fda4af' }}>{fmtK(netRevenue)}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            {[{ label: 'Gross Margin %', value: pctFmt(grossMargin, netSalesAmt), color: grossMargin >= 0 ? C.teal : C.pink },
              { label: 'Net Margin %',   value: pctFmt(netIncome, netSalesAmt),   color: netIncome >= 0 ? C.teal : C.pink },
              { label: 'COGS Ratio',     value: pctFmt(cogsRecognized, netSalesAmt), color: C.purple },
              { label: 'OpEx Ratio',     value: pctFmt(totalOpEx, netSalesAmt),   color: C.gold }
            ].map(t => (
              <div key={t.label} style={{ ...card, padding: '14px', marginBottom: 0, textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>{t.label}</div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: t.color }}>{t.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            {[['Selling Fees', fmt(-totalPlatformFees)], ['Op. Expenses', fmt(-opExpenses)], ['Inventory A/P', fmt(-inventoryCosts)], ['Payroll', fmt(-staffingCosts)]].map(([l, v]) => (
              <div key={String(l)} style={{ ...card, padding: '14px', marginBottom: 0 }}>
                <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>{l}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#fda4af' }}>{v}</div>
              </div>
            ))}
          </div>
          {totalOwed > 0 && (
            <div style={{ ...card, background: 'rgba(240,192,64,0.08)', border: '1px solid rgba(240,192,64,0.3)' }}>
              <div style={{ fontSize: '11px', color: '#7A5A00', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '8px' }}>OUTSTANDING COLLECTION BALANCE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div><div style={{ fontSize: '12px', color: C.muted }}>Total</div><div style={{ fontSize: '20px', fontWeight: 700 }}>{fmt(inventoryCosts)}</div></div>
                <div><div style={{ fontSize: '12px', color: C.muted }}>Paid</div><div style={{ fontSize: '20px', fontWeight: 700, color: C.teal }}>{fmt(totalPaid)}</div></div>
                <div><div style={{ fontSize: '12px', color: C.muted }}>Remaining</div><div style={{ fontSize: '20px', fontWeight: 700, color: C.pink }}>{fmt(totalOwed)}</div></div>
              </div>
            </div>
          )}
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>SOLE PROP</div><div style={{ fontSize: '14px', fontWeight: 700, color: C.gold }}>Jan 1 – Mar 17</div></div>
            <div style={{ color: C.border, fontSize: '20px' }}>→</div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>MANA SOCIAL LLC</div><div style={{ fontSize: '14px', fontWeight: 700, color: C.teal }}>Mar 18 – Dec 31</div></div>
          </div>
        </div>
      )

      case 'income': return (
        <div>
          <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>NET SALES</div>
            <div style={{ fontSize: '30px', fontWeight: 900, color: '#4ade80' }}>{fmt(gross - totalFees)}</div>
            <div style={{ fontSize: '13px', opacity: 0.5, marginTop: '2px' }}>Gross {fmt(gross)} · Fees {fmt(-totalFees)}</div>
          </div>
          <div style={{ ...card, padding: '14px' }}>
            <span style={secHdr}>IMPORT SALES</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <button onClick={() => salesFileRef.current?.click()} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${C.border}`, background: '#F5F6FA', fontSize: '14px', fontWeight: 'bold', color: C.navy, cursor: 'pointer', fontFamily: FONT }}>Upload file</button>
              <button onClick={syncManaPool} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${C.teal}`, background: 'rgba(45,191,184,0.08)', fontSize: '14px', fontWeight: 'bold', color: C.teal, cursor: 'pointer', fontFamily: FONT }}>Sync ManaPool</button>
            </div>
            <input ref={salesFileRef} type="file" accept="image/*,.pdf,.csv,.xlsx,.xls" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'sales'); e.target.value = '' }} />
            <div style={{ fontSize: '12px', color: C.muted }}>TCGplayer .xlsx · eBay .csv · ManaPool .csv · photos · PDFs</div>
            {syncStatus && <div style={{ marginTop: '8px', fontSize: '13px', color: C.teal }}>{syncStatus}</div>}
          </div>
          {renderUploadPreview()}
          {sales.map(s => (
            <div key={s.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '2px', fontSize: '15px' }}>{s.platform}</div>
                <div style={{ fontSize: '13px', color: C.muted }}>{s.sale_date} · Fees {fmt(Number(s.fees||0)+Number(s.shipping||0))}</div>
                {s.period_start && s.period_start !== s.sale_date && <div style={{ fontSize: '12px', color: C.muted }}>Period: {s.period_start} – {s.period_end}</div>}
                {s.num_orders > 0 && <div style={{ fontSize: '12px', color: C.muted }}>{s.num_orders} orders</div>}
                <div style={{ fontSize: '12px', color: s.entity === 'llc' ? C.teal : C.gold }}>{s.entity === 'llc' ? 'LLC' : 'Sole Prop'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, color: C.green, fontSize: '17px' }}>{fmt(Number(s.amount))}</span>
                <button onClick={() => startEdit('sales', s)} style={editBtn}>Edit</button>
                <button onClick={() => handleDelete('sales', s.id)} style={delBtn}>×</button>
              </div>
            </div>
          ))}
          {sales.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No sales this period</div>}
        </div>
      )

      case 'expense': return (
        <div>
          <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL EXPENSES</div>
            <div style={{ fontSize: '30px', fontWeight: 900, color: '#fda4af' }}>{fmt(opExpenses + inventoryCosts)}</div>
          </div>
          <div style={{ ...card, padding: '14px' }}>
            <span style={secHdr}>IMPORT EXPENSES</span>
            <button onClick={() => expFileRef.current?.click()} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${C.border}`, background: '#F5F6FA', fontSize: '14px', fontWeight: 'bold', color: C.navy, cursor: 'pointer', fontFamily: FONT }}>Upload receipt / file / photo</button>
            <input ref={expFileRef} type="file" accept="image/*,.pdf,.csv,.xlsx,.xls" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'expenses'); e.target.value = '' }} />
            <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px' }}>Photo a receipt or upload CSV/PDF — AI extracts and categorizes</div>
          </div>
          {renderUploadPreview()}
          {totalOwed > 0 && (
            <div style={{ ...card, background: 'rgba(240,192,64,0.08)', border: '1px solid rgba(240,192,64,0.3)', padding: '14px 16px' }}>
              <div style={{ fontSize: '12px', color: '#7A5A00', fontWeight: 'bold', marginBottom: '10px' }}>COLLECTION PAYMENT TRACKER</div>
              {collections.map(b => {
                const paid = Number(b.amount_paid||0), owed = Number(b.total_cost)-paid
                const p = Number(b.total_cost) > 0 ? (paid/Number(b.total_cost)*100) : 0
                return (
                  <div key={b.id} style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid rgba(240,192,64,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '15px' }}>{b.seller_name}</span>
                      <span style={{ fontSize: '14px', color: owed > 0 ? C.pink : C.teal, fontWeight: 700 }}>{owed > 0 ? `${fmt(owed)} left` : 'Paid off'}</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(27,42,74,0.1)', borderRadius: '3px', marginBottom: '6px' }}>
                      <div style={{ height: '100%', width: `${Math.min(p,100)}%`, background: p>=100?C.teal:C.gold, borderRadius: '3px', transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: C.muted }}>
                      <span>Paid: {fmt(paid)}</span><span>Total: {fmt(Number(b.total_cost))}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <span style={{ fontSize: '13px', color: C.muted }}>Update paid:</span>
                      <input type="number" step="0.01" min="0" max={b.total_cost} value={paid} onChange={e => handleUpdatePaid(b.id, parseFloat(e.target.value)||0)} style={{ ...inp, width: '110px', padding: '5px 8px', fontSize: '14px' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {expenses.map(e => (
            <div key={e.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '2px', fontSize: '15px' }}>{e.category}</div>
                {e.notes && <div style={{ fontSize: '13px', color: C.muted }}>{e.notes}</div>}
                <div style={{ fontSize: '13px', color: C.muted }}>{e.purchase_date}</div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                  {DEDUCTIBILITY[e.category] && <div style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '4px', background: DEDUCTIBILITY[e.category].pct===100?'#E1F5EE':'#FEF3E2', color: DEDUCTIBILITY[e.category].pct===100?'#085041':'#7A5A00' }}>{DEDUCTIBILITY[e.category].label}</div>}
                  <div style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '4px', background: e.paid_by_company?'rgba(16,185,129,0.12)':'rgba(240,192,64,0.15)', color: e.paid_by_company?'#085041':'#7A5A00' }}>
                    {e.user_name||'Cam'}{e.paid_by_company?' — LLC paid':' — personal funds'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '17px' }}>{fmt(-Number(e.cost))}</span>
                <button onClick={() => startEdit('expenses', e)} style={editBtn}>Edit</button>
                <button onClick={() => handleDelete('expenses', e.id)} style={delBtn}>×</button>
              </div>
            </div>
          ))}
          {collections.map(b => (
            <div key={b.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '2px', fontSize: '15px' }}>{b.seller_name} <span style={{ fontSize: '13px', color: C.muted, fontWeight: 'normal' }}>(Collection)</span></div>
                {b.notes && <div style={{ fontSize: '13px', color: C.muted }}>{b.notes}</div>}
                <div style={{ fontSize: '13px', color: C.muted }}>{b.due_date}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '17px' }}>{fmt(-Number(b.total_cost))}</span>
                <button onClick={() => startEdit('collections', b)} style={editBtn}>Edit</button>
                <button onClick={() => handleDelete('collections', b.id)} style={delBtn}>×</button>
              </div>
            </div>
          ))}
          {expenses.length===0&&collections.length===0 && <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No expenses this period</div>}
        </div>
      )

      case 'cogs': return (
        <div>
          <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>INVENTORY PURCHASED</div>
            <div style={{ fontSize: '30px', fontWeight: 900 }}>{fmt(cogsInventory.reduce((a,r)=>a+parseFloat(r.total_cost||0),0))}</div>
            <div style={{ fontSize: '14px', color: '#fda4af', marginTop: '4px' }}>COGS recognized: {fmt(cogsRecognized)}</div>
          </div>
          {(() => { const ci=cogsInventory.filter(r=>['collection','booster_box','precon','singles'].includes(r.inventory_type)); const tC=ci.reduce((a,r)=>a+parseFloat(r.total_cost||0),0); const tU=ci.reduce((a,r)=>a+parseInt(r.total_units||0),0); return tU>0?(<div style={{...card,textAlign:'center',padding:'14px'}}><div style={{fontSize:'12px',color:C.muted,marginBottom:'4px'}}>BLENDED AVG COST / CARD</div><div style={{fontSize:'30px',fontWeight:900,color:C.purple}}>${(tC/tU).toFixed(3)}</div><div style={{fontSize:'13px',color:C.muted}}>{tU.toLocaleString()} cards · {fmt(tC)}</div></div>):null })()}
          {cogsInventory.map(r => {
            const sold=r.sold_units||0, ratio=r.total_units>0?Math.min(sold/r.total_units,1):0, recog=parseFloat(r.total_cost||0)*ratio
            return (
              <div key={r.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div><div style={{ fontWeight: 700, fontSize: '15px' }}>{r.description}</div>{r.set_name&&<div style={{fontSize:'13px',color:C.muted}}>{r.set_name}</div>}<div style={{fontSize:'12px',color:C.muted}}>{r.date} · {r.inventory_type}</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{fontWeight:700,color:C.pink,fontSize:'16px'}}>{fmt(parseFloat(r.total_cost||0))}</div><div style={{fontSize:'12px',color:C.muted}}>${parseFloat(r.cost_per_unit||0).toFixed(3)}/unit</div></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: C.muted }}>Sold:</span>
                  <input type="number" min="0" max={r.total_units} value={sold} onChange={e=>handleUpdateSold(r.id,parseInt(e.target.value)||0)} style={{...inp,width:'80px',padding:'4px 8px',fontSize:'14px',textAlign:'center'}} />
                  <span style={{ fontSize: '13px', color: C.muted }}>/ {r.total_units?.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{color:C.pink}}>Recognized: {fmt(recog)}</span>
                  <span style={{color:C.gold}}>Remaining: {fmt(parseFloat(r.total_cost||0)-recog)}</span>
                </div>
                <button onClick={()=>handleDelete('cogs_inventory',r.id)} style={{...editBtn,marginTop:'8px'}}>Delete</button>
              </div>
            )
          })}
          {cogsInventory.length===0 && <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No inventory entries yet</div>}
        </div>
      )

      case 'accounting': return (
        <div>
          <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(45,191,184,0.1)', border: `1px solid rgba(45,191,184,0.25)`, marginBottom: '12px', fontSize: '12px', color: '#1A7A75', fontWeight: 'bold', fontFamily: FONT }}>
            ⚖️ Accrual Method — revenue & expenses recognized in period earned/incurred
          </div>

          {/* INCOME STATEMENT */}
          <div style={card}>
            <span style={secHdr}>INCOME STATEMENT · {selectedMonth===0?selectedYear:new Date(selectedYear,selectedMonth-1).toLocaleString('default',{month:'long',year:'numeric'})}</span>
            <PLRow label="Gross Revenue" value={gross} bold />
            <PLRow label="Less: Selling Fees & Commissions" value={totalPlatformFees} indent isNegative />
            <PLRow label="Less: Shipping Expense" value={totalShippingExpense} indent isNegative />
            <PLRow label="Net Sales" value={netSalesAmt} bold />
            <PLRow label="Cost of Goods Sold" value={cogsRecognized} isNegative showDrilldown drillId="cogs" />
            {acctDrilldown==='cogs' && <DD>{cogsInventory.map(r=>{const ratio=r.total_units>0?Math.min((r.sold_units||0)/r.total_units,1):0;const recog=parseFloat(r.total_cost||0)*ratio;return recog>0?<DDRow key={r.id} label={r.description} value={recog} neg />:null})}</DD>}
            <div style={{ display:'flex',justifyContent:'space-between',padding:'12px 0',borderBottom:`2px solid ${C.border}` }}>
              <span style={{ fontSize:'16px',fontWeight:700,fontFamily:FONT }}>Gross Profit</span>
              <span style={{ fontSize:'16px',fontWeight:900,color:grossMargin>=0?C.green:'#ef4444',fontFamily:FONT }}>{grossMargin<0?`(${fmt(Math.abs(grossMargin))})`:fmt(grossMargin)}</span>
            </div>
            <div style={{ padding:'10px 0 4px',fontSize:'12px',color:C.muted,fontWeight:'bold',letterSpacing:'0.05em',textTransform:'uppercase',fontFamily:FONT }}>Operating Expenses</div>
            {EXPENSE_CATEGORIES.filter(cat=>expByCategory[cat]>0).map(cat=>(
              <div key={cat}>
                <PLRow label={cat} value={expByCategory[cat]} indent isNegative showDrilldown drillId={`exp_${cat}`} />
                {acctDrilldown===`exp_${cat}` && <DD>{expenses.filter(e=>e.category===cat).map(e=><DDRow key={e.id} label={`${e.notes||e.purchase_date}${e.user_name?` · ${e.user_name}`:''}`} value={Number(e.cost)} neg />)}</DD>}
              </div>
            ))}
            <PLRow label="Salaries & Wages" value={staffingCosts} indent isNegative showDrilldown drillId="payroll_dd" />
            {acctDrilldown==='payroll_dd' && <DD>{payroll.map(p=><DDRow key={p.id} label={`${p.employee_name} · ${p.pay_date}`} value={Number(p.amount)} neg />)}</DD>}
            {totalDepreciation>0 && <PLRow label="Depreciation" value={totalDepreciation} indent isNegative showDrilldown drillId="dep_dd" />}
            {acctDrilldown==='dep_dd' && <DD>{assets.map(a=>{const life=parseInt(a.useful_life_yrs)||USEFUL_LIFE[a.category]||5;const {slAnnual}=calcDepreciation(parseFloat(a.cost),life,a.purchase_date,selectedYear);return slAnnual>0?<DDRow key={a.id} label={`${a.description} (${life}yr SL)`} value={slAnnual} neg />:null})}</DD>}
            <PLRow label="Total Operating Expenses" value={totalOpEx} bold isNegative />
            <div style={{ display:'flex',justifyContent:'space-between',padding:'14px 0 0',marginTop:'4px' }}>
              <span style={{ fontSize:'18px',fontWeight:900,fontFamily:FONT,textDecoration:'underline double' }}>Net Income</span>
              <span style={{ fontSize:'18px',fontWeight:900,color:netIncome>=0?C.green:'#ef4444',fontFamily:FONT,textDecoration:'underline double' }}>{netIncome<0?`(${fmt(Math.abs(netIncome))})`:fmt(netIncome)}</span>
            </div>
          </div>

          {/* BALANCE SHEET */}
          <div style={card}>
            <span style={secHdr}>BALANCE SHEET — as of {new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
            <div style={{ fontSize:'13px',fontWeight:700,color:C.navy,padding:'6px 0',borderBottom:`1px solid ${C.border}`,marginBottom:'4px' }}>ASSETS</div>
            <div style={{ fontSize:'12px',color:C.muted,fontWeight:'bold',padding:'6px 0 2px' }}>Current Assets</div>
            <PLRow label="Cash & Bank Accounts" value={totalCash} indent showDrilldown drillId="cash_dd" />
            {acctDrilldown==='cash_dd' && <DD>
              {bankAccounts.filter(b=>b.account_type!=='Credit').map(b=><DDRow key={b.id} label={`${b.bank_name} ${b.account_type}${b.account_last4?` ·${b.account_last4}`:''}`} value={Number(b.current_balance)} />)}
              <div style={{textAlign:'right',marginTop:'6px'}}><button onClick={()=>setEditingItem({table:'bank_accounts'})} style={editBtn}>+ Update Balance</button></div>
            </DD>}
            <PLRow label="Accounts Receivable (Collections)" value={totalOwed} indent showDrilldown drillId="ar_dd" />
            {acctDrilldown==='ar_dd' && <DD>{collections.filter(b=>Number(b.total_cost)-Number(b.amount_paid||0)>0).map(b=>{const owed=Number(b.total_cost)-Number(b.amount_paid||0);return <DDRow key={b.id} label={b.seller_name} value={owed} />})}</DD>}
            <PLRow label="Inventory (ending)" value={endingInventory} indent />
            <PLRow label="Total Current Assets" value={totalCurrentAssets} bold />
            <div style={{ fontSize:'12px',color:C.muted,fontWeight:'bold',padding:'10px 0 2px' }}>Fixed Assets</div>
            <PLRow label="Equipment & Furniture (cost)" value={totalAssetCost} indent showDrilldown drillId="fixed_dd" />
            {acctDrilldown==='fixed_dd' && <DD>{assets.map(a=><DDRow key={a.id} label={`${a.description} (${a.purchase_date})`} value={parseFloat(a.cost)} />)}</DD>}
            {totalAccumulatedDep>0 && <PLRow label="Less: Accumulated Depreciation" value={totalAccumulatedDep} indent isNegative />}
            <PLRow label="Net Fixed Assets" value={totalBookValue} bold />
            <div style={{ display:'flex',justifyContent:'space-between',padding:'10px 0',borderTop:`2px solid ${C.border}`,marginTop:'4px' }}>
              <span style={{ fontSize:'16px',fontWeight:900,fontFamily:FONT }}>Total Assets</span>
              <span style={{ fontSize:'16px',fontWeight:900,color:C.navy,fontFamily:FONT }}>{fmt(totalAssets)}</span>
            </div>
            <div style={{ fontSize:'13px',fontWeight:700,color:C.navy,padding:'10px 0 4px',borderBottom:`1px solid ${C.border}`,marginTop:'8px' }}>LIABILITIES & EQUITY</div>
            <div style={{ fontSize:'12px',color:C.muted,fontWeight:'bold',padding:'6px 0 2px' }}>Current Liabilities</div>
            <PLRow label="Accounts Payable" value={totalAPOwed} indent showDrilldown drillId="ap_dd" />
            {acctDrilldown==='ap_dd' && <DD>
              {accountsPayable.filter(a=>Number(a.total_amount)-Number(a.amount_paid||0)>0).map(a=>{const owed=Number(a.total_amount)-Number(a.amount_paid||0);return <DDRow key={a.id} label={`${a.vendor_name}${a.due_date?` · Due ${a.due_date}`:''}`} value={owed} neg />})}
              <div style={{textAlign:'right',marginTop:'6px'}}><button onClick={()=>setEditingItem({table:'accounts_payable'})} style={editBtn}>+ Add A/P</button></div>
            </DD>}
            <PLRow label="Credit Card Balances" value={totalCreditDebt} indent showDrilldown drillId="cc_dd" />
            {acctDrilldown==='cc_dd' && <DD>{bankAccounts.filter(b=>b.account_type==='Credit').map(b=><DDRow key={b.id} label={`${b.bank_name}${b.notes?` — ${b.notes}`:''}`} value={Math.abs(Number(b.current_balance))} neg />)}</DD>}
            <PLRow label="Total Liabilities" value={totalLiabilities} bold />
            <div style={{ fontSize:'12px',color:C.muted,fontWeight:'bold',padding:'10px 0 2px' }}>Owner's Equity</div>
            <PLRow label="Retained Earnings / Net Income" value={netIncome} indent />
            <PLRow label="Total Owner's Equity" value={ownerEquity} bold />
            <div style={{ display:'flex',justifyContent:'space-between',padding:'10px 0',borderTop:`2px solid ${C.border}`,marginTop:'4px' }}>
              <span style={{ fontSize:'16px',fontWeight:900,fontFamily:FONT }}>Total Liabilities & Equity</span>
              <span style={{ fontSize:'16px',fontWeight:900,color:C.navy,fontFamily:FONT }}>{fmt(totalLiabilities+ownerEquity)}</span>
            </div>
          </div>

          {/* INVENTORY FLOW */}
          <div style={card}>
            <span style={secHdr}>INVENTORY FLOW — {selectedYear}</span>
            {inventoryFlow.length===0
              ? <div style={{textAlign:'center',padding:'30px',color:C.muted,fontSize:'14px'}}>No inventory data yet</div>
              : <>
                {inventoryFlow.map((row,i) => (
                  <div key={i} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:'14px',color:C.text,fontFamily:FONT,flex:1,paddingRight:'8px' }}>{row.label}</span>
                    <span style={{ fontSize:'15px',fontWeight:700,fontFamily:FONT,minWidth:'90px',textAlign:'right',color:row.isAddition?C.green:'#ef4444' }}>
                      {row.isAddition?'':'('}{fmt(row.amount)}{row.isAddition?'':')'}
                    </span>
                  </div>
                ))}
                <div style={{ display:'flex',justifyContent:'space-between',padding:'12px 0 0',marginTop:'4px' }}>
                  <span style={{ fontSize:'16px',fontWeight:700,fontFamily:FONT,textDecoration:'underline' }}>Ending Inventory (Balance Sheet)</span>
                  <span style={{ fontSize:'16px',fontWeight:900,color:C.teal,fontFamily:FONT,textDecoration:'underline' }}>{fmt(endingBalance)}</span>
                </div>
              </>}
          </div>

          {/* ENTITY SPLIT */}
          <div style={card}>
            <span style={secHdr}>REVENUE BY ENTITY</span>
            {(['sole_prop','llc'] as const).map(entity => {
              const es=sales.filter(s=>s.entity===entity)
              const eGross=es.reduce((a,r)=>a+Number(r.amount),0)
              const eNet=es.reduce((a,r)=>a+Number(r.net_sales||r.amount),0)
              if (eGross===0) return null
              return (
                <div key={entity} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize:'14px',fontWeight:700,color:entity==='llc'?C.teal:C.gold }}>{entity==='llc'?'Mana Social LLC':'Camera Pho (Sole Prop)'}</div>
                    <div style={{ fontSize:'12px',color:C.muted }}>Net: {fmt(eNet)}</div>
                  </div>
                  <div style={{ fontSize:'17px',fontWeight:700,color:C.green }}>{fmt(eGross)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )

      case 'assets': return (
        <div>
          <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL ASSETS (COST)</div>
            <div style={{ fontSize: '30px', fontWeight: 900 }}>{fmt(totalAssetCost)}</div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', opacity: 0.7 }}>
              <span>Book Value: {fmt(totalBookValue)}</span>
              <span>Acc. Dep: {fmt(totalAccumulatedDep)}</span>
            </div>
          </div>
          <div style={{ ...card, padding: '14px' }}>
            <span style={secHdr}>DEPRECIATION SUMMARY · {selectedYear}</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ padding: '12px', background: '#F5F6FA', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>STRAIGHT-LINE / YR</div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: C.purple }}>{fmt(totalDepreciation)}</div>
              </div>
              <div style={{ padding: '12px', background: '#F5F6FA', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>SECTION 179 (FULL)</div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: C.teal }}>{fmt(totalAssetCost)}</div>
              </div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: C.muted, padding: '8px', background: 'rgba(240,192,64,0.08)', borderRadius: '8px' }}>
              Confirm with Kannie at tax time. Sec 179 = deduct full cost this year. Straight-line = spread over useful life.
            </div>
          </div>
          {ASSET_CATEGORIES.map(cat => {
            const catAssets = assets.filter(a => a.category === cat)
            if (!catAssets.length) return null
            return (
              <div key={cat} style={card}>
                <span style={secHdr}>{cat}</span>
                {catAssets.map(a => {
                  const life = parseInt(a.useful_life_yrs)||USEFUL_LIFE[a.category]||5
                  const { slAnnual, slAccumulated, slBookValue } = calcDepreciation(parseFloat(a.cost), life, a.purchase_date, selectedYear)
                  return (
                    <div key={a.id} style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{a.description}</div>
                          <div style={{ fontSize: '12px', color: C.muted }}>{a.purchase_date} · {life}yr · {a.user_name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{fmt(parseFloat(a.cost))}</div>
                          <div style={{ fontSize: '12px', color: C.muted }}>Book: {fmt(slBookValue)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px' }}>
                        <div style={{ padding: '6px 8px', background: 'rgba(107,63,160,0.08)', borderRadius: '6px' }}>
                          <div style={{ fontSize: '11px', color: C.muted }}>SL / year</div>
                          <div style={{ fontWeight: 700, color: C.purple }}>{fmt(slAnnual)}</div>
                        </div>
                        <div style={{ padding: '6px 8px', background: 'rgba(45,191,184,0.08)', borderRadius: '6px' }}>
                          <div style={{ fontSize: '11px', color: C.muted }}>Section 179</div>
                          <div style={{ fontWeight: 700, color: C.teal }}>{fmt(parseFloat(a.cost))}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <button onClick={() => startEdit('assets', a)} style={editBtn}>Edit</button>
                        <button onClick={() => handleDelete('assets', a.id)} style={{ ...editBtn, color: C.pink }}>Delete</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {assets.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No assets logged yet</div>}
        </div>
      )

      case 'deductions': return (
        <div>
          <button onClick={() => setShowSettings(!showSettings)} style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: '14px 16px', marginBottom: '10px', border: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 700, color: C.navy, fontSize: '15px', fontFamily: FONT }}>Settings</span>
            <span style={{ color: C.muted }}>{showSettings ? '▲' : '▼'}</span>
          </button>
          {showSettings && (
            <div style={{ ...card, borderColor: C.teal }}>
              <div style={{ marginBottom: '12px' }}>
                <span style={lbl}>Home Office %</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" min="0" max="100" step="0.1" value={homeOfficePct} onChange={e => setHomeOfficePct(parseFloat(e.target.value)||0)} style={{ ...inp, width: '80px' }} />
                  <span style={{ color: C.muted, fontSize: '14px' }}>% (e.g. 150/1500 sqft = 10%)</span>
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={lbl}>Internet & Phone Business Use %</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" min="0" max="100" step="1" value={internetPct} onChange={e => setInternetPct(parseFloat(e.target.value)||0)} style={{ ...inp, width: '80px' }} />
                  <span style={{ color: C.muted, fontSize: '14px' }}>%</span>
                </div>
              </div>
              <div style={{ fontSize: '14px', color: C.text }}>Mileage: {MILEAGE_RATE*100}¢/mile · {totalMiles.toFixed(1)} miles · <strong style={{ color: C.teal }}>{fmt(mileageDeduction)}</strong></div>
            </div>
          )}
          <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '20px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>TOTAL DEDUCTIONS</div>
            <div style={{ fontSize: '34px', fontWeight: 900, color: C.teal }}>{fmtK(totalDeductions)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
              <div><div style={{ fontSize: '11px', opacity: 0.6 }}>EST FED SAVINGS</div><div style={{ fontSize: '20px', fontWeight: 700, color: '#a78bfa' }}>{fmt(fedSavings)}</div></div>
              <div><div style={{ fontSize: '11px', opacity: 0.6 }}>EST CA SAVINGS</div><div style={{ fontSize: '20px', fontWeight: 700, color: '#a78bfa' }}>{fmt(caSavings)}</div></div>
            </div>
          </div>
          <div style={card}>
            <span style={secHdr}>EXPENSE DEDUCTIBILITY</span>
            {expenses.map(e => {
              const rule = DEDUCTIBILITY[e.category]||DEDUCTIBILITY['Other']
              const amt = Number(e.cost)
              const ded = rule.pct===100?amt:rule.pct===50?amt*0.5:e.category==='Home Office'?amt*(homeOfficePct/100):e.category==='Internet & Phone'?amt*(internetPct/100):0
              return (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{e.category}</div>
                    {e.notes && <div style={{ fontSize: '12px', color: C.muted }}>{e.notes}</div>}
                    <div style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '2px', background: rule.pct===100?'#E1F5EE':rule.pct===50?'#FEF3C7':'#FEF3E2', color: rule.pct===100?'#085041':'#7A5A00' }}>{rule.label} · {rule.line}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.teal }}>{fmt(ded)}</div>
                    <div style={{ fontSize: '12px', color: C.muted }}>saves {fmt(ded*0.313)}</div>
                  </div>
                </div>
              )
            })}
            {expenses.length===0 && <div style={{ textAlign: 'center', padding: '20px', color: C.muted }}>No expenses logged yet</div>}
          </div>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={secHdr}>MILEAGE LOG</span>
              <button onClick={() => setEditingItem({ table: 'mileage_log' })} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>+ Trip</button>
            </div>
            {mileageLog.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{r.purpose}</div>
                  <div style={{ fontSize: '12px', color: C.muted }}>{r.date} · {r.from_location} → {r.to_location}</div>
                  <div style={{ fontSize: '12px', color: C.teal }}>{parseFloat(r.miles).toFixed(1)} mi · {fmt(parseFloat(r.miles)*MILEAGE_RATE)}</div>
                </div>
                <button onClick={() => handleDelete('mileage_log', r.id)} style={delBtn}>×</button>
              </div>
            ))}
            {mileageLog.length===0 && <div style={{ textAlign: 'center', padding: '20px', color: C.muted }}>No trips logged yet</div>}
            {mileageLog.length>0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '14px', fontWeight: 700 }}><span>{totalMiles.toFixed(1)} total miles</span><span style={{ color: C.teal }}>{fmt(mileageDeduction)}</span></div>}
          </div>
        </div>
      )

      case 'tax': return (
        <div>
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(240,192,64,0.1)', border: '1px solid rgba(240,192,64,0.3)', marginBottom: '12px', fontSize: '13px', color: '#7A5A00', fontFamily: FONT }}>
            Estimates only — 22% federal, 9.3% CA. Confirm with Kannie before paying.
          </div>
          <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '20px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>YTD EST. TOTAL TAX</div>
            <div style={{ fontSize: '38px', fontWeight: 900, color: '#fda4af' }}>{fmtK(ytdTax)}</div>
          </div>
          {quarters.map(q => (
            <div key={q.label} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div><div style={{ fontWeight: 900, fontSize: '17px', color: C.navy }}>{q.label} 2026</div><div style={{ fontSize: '12px', color: C.muted }}>{q.start} – {q.end}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: '21px', fontWeight: 900, color: C.pink }}>{fmt(q.grand)}</div><div style={{ fontSize: '12px', color: C.muted }}>est. total</div></div>
              </div>
              {[['Form 941 — FICA',fmt(q.fica),`Due ${q.due941}`],['Form 940 — FUTA',fmt(q.futa),'Due Jan 31'],['CA UI/ETT',fmt(q.caUI),`Due ${q.due941}`],['1040-ES Federal',fmt(q.fedEst),`Due ${q.due1040}`],['100-ES California',fmt(q.caEst),`Due ${q.due1040}`]].map(([l,v,d]) => (
                <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontSize: '14px' }}>
                  <span>{l}</span>
                  <div style={{ textAlign: 'right' }}><span style={{ fontWeight: 700, color: C.pink, marginRight: '8px' }}>{v}</span><span style={{ fontSize: '12px', color: C.muted }}>{d}</span></div>
                </div>
              ))}
              <div style={{ marginTop: '10px', padding: '8px 10px', background: '#F5F6FA', borderRadius: '8px', fontSize: '12px', color: C.muted, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <span>Net rev: <strong style={{ color: C.text }}>{fmt(q.netRev)}</strong></span>
                <span>Exp: <strong style={{ color: C.text }}>{fmt(q.exp)}</strong></span>
                <span>Payroll: <strong style={{ color:​​​​​​​​​​​​​​​​
 C.text }}>{fmt(q.grossPay)}</strong></span>
                <span>Taxable: <strong style={{ color: C.text }}>{fmt(q.taxable)}</strong></span>
              </div>
            </div>
          ))}
          {disbursements.length > 0 && (
            <div style={card}>
              <span style={secHdr}>OWNER DRAWS</span>
              {disbursements.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div><div style={{ fontWeight: 500, fontSize: '15px' }}>{d.recipient}</div><div style={{ fontSize: '12px', color: C.muted }}>{d.disbursement_date}</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '16px' }}>{fmt(Number(d.amount))}</span>
                    <button onClick={() => handleDelete('disbursements', d.id)} style={delBtn}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )

      case 'payroll': return (
        <div>
          <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL PAYROLL</div>
            <div style={{ fontSize: '30px', fontWeight: 900, color: '#fda4af' }}>{fmt(staffingCosts)}</div>
            <div style={{ fontSize: '13px', opacity: 0.5, marginTop: '2px' }}>FICA: {fmt(staffingCosts*0.153)} · FUTA: {fmt(staffingCosts*0.006)}</div>
            <div style={{ fontSize: '13px', opacity: 0.5 }}>Roth IRA Contributed: {fmt(payroll.reduce((a,r)=>a+Number(r.roth_ira_contributed||0),0))}</div>
          </div>
          {payroll.map(p => (
            <div key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '2px', fontSize: '15px' }}>{p.employee_name}</div>
                <div style={{ fontSize: '13px', color: C.muted }}>{p.pay_date}{p.pay_period?` · Period ends ${p.pay_period}`:''}</div>
                {p.hours_worked > 0 && <div style={{ fontSize: '13px', color: C.muted }}>{p.hours_worked} hrs @ ${p.hourly_rate}/hr</div>}
                {p.roth_ira_contributed > 0 && <div style={{ fontSize: '12px', color: C.teal }}>Roth IRA: {fmt(p.roth_ira_contributed)} contributed</div>}
                <div style={{ fontSize: '12px', color: C.muted }}>FICA: {fmt(Number(p.amount)*0.153)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '17px' }}>{fmt(Number(p.amount))}</span>
                <button onClick={() => startEdit('payroll', p)} style={editBtn}>Edit</button>
                <button onClick={() => handleDelete('payroll', p.id)} style={delBtn}>×</button>
              </div>
            </div>
          ))}
          {payroll.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No payroll this period</div>}
        </div>
      )

      default: return null
    }
  }

  if (checkingAuth) return (
    <div style={{ minHeight: '100vh', background: C.navyDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid rgba(45,191,184,0.2)', borderTopColor: C.teal, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const TABS = [
    { id: 'summary',    label: 'Summary'    },
    { id: 'income',     label: 'Sales'      },
    { id: 'expense',    label: 'Expenses'   },
    { id: 'cogs',       label: 'COGS'       },
    { id: 'accounting', label: 'Accounting' },
    { id: 'assets',     label: 'Assets'     },
    { id: 'deductions', label: 'Deductions' },
    { id: 'tax',        label: 'Tax'        },
    { id: 'payroll',    label: 'Payroll'    },
  ]

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', paddingBottom: '140px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>
        <header style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 900, color: C.navy, fontSize: '17px', letterSpacing: '-0.3px', fontFamily: FONT }}>MANA SOCIAL LLC</div>
            <button onClick={signOut} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '6px 14px', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: FONT }}>Sign out</button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `2px solid ${C.border}`, fontWeight: 'bold', background: C.white, fontFamily: FONT, fontSize: '14px' }}>
              <option value={2026}>2026</option>
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ flex: 2, padding: '10px', borderRadius: '10px', border: `2px solid ${C.border}`, fontWeight: 'bold', background: C.white, fontFamily: FONT, fontSize: '14px' }}>
              <option value={0}>Full Year</option>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i+1}>{new Date(0,i).toLocaleString('default',{month:'long'})}</option>)}
            </select>
          </div>
        </header>

        {editingItem ? renderForm() : renderTab()}

        {!editingItem && (
          <button onClick={() => setIsQuickAddOpen(true)} style={{ position: 'fixed', bottom: '120px', right: '20px', width: '62px', height: '62px', borderRadius: '31px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', fontSize: '30px', border: '3px solid #fff', boxShadow: '0 8px 16px rgba(0,0,0,0.2)', zIndex: 500, cursor: 'pointer' }}>+</button>
        )}

        {isQuickAddOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.9)', display: 'flex', alignItems: 'flex-end', padding: '20px', zIndex: 1000 }}>
            <div style={{ background: C.white, width: '100%', borderRadius: '20px', padding: '24px', fontFamily: FONT }}>
              <h2 style={{ fontWeight: 900, marginBottom: '16px', color: C.navy, fontSize: '17px' }}>ADD RECORD</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  ['sales',           'SALE',       C.green],
                  ['collections',     'COLLECTION', C.text],
                  ['expenses',        'EXPENSE',    '#ef4444'],
                  ['payroll',         'PAYROLL',    C.text],
                  ['cogs_inventory',  'COGS',       C.purple],
                  ['mileage_log',     'MILEAGE',    C.teal],
                  ['assets',          'ASSET',      C.navy],
                  ['accounts_payable','PAYABLE',    C.pink],
                ].map(([table, l, color]) => (
                  <button key={String(table)} onClick={() => { setEditingItem({ table: String(table) }); setIsQuickAddOpen(false) }} style={{ padding: '17px', borderRadius: '12px', border: `1px solid ${C.border}`, fontWeight: 'bold', fontSize: '15px', background: C.white, color: color as string, cursor: 'pointer', fontFamily: FONT }}>{l}</button>
                ))}
                <button onClick={() => { setEditingItem({ table: 'disbursements' }); setIsQuickAddOpen(false) }} style={{ gridColumn: 'span 2', padding: '17px', borderRadius: '12px', border: `2px solid ${C.teal}`, color: C.teal, fontWeight: 900, background: C.white, cursor: 'pointer', fontSize: '15px', fontFamily: FONT }}>OWNER DRAW</button>
              </div>
              <button onClick={() => setIsQuickAddOpen(false)} style={{ width: '100%', marginTop: '16px', border: 'none', background: 'none', color: C.muted, fontWeight: 'bold', cursor: 'pointer', padding: '8px', fontSize: '14px', fontFamily: FONT }}>CANCEL</button>
            </div>
          </div>
        )}
      </div>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.white, borderTop: `2px solid ${C.border}`, display: 'flex', zIndex: 400, height: '100px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: '0 0 auto', minWidth: '60px', border: 'none', background: 'none', fontSize: '10px', fontWeight: 900, color: activeTab === t.id ? C.teal : C.muted, padding: '8px 6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, borderTop: activeTab === t.id ? `3px solid ${C.teal}` : '3px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
