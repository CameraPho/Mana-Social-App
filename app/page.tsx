'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const FONT = "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif"
const BODY = "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif"
const LIGHT_COLORS = {
  navy: '#1B2A4A', navyDark: '#111D33', teal: '#2DBFB8',
  pink: '#E8407A', purple: '#6B3FA0', gold: '#F0C040',
  bg: '#F0F2F8', white: '#FFFFFF', muted: '#8A96B0',
  text: '#1B2A4A', border: 'rgba(27,42,74,0.12)', green: '#10b981',
  cardBg: '#FFFFFF', inputBg: '#F5F6FA', navBg: '#FFFFFF', summaryText: '#fff',
}
const DARK_COLORS = {
  navy: '#E2E8F4', navyDark: '#0A0F1E', teal: '#2DBFB8',
  pink: '#E8407A', purple: '#9B6FD0', gold: '#F0C040',
  bg: '#232D42', white: '#1E2A3E', muted: '#6B7A9A',
  text: '#E2E8F4', border: 'rgba(255,255,255,0.08)', green: '#34D399',
  cardBg: '#1E2A3E', inputBg: '#232D42', navBg: '#111D33', summaryText: '#E2E8F4',
}
const C = LIGHT_COLORS
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

const AI_LEARN_KEY = 'mana_social_ai_corrections'
function getCorrections(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(AI_LEARN_KEY) || '{}') } catch { return {} }
}
function saveCorrection(title: string, category: string) {
  const corrections = getCorrections()
  corrections[title.toLowerCase().slice(0, 40)] = category
  localStorage.setItem(AI_LEARN_KEY, JSON.stringify(corrections))
}
function findLearned(title: string): string | null {
  const corrections = getCorrections()
  const t = title.toLowerCase()
  for (const [key, val] of Object.entries(corrections)) { if (t.includes(key)) return val }
  return null
}

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
  'Inventory Purchase':         { pct: 100,  label: '100% — COGS when sold',       line: 'Sch C Line 38'  },
  'Other':                      { pct: null, label: 'Needs review',                line: 'Sch C Line 27a' },
}
const EXPENSE_CATEGORIES = Object.keys(DEDUCTIBILITY)
const MILEAGE_RATE = 0.67
const ASSET_CATEGORIES = ['Equipment', 'Furniture & Fixtures', 'Vehicle']
const USEFUL_LIFE: Record<string, number> = { Equipment: 5, 'Furniture & Fixtures': 7, Vehicle: 5 }

function categorizeAmazonItem(title: string, amazonCategory: string): { expCat: string, isInventory: boolean } {
  const learned = findLearned(title)
  if (learned) return { expCat: learned, isInventory: learned === 'Inventory Purchase' }
  const t = title.toLowerCase(), ac = (amazonCategory || '').toLowerCase()
  const inv = ['magic: the gathering','magic the gathering','pokemon','yu-gi-oh','yugioh','funko','tmnt','turtle','digimon','one piece','final fantasy','bloomburrow','lorwyn','karlov','strixhaven','commander deck','booster box','booster bundle','secret lair','collector','play booster','draft booster','set booster','precon','riftbound']
  const sup = ['envelope','mailer','bubble','bag','sleeve','semi rigid','toploader','card holder','divider','label','sticker','poly','shipping bag','kraft','tape','box','package','dunnage','wrap','protector','team bag']
  const eqp = ['scanner','printer','mouse','keyboard','monitor','camera','light','shelf','shelv','rack','tray','sort tray','scissors','scale']
  if (inv.some(k => t.includes(k))) return { expCat: 'Inventory Purchase', isInventory: true }
  if (sup.some(k => t.includes(k))) return { expCat: 'Supplies & Packaging', isInventory: false }
  if (eqp.some(k => t.includes(k))) return { expCat: 'Equipment', isInventory: false }
  if (ac.includes('toy')) return { expCat: 'Inventory Purchase', isInventory: true }
  if (ac.includes('office') || ac.includes('industrial') || ac.includes('business')) return { expCat: 'Supplies & Packaging', isInventory: false }
  if (ac.includes('computer') || ac.includes('electronic')) return { expCat: 'Equipment', isInventory: false }
  return { expCat: 'Supplies & Packaging', isInventory: false }
}

function normalizeUser(user: string): string {
  const u = (user || '').toLowerCase()
  if (u.includes('kenny') || u.includes('ken')) return 'Kenny'
  return 'Cam'
}

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
          periodStart = `${s.slice(4)}-${s.slice(0,2)}-${s.slice(2,4)}`
          periodEnd = `${en.slice(4)}-${en.slice(0,2)}-${en.slice(2,4)}`
          entity = new Date(periodEnd) < LLC_START ? 'sole_prop' : 'llc'
        }
        const rows: any[] = XLSX.utils.sheet_to_json(ws)
        let grossSales = 0, netSales = 0, netShipping = 0, netTCGTax = 0, numOrders = 0
        for (const row of rows) {
          const state = row['State'] || row['state']
          if (!state || String(state).length !== 2) continue
          grossSales += Number(row['Gross Sales'] || 0)
          netSales += Number(row['Net Sales'] || 0)
          netShipping += Number(row['Net Shipping Amt'] || row['Shipping Amt'] || 0)
          netTCGTax += Number(row['Net TCG Tax Amt'] || row['TCG Tax Amt'] || 0)
          numOrders += Number(row['Number of Orders'] || 0)
        }
        const derivedFees = parseFloat((grossSales - netSales - netTCGTax).toFixed(2))
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

function parseManaPoolCSV(file: File): Promise<{ records: any[], meta: any }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string
        const wb = XLSX.read(text, { type: 'string', raw: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws)
        let totalGross = 0, totalFees = 0, totalShipping = 0, totalOrders = 0, minDate = '', maxDate = ''
        for (const row of rows) {
          const period = row['Period'] || row['period']
          if (!period) continue
          let dateStr = typeof period === 'number'
            ? new Date(Math.round((period - 25569) * 86400 * 1000)).toISOString().split('T')[0]
            : String(period).split('T')[0]
          if (!minDate || dateStr < minDate) minDate = dateStr
          if (!maxDate || dateStr > maxDate) maxDate = dateStr
          const subtotal = parseFloat(row['Subtotal'] || 0)
          const total = parseFloat(row['Total'] || 0)
          const shipping = parseFloat(row['Shipping'] || 0)
          const orders = parseInt(row['Order Count'] || 0)
          totalGross += subtotal
          totalFees += parseFloat(((subtotal * 0.05) + (total * 0.029) + (0.30 * orders)).toFixed(2))
          totalShipping += shipping
          totalOrders += orders
        }
        const saleDate = maxDate || new Date().toISOString().split('T')[0]
        resolve({
          records: [{ platform: 'manapool', amount: parseFloat(totalGross.toFixed(2)), fees: parseFloat(totalFees.toFixed(2)), shipping: parseFloat(totalShipping.toFixed(2)), sale_date: saleDate, period_start: minDate || saleDate, period_end: maxDate || saleDate, entity: new Date(saleDate) < LLC_START ? 'sole_prop' : 'llc', net_sales: parseFloat((totalGross - totalFees).toFixed(2)), num_orders: totalOrders }],
          meta: { totalGross, totalFees, totalShipping, totalOrders, periodStart: minDate, periodEnd: maxDate, rows: rows.length }
        })
      } catch (err: any) { reject(new Error('ManaPool parse failed: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsText(file)
  })
}

function parseAmazonCSV(file: File): Promise<{ records: any[], meta: any }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string
        const wb = XLSX.read(text, { type: 'string', raw: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws)
        const seenKeys: Record<string, boolean> = {}
        const records: any[] = []
        for (const row of rows) {
          const key = (row['Order ID'] || '') + '_' + (row['ASIN'] || '')
          if (seenKeys[key]) continue
          seenKeys[key] = true
          const title = row['Title'] || ''
          const cost = parseFloat(String(row['Item Net Total'] || row['Item Subtotal'] || 0).replace(/[$,]/g, '')) || 0
          const dateRaw = row['Order Date']
          let dateStr = new Date().toISOString().split('T')[0]
          if (dateRaw !== undefined && dateRaw !== null && dateRaw !== '') {
            if (typeof dateRaw === 'number') {
              dateStr = new Date(Math.round((dateRaw - 25569) * 86400 * 1000)).toISOString().split('T')[0]
            } else {
              const s = String(dateRaw)
              if (s.includes('/')) {
                const parts = s.split('/')
                if (parts.length === 3) dateStr = parts[2] + '-' + parts[0].padStart(2,'0') + '-' + parts[1].padStart(2,'0')
              } else if (s.includes('-')) { dateStr = s.split('T')[0] }
            }
          }
          const { expCat, isInventory } = categorizeAmazonItem(title, row['Amazon-Internal Product Category'] || '')
          records.push({ _type: isInventory ? 'inventory' : 'expense', expCat, isInventory, title, cost, tax: parseFloat(String(row['Item Tax'] || 0).replace(/[$,]/g, '')) || 0, dateStr, userName: normalizeUser(row['Account User'] || ''), entity: new Date(dateStr) < LLC_START ? 'sole_prop' : 'llc', orderId: row['Order ID'] || '', asin: row['ASIN'] || '' })
        }
        resolve({ records, meta: { rows: records.length } })
      } catch (err: any) { reject(new Error('Amazon parse failed: ' + err.message)) }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsText(file)
  })
}

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hashBuf = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function parseFileWithAI(file: File, mode: 'sales' | 'expenses', uploadedBy: string = 'Cam', override: boolean = false): Promise<any> {
  try {
    const isPDF = file.type === 'application/pdf'
    const isImage = file.type.startsWith('image/')
    let content: any[] = []
    if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      content = [{ type: 'text', text: `Document: ${file.name}\n\n${(await file.text()).slice(0, 12000)}` }]
    } else if (isImage || isPDF) {
      const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.onerror = rej; r.readAsDataURL(file) })
      content = [{ type: isPDF ? 'document' : 'image', source: { type: 'base64', media_type: isPDF ? 'application/pdf' : (file.type || 'image/jpeg'), data: base64 } }]
    } else { return { error: 'Unsupported file type' } }
    const fileHash = await hashFile(file)
    const res = await fetch('/api/smart-parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, fileName: file.name, fileHash, fileSize: file.size, uploadedBy, override }) })
    return await res.json()
  } catch (err: any) { return { error: err.message || 'Unknown error' } }
}

function calcDepreciation(cost: number, life: number, purchaseDate: string, year: number) {
  const yearsIn = year - new Date(purchaseDate).getFullYear()
  if (yearsIn < 0 || yearsIn >= life) return { slAnnual: 0, slAccumulated: 0, slBookValue: cost }
  const slAnnual = parseFloat((cost / life).toFixed(2))
  const slAccumulated = parseFloat((slAnnual * (yearsIn + 1)).toFixed(2))
  return { slAnnual, slAccumulated, slBookValue: parseFloat(Math.max(0, cost - slAccumulated).toFixed(2)) }
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [], cur = new Date(start + 'T12:00:00'), last = new Date(end + 'T12:00:00')
  while (cur <= last) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1) }
  return dates
}
function getWeekDates(dateStr: string): string[] {
  const d = new Date(dateStr + 'T12:00:00'), day = d.getDay()
  const monday = new Date(d); monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(monday); dd.setDate(monday.getDate() + i); return dd.toISOString().split('T')[0] })
}
function getMonthDates(dateStr: string): string[] {
  const [y, m] = dateStr.split('-').map(Number)
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`)
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
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: '10px', fontSize: '14px', background: C.inputBg, width: '100%', fontFamily: FONT, color: C.text }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: '10px', fontSize: '14px', background: C.inputBg, width: '100%', fontFamily: FONT, color: C.text }} />
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
  const [uploadMode, setUploadMode] = useState<'sales'|'expenses'|'amazon'>('sales')
  const [syncStatus, setSyncStatus] = useState('')
  const [acctDrilldown, setAcctDrilldown] = useState<string | null>(null)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({})
  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const [importQueueOpen, setImportQueueOpen] = useState(false)
  const [importQueue, setImportQueue] = useState<any[]>([])
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null)
  const [bulkTable, setBulkTable] = useState('mileage_log')
  const [bulkRows, setBulkRows] = useState<any[]>([])
  const [bulkDateMode, setBulkDateMode] = useState<'single'|'range'|'week'|'month'>('single')
  const [bulkDateFrom, setBulkDateFrom] = useState(new Date().toISOString().split('T')[0])
  const [bulkDateTo, setBulkDateTo] = useState(new Date().toISOString().split('T')[0])
  const [bulkUser, setBulkUser] = useState('Cam')
  const [bulkDefaults, setBulkDefaults] = useState<any>({})
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
    supplyItem: '', supplyUnit: '', supplyCost: '',
  }
  const [formData, setFormData] = useState(emptyForm)

  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [accountsPayable, setAccountsPayable] = useState<any[]>([])
  const [payroll, setPayroll] = useState<any[]>([])
  const [disbursements, setDisbursements] = useState<any[]>([])
  const [mileageLog, setMileageLog] = useState<any[]>([])
  const [cogsInventory, setCogsInventory] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [supplyCosts, setSupplyCosts] = useState<any[]>([])
  const [allCogsInventory, setAllCogsInventory] = useState<any[]>([])

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Grotesk:wght@300;400;500;600;700&display=swap'
    document.head.appendChild(link)
  }, [])

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
    const [s, e, ap, p, d, ml, ci, allCI, ast, ba, sc] = await Promise.all([
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
    ])
    setSales(fd(s.data || [], 'sale_date'))
    setExpenses(fd(e.data || [], 'purchase_date'))
    const unmigrated = (e.data || []).filter((ex: any) =>
      (ex.category === 'Equipment' || ex.category === 'Furniture & Fixtures') && Number(ex.cost) > 0 && !ex.asset_created
    )
    if (unmigrated.length > 0) {
      for (const ex of unmigrated) {
        await supabase.from('assets').insert({ purchase_date: ex.purchase_date, description: ex.notes || 'Auto-migrated from expense', category: ex.category, cost: Number(ex.cost), tax_paid: 0, useful_life_yrs: ex.category === 'Furniture & Fixtures' ? 7 : 5, depreciation_method: 'both', entity: ex.entity, user_name: ex.user_name || 'Cam', source_expense_id: ex.id, is_auto_created: true })
        await supabase.from('expenses').update({ asset_created: true }).eq('id', ex.id)
      }
      const { data: refreshed } = await supabase.from('assets').select('*').order('purchase_date', { ascending: false })
      setAssets(refreshed || [])
    }
    setAccountsPayable(ap.data || [])
    setPayroll(fd(p.data || [], 'pay_date'))
    setDisbursements(fd(d.data || [], 'disbursement_date'))
    setMileageLog((ml.data || []).filter((i: any) => new Date(i.date).getFullYear() === selectedYear))
    setCogsInventory((ci.data || []).filter((i: any) => new Date(i.date).getFullYear() === selectedYear))
    setAllCogsInventory(allCI.data || [])
    setAssets(ast.data || [])
    setBankAccounts(ba.data || [])
    setSupplyCosts(sc.data || [])
  }, [authed, selectedYear, selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Computed values ──────────────────────────────────────────────────
  const gross = sales.reduce((s, r) => s + Number(r.amount), 0)
  const totalPlatformFees = sales.reduce((s, r) => s + Number(r.fees || 0), 0)
  const totalShippingExpense = sales.reduce((s, r) => s + Number(r.shipping || 0), 0)
  const totalFees = totalPlatformFees + totalShippingExpense
  const netSalesAmt = sales.reduce((s, r) => s + Number(r.net_sales || r.amount), 0)
  const expByCategory = EXPENSE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = expenses.filter(e => e.category === cat && !e.asset_created).reduce((s, r) => s + Number(r.cost), 0)
    return acc
  }, {} as Record<string, number>)
  const opExpenses = Object.values(expByCategory).reduce((a, b) => a + b, 0)
  const totalAPOwed = accountsPayable.reduce((a, r) => a + Math.max(0, Number(r.total_amount) - Number(r.amount_paid || 0)), 0)
  const staffingCosts = payroll.reduce((s, r) => s + Number(r.amount), 0)
  const totalCosts = totalFees + opExpenses + totalAPOwed + staffingCosts
  const netRevenue = gross - totalCosts
  const cogsRecognized = cogsInventory.reduce((a, r) => {
    const ratio = r.total_units > 0 ? Math.min((r.sold_units || 0) / r.total_units, 1) : 0
    return a + parseFloat(r.total_cost || 0) * ratio
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
  const totalCash = bankAccounts.filter(b => b.account_type !== 'Credit').reduce((a, r) => a + Number(r.current_balance || 0), 0)
  const totalCreditDebt = bankAccounts.filter(b => b.account_type === 'Credit').reduce((a, r) => a + Math.abs(Number(r.current_balance || 0)), 0)
  const endingInventory = allCogsInventory.reduce((a, r) => {
    const ratio = r.total_units > 0 ? Math.min((r.sold_units || 0) / r.total_units, 1) : 0
    return a + parseFloat(r.total_cost || 0) * (1 - ratio)
  }, 0)
  const totalCurrentAssets = totalCash + endingInventory + totalAPOwed
  const totalAssets = totalCurrentAssets + totalBookValue
  const totalLiabilities = totalAPOwed + totalCreditDebt
  const ownerEquity = totalAssets - totalLiabilities

  const getLatestSupplyCost = (itemName: string): number => {
    const matches = supplyCosts.filter(s => s.item_name === itemName).sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())
    return matches.length > 0 ? parseFloat(matches[0].cost_per_unit) : 0
  }
  const uniqueSupplyItems = Array.from(new Set(supplyCosts.map(s => s.item_name)))

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
    const fedEst = taxable * 0.22, pte = taxable * 0.093
    return { ...q, netRev, exp, grossPay, taxable, fica, futa, caUI, fedEst, pte, grand: fica + futa + caUI + fedEst + pte }
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

  // ── Styles ──────────────────────────────────────────────────────────
  const card: React.CSSProperties = { background: C.cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${C.border}`, marginBottom: '12px', fontFamily: FONT }
  const inp: React.CSSProperties = { padding: '13px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, fontSize: '15px', width: '100%', background: C.inputBg, boxSizing: 'border-box', fontFamily: BODY, color: C.text }
  const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: C.muted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px', display: 'block', fontFamily: BODY }
  const editBtn: React.CSSProperties = { background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: C.muted, cursor: 'pointer', fontFamily: BODY }
  const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '18px', fontFamily: FONT }
  const secHdr: React.CSSProperties = { fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', fontFamily: BODY, display: 'block' }

  // ── Handlers ─────────────────────────────────────────────────────────
  const fetchImportQueue = async () => {
    const { data } = await supabase.from('import_queue').select('*').in('status', ['pending', 'pending_auto']).order('created_at', { ascending: false })
    setImportQueue(data || [])
    setPendingReviewCount((data || []).filter((i: any) => i.confidence_tier !== 'auto').length)
  }

  useEffect(() => { if (authed) fetchImportQueue() }, [authed])
  useEffect(() => { document.body.style.background = isDark ? '#232D42' : '#F0F2F8'; document.body.style.transition = 'background 0.2s' }, [isDark])
  useEffect(() => { setBulkDefaults({}); setBulkRows([]) }, [bulkTable])

  const handleFileUpload = async (file: File, mode: 'sales' | 'expenses') => {
    setUploadPreview([])
    const name = file.name.toLowerCase()
    if (mode === 'sales') {
      const isTCG = name.includes('tcgplayer') || /sellertaxreport/i.test(file.name)
      const isEbay = name.includes('ebay') || name.includes('listing')
      const isManaPool = name.includes('manapool') || name.includes('mana_pool') || name.includes('mana pool')
      if ((name.endsWith('.xlsx') || name.endsWith('.xls')) && (isTCG || !isEbay)) {
        setUploadStatus('Parsing TCGplayer report...')
        try {
          const { records, meta } = await parseTCGplayerXLSX(file)
          setUploadMode('sales'); setUploadPreview(records.map(r => ({ ...r, _displayLabel: `TCGplayer · ${meta.periodStart} – ${meta.periodEnd}`, _meta: meta })))
          setUploadStatus(`TCGplayer: ${meta.periodStart} – ${meta.periodEnd} · ${meta.numOrders} orders · Gross ${fmt(meta.grossSales)} · Fees ${fmt(meta.derivedFees)} · Net ${fmt(meta.netSales)}`)
        } catch (err: any) { setUploadStatus('Error: ' + err.message) }
        return
      }
      if (name.endsWith('.csv') && (isEbay || name.includes('listing'))) {
        setUploadStatus('Parsing eBay report...')
        try {
          const { records, meta } = await parseEbayCSV(file)
          setUploadMode('sales'); setUploadPreview(records.map(r => ({ ...r, _displayLabel: `eBay · ${meta.rows} listings`, _meta: meta })))
          setUploadStatus(`eBay: ${meta.rows} listings · Gross ${fmt(meta.totalGross)} · Fees ${fmt(meta.totalFees)} · Net ${fmt(meta.totalNet)}`)
        } catch (err: any) { setUploadStatus('Error: ' + err.message) }
        return
      }
      if (name.endsWith('.csv') && isManaPool) {
        setUploadStatus('Parsing ManaPool report...')
        try {
          const { records, meta } = await parseManaPoolCSV(file)
          setUploadMode('sales'); setUploadPreview(records)
          setUploadStatus(`ManaPool: ${meta.periodStart} – ${meta.periodEnd} · ${meta.totalOrders} orders · Gross ${fmt(meta.totalGross)} · Net ${fmt(meta.totalGross - meta.totalFees)}`)
        } catch (err: any) { setUploadStatus('Error: ' + err.message) }
        return
      }
    }
    if (mode === 'expenses' && name.includes('amazon')) {
      setUploadStatus('Parsing Amazon order report...')
      try {
        const { records, meta } = await parseAmazonCSV(file)
        setUploadMode('amazon'); setUploadPreview(records)
        setUploadStatus(`Amazon: ${meta.rows} items — review categories and confirm.`)
      } catch (err: any) { setUploadStatus('Error: ' + err.message) }
      return
    }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setUploadStatus('Unrecognized file format. CSV/XLSX should be from a known platform. PDFs and photos use AI.')
      return
    }
    setUploadMode(mode); setUploadStatus('Reading file with AI... (10-20 seconds)')
    const result = await parseFileWithAI(file, mode, 'Cam', false)
    if (result.error) { setUploadStatus('Error: ' + result.error); return }
    if (result.duplicate) { setDuplicateWarning({ file, mode, existingDoc: result.existingDoc, message: result.message }); setUploadStatus('Duplicate detected — see warning'); return }
    if (!result.items || result.items.length === 0) { setUploadStatus('No data extracted.'); return }
    fetchImportQueue()
    setUploadStatus(`Extracted ${result.itemCount} items. Open Review Queue from Summary tab.`)
    setUploadPreview([])
  }

  const confirmDuplicateOverride = async () => {
    if (!duplicateWarning) return
    setUploadStatus('Reprocessing with override...')
    const result = await parseFileWithAI(duplicateWarning.file, duplicateWarning.mode, 'Cam', true)
    setDuplicateWarning(null)
    if (result.error) { setUploadStatus('Error: ' + result.error); return }
    if (!result.items || result.items.length === 0) { setUploadStatus('No data extracted.'); return }
    fetchImportQueue(); setUploadStatus(`Extracted ${result.itemCount} items. Review queue updated.`)
  }

  const confirmUpload = async () => {
    setUploadStatus('Saving...')
    if (uploadMode === 'sales') {
      const inserts = uploadPreview.map(r => ({ platform: r.platform || 'other', amount: parseFloat(r.amount) || 0, fees: parseFloat(r.fees) || 0, shipping: parseFloat(r.shipping) || 0, sale_date: r.sale_date || r.date || new Date().toISOString().split('T')[0], period_start: r.period_start || r.sale_date || new Date().toISOString().split('T')[0], period_end: r.period_end || r.sale_date || new Date().toISOString().split('T')[0], entity: r.entity || getEntity(r.sale_date || new Date().toISOString().split('T')[0]), net_sales: parseFloat(r.net_sales) || 0, num_orders: parseInt(r.num_orders) || 1 }))
      const { error } = await supabase.from('sales').insert(inserts)
      if (error) { setUploadStatus('Error: ' + error.message); return }
    } else if (uploadMode === 'amazon') {
      const expenseRows = uploadPreview.filter(r => !r.isInventory)
      const inventoryRows = uploadPreview.filter(r => r.isInventory)
      if (expenseRows.length > 0) {
        const { error } = await supabase.from('expenses').insert(expenseRows.map(r => ({ category: r.expCat, cost: r.cost, purchase_date: r.dateStr, notes: r.title?.slice(0, 100), entity: r.entity, user_name: r.userName, paid_by_company: true })))
        if (error) { setUploadStatus('Error saving expenses: ' + error.message); return }
      }
      if (inventoryRows.length > 0) {
        const { error } = await supabase.from('cogs_inventory').insert(inventoryRows.map(r => ({ date: r.dateStr, inventory_type: 'sealed', description: r.title?.slice(0, 100), set_name: null, purchase_price: r.cost, quantity: 1, card_count: 0, cards_per_box: 0, total_cost: r.cost, cost_per_unit: r.cost, total_units: 1, sold_units: 0, est_sell_value: 0, entity: r.entity })))
        if (error) { setUploadStatus('Error saving inventory: ' + error.message); return }
      }
    } else {
      const { error } = await supabase.from('expenses').insert(uploadPreview.map(r => ({ category: r.category || 'Other', cost: parseFloat(r.cost) || 0, purchase_date: r.date || new Date().toISOString().split('T')[0], notes: r.notes || '', entity: getEntity(r.date || new Date().toISOString().split('T')[0]), user_name: r.user_name || 'Cam', paid_by_company: true })))
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
      payload = { platform: formData.label, amount: Number(formData.amount), fees: Number(formData.fees || 0), shipping: Number(formData.shipping || 0), sale_date: formData.date, period_start: formData.date, period_end: formData.date, entity: getEntity(formData.date), net_sales: Number(formData.amount) - Number(formData.fees || 0), num_orders: editingItem.data?.num_orders ?? 1 }
    } else if (t === 'accounts_payable') {
      if (!formData.apTotal || !formData.apVendor) return alert('Missing fields')
      const cardCount = parseInt((formData as any).apCardCount || '0') || 0
      const costPerCard = cardCount > 0 ? parseFloat(formData.apTotal) / cardCount : 0
      payload = { vendor_name: formData.apVendor, description: formData.label, invoice_date: formData.date, due_date: formData.apDue || formData.date, total_amount: Number(formData.apTotal), amount_paid: Number(formData.amountPaid || 0), entity: getEntity(formData.date), notes: formData.notes + (cardCount > 0 ? ` | ${cardCount.toLocaleString()} cards @ $${costPerCard.toFixed(4)}/card` : '') }
    } else if (t === 'expenses') {
      if (!formData.amount) return alert('Missing amount')
      if (formData.label) saveCorrection(formData.label, formData.category)
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
    if (editingItem.data?.id) {
      const { error } = await supabase.from(t).update(payload).eq('id', editingItem.data.id)
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

  const startEdit = (table: string, row: any) => {
    const pre: any = { ...emptyForm, date: row.sale_date || row.purchase_date || row.due_date || row.pay_date || row.disbursement_date || row.date || emptyForm.date }
    if (table === 'sales') { pre.label = row.platform; pre.amount = String(row.amount); pre.fees = String(row.fees || 0); pre.shipping = String(row.shipping || 0) }
    else if (table === 'accounts_payable') { pre.apVendor = row.vendor_name; pre.label = row.description || ''; pre.apTotal = String(row.total_amount); pre.amountPaid = String(row.amount_paid || 0); pre.apDue = row.due_date || ''; pre.notes = row.notes || '' }
    else if (table === 'expenses') { pre.label = row.notes || ''; pre.amount = String(row.cost); pre.category = row.category || 'Other'; pre.userName = row.user_name || 'Cam'; pre.paidByCompany = row.paid_by_company ?? true }
    else if (table === 'payroll') { pre.label = row.employee_name; pre.amount = String(row.amount); pre.hoursWorked = String(row.hours_worked || ''); pre.hourlyRate = String(row.hourly_rate || 16); pre.payPeriod = row.pay_period || '' }
    else if (table === 'disbursements') { pre.label = row.recipient; pre.amount = String(row.amount); pre.notes = row.notes || '' }
    else if (table === 'mileage_log') { pre.milePurpose = row.purpose; pre.mileFrom = row.from_location; pre.mileTo = row.to_location; pre.miles = String(row.miles); pre.userName = row.user_name || 'Cam' }
    else if (table === 'assets') { pre.label = row.description; pre.amount = String(row.cost); pre.assetCategory = row.category || 'Equipment'; pre.assetLife = String(row.useful_life_yrs || 5); pre.notes = row.notes || ''; pre.userName = row.user_name || 'Cam' }
    else if (table === 'bank_accounts') { pre.bankName = row.bank_name; pre.accountType = row.account_type; pre.accountLast4 = row.account_last4 || ''; pre.bankBalance = String(row.current_balance || 0); pre.notes = row.notes || '' }
    else if (table === 'supply_costs') { pre.supplyItem = row.item_name; pre.supplyUnit = row.unit_description; pre.supplyCost = String(row.cost_per_unit); pre.notes = row.notes || '' }
    setFormData(pre); setEditingItem({ table, data: row })
  }

  const handleDelete = async (table: string, id: string) => {
    if (!confirm('Delete?')) return
    await supabase.from(table).delete().eq('id', id)
    fetchData()
  }
  const signOut = async () => { await supabase.auth.signOut() }
  const cycleTheme = () => {
    const next = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'auto' : 'light'
    setThemeMode(next); localStorage.setItem('mana_theme', next)
  }
  const themeIcon = themeMode === 'light' ? '☀️' : themeMode === 'dark' ? '🌙' : '🌓'

  const generateBulkDates = (): string[] => {
    if (bulkDateMode === 'single') return [bulkDateFrom]
    if (bulkDateMode === 'range') return getDatesInRange(bulkDateFrom, bulkDateTo)
    if (bulkDateMode === 'week') return getWeekDates(bulkDateFrom)
    if (bulkDateMode === 'month') return getMonthDates(bulkDateFrom)
    return [bulkDateFrom]
  }

  const initBulkRows = () => {
    const dates = generateBulkDates(), d = bulkDefaults
    if (bulkTable === 'mileage_log') setBulkRows(dates.map(dt => ({ date: dt, purpose: d.purpose || 'USPS drop-off', from_location: d.from_location || 'Home', to_location: d.to_location || 'USPS Moreno Valley', miles: d.miles || '3', user_name: bulkUser, selected: true })))
    else if (bulkTable === 'expenses') setBulkRows(dates.map(dt => ({ date: dt, category: d.category || 'Supplies & Packaging', notes: d.notes || '', cost: '', user_name: bulkUser, selected: true })))
    else if (bulkTable === 'sales') setBulkRows(dates.map(dt => ({ date: dt, platform: d.platform || '', amount: '', fees: '', shipping: '', selected: true })))
    else if (bulkTable === 'payroll') setBulkRows(dates.map(dt => ({ date: dt, employee_name: d.employee_name || '', amount: '', hours_worked: '', hourly_rate: d.hourly_rate || '16', selected: true })))
    else setBulkRows(dates.map(dt => ({ date: dt, selected: true })))
  }

  const saveBulkRows = async () => {
    const selected = bulkRows.filter(r => r.selected)
    if (!selected.length) return alert('No rows selected')
    let inserts: any[] = []
    if (bulkTable === 'mileage_log') inserts = selected.map(r => ({ date: r.date, purpose: r.purpose, from_location: r.from_location, to_location: r.to_location, miles: parseFloat(r.miles) || 0, user_name: r.user_name || 'Cam' }))
    else if (bulkTable === 'expenses') inserts = selected.filter(r => r.cost).map(r => ({ category: r.category, cost: parseFloat(r.cost), purchase_date: r.date, notes: r.notes, entity: getEntity(r.date), user_name: r.user_name || 'Cam', paid_by_company: true }))
    else if (bulkTable === 'sales') inserts = selected.filter(r => r.amount).map(r => ({ platform: r.platform || 'other', amount: parseFloat(r.amount) || 0, fees: parseFloat(r.fees) || 0, shipping: parseFloat(r.shipping) || 0, sale_date: r.date, period_start: r.date, period_end: r.date, entity: getEntity(r.date), net_sales: (parseFloat(r.amount) || 0) - (parseFloat(r.fees) || 0), num_orders: 1 }))
    else if (bulkTable === 'payroll') inserts = selected.filter(r => r.amount || (r.hours_worked && r.hourly_rate)).map(r => ({ employee_name: r.employee_name, amount: r.amount ? parseFloat(r.amount) : parseFloat(r.hours_worked) * parseFloat(r.hourly_rate), pay_date: r.date, hours_worked: parseFloat(r.hours_worked) || 0, hourly_rate: parseFloat(r.hourly_rate) || 16 }))
    if (!inserts.length) return alert('No valid rows to save')
    const { error } = await supabase.from(bulkTable).insert(inserts)
    if (error) return alert(error.message)
    setBulkAddOpen(false); setBulkRows([]); fetchData()
  }
  // ── Upload Preview ───────────────────────────────────────────────────
  const renderUploadPreview = () => {
    if (!uploadPreview.length && !uploadStatus) return null
    return (
      <div style={{ ...card, border: `1px solid ${C.teal}` }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.teal, marginBottom: '8px', textTransform: 'uppercase' }}>Import Preview</div>
        {uploadStatus && <div style={{ fontSize: '13px', color: C.muted, marginBottom: '8px' }}>{uploadStatus}</div>}
        {uploadMode === 'amazon' ? (
          <div>
            {uploadPreview.map((r, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: r.isInventory ? C.purple : C.text, flex: 1, paddingRight: '8px', fontSize: '12px' }}>{r.title?.slice(0, 50)}</span>
                  <span style={{ fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>{fmt(-r.cost)}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={r.expCat} onChange={e => { const updated = [...uploadPreview]; updated[i] = { ...r, expCat: e.target.value, isInventory: e.target.value === 'Inventory Purchase' }; saveCorrection(r.title, e.target.value); setUploadPreview(updated) }} style={{ ...inp, padding: '4px 8px', fontSize: '12px', width: 'auto', flex: 1 }}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span style={{ fontSize: '11px', color: C.muted, flexShrink: 0 }}>{r.dateStr} · {r.userName}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          uploadPreview.map((r, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700 }}>{r._displayLabel || (uploadMode === 'sales' ? r.platform : r.category)} · {r.sale_date || r.date || '?'}</span>
                <span style={{ fontWeight: 700, color: uploadMode === 'sales' ? C.green : '#ef4444' }}>{fmt(uploadMode === 'sales' ? (r.amount || 0) : -(r.cost || 0))}</span>
              </div>
              {uploadMode === 'sales' && r.fees != null && (
                <div style={{ fontSize: '12px', color: C.muted, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <span>Gross: {fmt(r.amount || 0)}</span><span>Fees: {fmt(r.fees || 0)}</span>
                  <span>Ship: {fmt(r.shipping || 0)}</span><span>Net: {fmt(r.net_sales || 0)}</span>
                  {r.entity && <span style={{ color: r.entity === 'llc' ? C.teal : C.gold }}>{r.entity === 'llc' ? 'LLC' : 'Sole Prop'}</span>}
                  {r.num_orders > 0 && <span>{r.num_orders} orders</span>}
                </div>
              )}
            </div>
          ))
        )}
        {uploadPreview.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={confirmUpload} style={{ padding: '10px 18px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Save all</button>
            <button onClick={() => { setUploadPreview([]); setUploadStatus('') }} style={{ padding: '10px 14px', background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.muted, cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Cancel</button>
          </div>
        )}
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────
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
          {!['mileage_log','cogs_inventory','assets','bank_accounts','accounts_payable','supply_costs'].includes(t) && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', fontFamily: FONT, background: getEntity(formData.date) === 'sole_prop' ? 'rgba(240,192,64,0.12)' : 'rgba(45,191,184,0.1)', color: getEntity(formData.date) === 'sole_prop' ? '#7A5A00' : '#1A7A75' }}>
              {getEntity(formData.date) === 'sole_prop' ? 'Camera Pho (Sole Prop)' : 'Mana Social LLC'}
            </div>
          )}

          {t === 'supply_costs' && <>
            <div><span style={lbl}>Supply Item Name</span><input value={formData.supplyItem} onChange={e => setFormData({ ...formData, supplyItem: e.target.value })} placeholder="e.g. Penny Sleeve, Forever Stamp" style={inp} /></div>
            <div><span style={lbl}>Unit Description</span><input value={formData.supplyUnit} onChange={e => setFormData({ ...formData, supplyUnit: e.target.value })} placeholder="e.g. per sleeve, per stamp" style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Total Cost ($)</span><input type="number" step="0.01" value={(formData as any).supplyTotalCost || ''} onChange={e => { const tc = e.target.value; const qty = parseFloat((formData as any).supplyQty || '1') || 1; setFormData({ ...formData, supplyTotalCost: tc, supplyCost: tc ? (parseFloat(tc)/qty).toFixed(4) : '' } as any) }} placeholder="0.00" style={inp} /></div>
              <div><span style={lbl}>Quantity</span><input type="number" step="1" value={(formData as any).supplyQty || ''} onChange={e => { const qty = e.target.value; const tc = parseFloat((formData as any).supplyTotalCost || '0'); setFormData({ ...formData, supplyQty: qty, supplyCost: tc && qty ? (tc/parseFloat(qty)).toFixed(4) : '' } as any) }} placeholder="1" style={inp} /></div>
            </div>
            <div><span style={lbl}>Cost Per Unit ($)</span><input type="number" step="0.0001" value={formData.supplyCost} onChange={e => setFormData({ ...formData, supplyCost: e.target.value })} placeholder="0.0100" style={inp} /></div>
            <div><span style={lbl}>Vendor / Source</span><input value={(formData as any).supplyVendor || ''} onChange={e => setFormData({ ...formData, supplyVendor: e.target.value } as any)} placeholder="e.g. BCW, Amazon, Costco" style={inp} /></div>
            <div><span style={lbl}>Notes</span><input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Order #, etc." style={inp} /></div>
          </>}

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
            {formData.amount && (() => { const cost = parseFloat(formData.amount)||0, life = parseInt(formData.assetLife)||5; return (<div style={{ padding:'10px', borderRadius:'8px', background:'rgba(45,191,184,0.08)', fontSize:'13px', color:'#1A7A75', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}><span>Sec 179: <strong>{fmt(cost)}</strong></span><span>SL/yr: <strong>{fmt(cost/life)}</strong></span></div>) })()}
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
            <div><span style={lbl}>Transaction Description</span><input value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="e.g. Collection purchase — 5,000 MTG cards" style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Invoice Date</span><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} style={inp} /></div>
              <div><span style={lbl}>Due Date</span><input type="date" value={formData.apDue} onChange={e => setFormData({ ...formData, apDue: e.target.value })} style={inp} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Total Amount ($)</span><input type="number" step="0.01" value={formData.apTotal} onChange={e => setFormData({ ...formData, apTotal: e.target.value })} placeholder="0.00" style={inp} /></div>
              <div><span style={lbl}>Amount Paid ($)</span><input type="number" step="0.01" value={formData.amountPaid} onChange={e => setFormData({ ...formData, amountPaid: e.target.value })} placeholder="0.00" style={inp} /></div>
            </div>
            <div><span style={lbl}>Card Count (optional)</span>
              <input type="number" value={(formData as any).apCardCount || ''} onChange={e => setFormData({ ...formData, apCardCount: e.target.value } as any)} placeholder="e.g. 5000" style={inp} />
              {(formData as any).apCardCount && formData.apTotal && (
                <div style={{ marginTop: '4px', fontSize: '13px', color: C.teal, fontWeight: 700 }}>Cost per card: ${(parseFloat(formData.apTotal) / parseInt((formData as any).apCardCount)).toFixed(4)}</div>
              )}
            </div>
            <div><span style={lbl}>Notes</span><textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Payment terms, card types, condition, context" style={{ ...inp, height: '60px', resize: 'vertical' }} /></div>
          </>}

          {t === 'mileage_log' && <>
            <div><span style={lbl}>Business Purpose</span><input value={formData.milePurpose} onChange={e => setFormData({ ...formData, milePurpose: e.target.value })} placeholder="e.g. USPS drop-off" style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>From</span><input value={formData.mileFrom} onChange={e => setFormData({ ...formData, mileFrom: e.target.value })} placeholder="Home" style={inp} /></div>
              <div><span style={lbl}>To</span><input value={formData.mileTo} onChange={e => setFormData({ ...formData, mileTo: e.target.value })} placeholder="USPS Moreno Valley" style={inp} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><span style={lbl}>Miles</span><input type="number" step="0.1" value={formData.miles} onChange={e => setFormData({ ...formData, miles: e.target.value })} placeholder="0.0" style={inp} /></div>
              <div><span style={lbl}>Logged By</span>
                <select value={formData.userName} onChange={e => setFormData({ ...formData, userName: e.target.value })} style={inp}>
                  <option value="Cam">Cam</option><option value="Kenny">Kenny</option>
                </select>
              </div>
            </div>
            {formData.miles && <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(45,191,184,0.08)', fontSize: '14px', color: '#1A7A75' }}>Deduction: <strong>{fmt(parseFloat(formData.miles) * MILEAGE_RATE)}</strong></div>}
          </>}

          {t === 'cogs_inventory' && <>
            <div><span style={lbl}>Inventory Type</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {[['collection','Collection'],['booster_box','Box'],['precon','Precon'],['sealed','Sealed'],['singles','Singles']].map(([id,l]) => (
                  <button key={id} onClick={() => setFormData({ ...formData, cogsType: id })} style={{ padding: '8px', borderRadius: '8px', border: `1px solid ${formData.cogsType===id?C.teal:C.border}`, background: formData.cogsType===id?'rgba(45,191,184,0.1)':C.inputBg, fontSize: '12px', fontWeight: formData.cogsType===id?'bold':'normal', cursor: 'pointer', color: formData.cogsType===id?'#1A7A75':C.text, fontFamily: FONT }}>{l}</button>
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
            {['booster_box','precon'].includes(formData.cogsType) && (
              <div><span style={lbl}>Cards Per Unit</span>
                <select value={formData.cogsCardsPerBox} onChange={e => setFormData({ ...formData, cogsCardsPerBox: e.target.value })} style={inp}>
                  <option value="">Select...</option>
                  <option value="540">MTG Draft Box (540)</option><option value="360">MTG Set/Play Box (360)</option>
                  <option value="150">MTG Collector Box (150)</option><option value="100">MTG Commander Precon (100)</option>
                  <option value="60">Pokemon Starter (60)</option><option value="240">YGO Box (240)</option>
                </select>
              </div>
            )}
            <div><span style={lbl}>Est. Sell Value ($)</span><input type="number" step="0.01" value={formData.cogsEstValue} onChange={e => setFormData({ ...formData, cogsEstValue: e.target.value })} placeholder="0.00" style={inp} /></div>
            {formData.cogsCost && (() => { const p = cogsPreview(); return (<div style={{ padding:'10px', borderRadius:'8px', background:'rgba(45,191,184,0.08)', fontSize:'14px', color:'#1A7A75', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}><span>Total: <strong>{fmt(p.total)}</strong></span><span>Units: <strong>{p.units.toLocaleString()}</strong></span><span>Per unit: <strong>${p.cpu.toFixed(3)}</strong></span>{formData.cogsEstValue&&<span>Margin: <strong>{p.total>0?(((parseFloat(formData.cogsEstValue)-p.total)/p.total)*100).toFixed(1)+'%':'—'}</strong></span>}</div>) })()}
          </>}

          {!['mileage_log','cogs_inventory','assets','bank_accounts','accounts_payable','supply_costs'].includes(t) && <>
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
            </> : <div><span style={lbl}>{t==='sales'?'Platform':t==='payroll'?'Employee':'Recipient'}</span><input value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="..." style={inp} /></div>}
            <div><span style={lbl}>Amount ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" style={inp} /></div>
            {t==='sales' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><span style={lbl}>Fees ($)</span><input type="number" step="0.01" value={formData.fees} onChange={e => setFormData({ ...formData, fees: e.target.value })} placeholder="0.00" style={inp} /></div>
                <div><span style={lbl}>Shipping Cost ($)</span><input type="number" step="0.01" value={formData.shipping} onChange={e => setFormData({ ...formData, shipping: e.target.value })} placeholder="0.00" style={inp} /></div>
              </div>
            )}
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
            {t==='disbursements' && <div><span style={lbl}>Notes</span><textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Internal notes" style={{ ...inp, height: '70px', resize: 'vertical' }} /></div>}
          </>}

          <button onClick={handleSave} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', padding: '16px', borderRadius: '12px', fontWeight: 900, border: 'none', fontSize: '16px', cursor: 'pointer', marginTop: '4px', fontFamily: FONT }}>
            {isEditing ? 'UPDATE RECORD' : 'SAVE RECORD'}
          </button>
        </div>
      </div>
    )
  }

  // ── Accounting sub-components ────────────────────────────────────────
  const PLRow = ({ label, value, indent = false, bold = false, isNegative = false, showDrilldown = false, drillId = '' }: any) => (
    <div onClick={showDrilldown ? () => setAcctDrilldown(acctDrilldown === drillId ? null : drillId) : undefined}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${bold ? '12px' : '8px'} 0`, borderBottom: `1px solid ${C.border}`, paddingLeft: indent ? '16px' : '0', cursor: showDrilldown ? 'pointer' : 'default', background: showDrilldown && acctDrilldown === drillId ? 'rgba(45,191,184,0.04)' : 'transparent' }}>
      <span style={{ fontSize: bold ? '15px' : '14px', fontWeight: bold ? 700 : 400, color: bold ? C.navy : C.text, fontFamily: FONT }}>{showDrilldown && '▸ '}{label}</span>
      <span style={{ fontSize: bold ? '16px' : '14px', fontWeight: bold ? 700 : 400, color: (value < 0 || isNegative) ? '#ef4444' : (bold && value > 0 ? C.green : C.text), fontFamily: FONT }}>
        {(value < 0 || isNegative) ? `(${fmt(Math.abs(value))})` : fmt(Math.abs(value))}
      </span>
    </div>
  )
  const DD = ({ children }: any) => <div style={{ background: C.inputBg, borderRadius: '8px', padding: '10px', marginBottom: '4px' }}>{children}</div>
  const DDRow = ({ label, value, neg = false }: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: neg ? '#ef4444' : C.green }}>{neg ? `(${fmt(value)})` : fmt(value)}</span>
    </div>
  )

  // ── Bulk Add Modal ───────────────────────────────────────────────────
  const renderBulkModal = () => {
    if (!bulkAddOpen) return null
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.92)', display: 'flex', alignItems: 'flex-end', zIndex: 2000, fontFamily: FONT }}>
        <div style={{ background: C.white, width: '100%', borderRadius: '20px 20px 0 0', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontWeight: 900, color: C.navy, fontSize: '17px' }}>BULK ADD</h2>
            <button onClick={() => { setBulkAddOpen(false); setBulkRows([]) }} style={{ background: 'none', border: 'none', fontSize: '24px', color: C.muted, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
            <div><span style={lbl}>Record Type</span>
              <select value={bulkTable} onChange={e => setBulkTable(e.target.value)} style={inp}>
                <option value="mileage_log">Mileage</option>
                <option value="expenses">Expenses</option>
                <option value="sales">Sales</option>
                <option value="payroll">Payroll</option>
              </select>
            </div>
            <div><span style={lbl}>Logged By</span>
              <select value={bulkUser} onChange={e => setBulkUser(e.target.value)} style={inp}>
                <option value="Cam">Cam</option><option value="Kenny">Kenny</option>
              </select>
            </div>
            <div style={{ padding: '12px', background: 'rgba(45,191,184,0.05)', borderRadius: '10px', border: `1px dashed ${C.teal}` }}>
              <div style={{ fontSize: '11px', color: C.teal, fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Defaults — apply to all rows</div>
              {bulkTable === 'mileage_log' && (
                <div style={{ display: 'grid', gap: '6px' }}>
                  <input value={bulkDefaults.purpose||''} onChange={e => setBulkDefaults({ ...bulkDefaults, purpose: e.target.value })} placeholder="Purpose (e.g. USPS drop-off)" style={inp} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <input value={bulkDefaults.from_location||''} onChange={e => setBulkDefaults({ ...bulkDefaults, from_location: e.target.value })} placeholder="From (Home)" style={inp} />
                    <input value={bulkDefaults.to_location||''} onChange={e => setBulkDefaults({ ...bulkDefaults, to_location: e.target.value })} placeholder="To (USPS)" style={inp} />
                  </div>
                  <input type="number" step="0.1" value={bulkDefaults.miles||''} onChange={e => setBulkDefaults({ ...bulkDefaults, miles: e.target.value })} placeholder="Miles per trip (3.0)" style={inp} />
                </div>
              )}
              {bulkTable === 'expenses' && (
                <div style={{ display: 'grid', gap: '6px' }}>
                  <select value={bulkDefaults.category||'Supplies & Packaging'} onChange={e => setBulkDefaults({ ...bulkDefaults, category: e.target.value })} style={inp}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input value={bulkDefaults.notes||''} onChange={e => setBulkDefaults({ ...bulkDefaults, notes: e.target.value })} placeholder="Default description (optional)" style={inp} />
                </div>
              )}
              {bulkTable === 'sales' && <input value={bulkDefaults.platform||''} onChange={e => setBulkDefaults({ ...bulkDefaults, platform: e.target.value })} placeholder="Platform (tcgplayer, ebay, manapool)" style={inp} />}
              {bulkTable === 'payroll' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <select value={bulkDefaults.employee_name||''} onChange={e => setBulkDefaults({ ...bulkDefaults, employee_name: e.target.value })} style={inp}>
                    <option value="">Select employee</option>
                    <option value="Kiedan">Kiedan</option><option value="Kayliana">Kayliana</option>
                  </select>
                  <input type="number" step="0.01" value={bulkDefaults.hourly_rate||'16'} onChange={e => setBulkDefaults({ ...bulkDefaults, hourly_rate: e.target.value })} placeholder="Hourly rate" style={inp} />
                </div>
              )}
            </div>
            <div><span style={lbl}>Date Selection</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                {(['single','range','week','month'] as const).map(m => (
                  <button key={m} onClick={() => setBulkDateMode(m)} style={{ padding: '8px 4px', borderRadius: '8px', border: `1px solid ${bulkDateMode===m?C.teal:C.border}`, background: bulkDateMode===m?'rgba(45,191,184,0.1)':C.inputBg, fontSize: '12px', fontWeight: bulkDateMode===m?'bold':'normal', cursor: 'pointer', color: bulkDateMode===m?'#1A7A75':C.text, fontFamily: FONT, textTransform: 'capitalize' }}>{m}</button>
                ))}
              </div>
              {bulkDateMode === 'single' && <input type="date" value={bulkDateFrom} onChange={e => setBulkDateFrom(e.target.value)} style={inp} />}
              {bulkDateMode === 'range' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><span style={lbl}>From</span><input type="date" value={bulkDateFrom} onChange={e => setBulkDateFrom(e.target.value)} style={inp} /></div>
                  <div><span style={lbl}>To</span><input type="date" value={bulkDateTo} onChange={e => setBulkDateTo(e.target.value)} style={inp} /></div>
                </div>
              )}
              {(bulkDateMode === 'week' || bulkDateMode === 'month') && <div><span style={lbl}>Any date in the {bulkDateMode}</span><input type="date" value={bulkDateFrom} onChange={e => setBulkDateFrom(e.target.value)} style={inp} /></div>}
            </div>
            <button onClick={initBulkRows} style={{ padding: '12px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Generate Rows</button>
          </div>
          {bulkRows.length > 0 && <>
            <div style={{ fontSize: '12px', color: C.muted, marginBottom: '8px' }}>Check/uncheck rows to include.</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button onClick={() => setBulkRows(bulkRows.map(r => ({ ...r, selected: true })))} style={editBtn}>Select All</button>
              <button onClick={() => setBulkRows(bulkRows.map(r => ({ ...r, selected: false })))} style={editBtn}>Deselect All</button>
              {bulkTable === 'mileage_log' && <button onClick={() => setBulkRows(bulkRows.map(r => { const d = new Date(r.date + 'T12:00:00').getDay(); return { ...r, selected: d !== 0 && d !== 6 } }))} style={editBtn}>Weekdays Only</button>}
            </div>
            {bulkRows.map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <input type="checkbox" checked={row.selected} onChange={e => { const u = [...bulkRows]; u[i].selected = e.target.checked; setBulkRows(u) }} style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: C.muted, minWidth: '70px' }}>{row.date} {new Date(row.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'})}</span>
                {bulkTable === 'mileage_log' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', flex: 1 }}>
                    <input value={row.purpose} onChange={e => { const u=[...bulkRows]; u[i].purpose=e.target.value; setBulkRows(u) }} style={{ ...inp, padding: '5px 8px', fontSize: '12px' }} placeholder="Purpose" />
                    <input type="number" step="0.1" value={row.miles} onChange={e => { const u=[...bulkRows]; u[i].miles=e.target.value; setBulkRows(u) }} style={{ ...inp, padding: '5px 8px', fontSize: '12px' }} placeholder="Miles" />
                  </div>
                )}
                {bulkTable === 'expenses' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', flex: 1 }}>
                    <select value={row.category} onChange={e => { const u=[...bulkRows]; u[i].category=e.target.value; setBulkRows(u) }} style={{ ...inp, padding: '5px 8px', fontSize: '12px' }}>
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="number" step="0.01" value={row.cost} onChange={e => { const u=[...bulkRows]; u[i].cost=e.target.value; setBulkRows(u) }} style={{ ...inp, padding: '5px 8px', fontSize: '12px' }} placeholder="Amount $" />
                  </div>
                )}
                {bulkTable === 'sales' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', flex: 1 }}>
                    <input value={row.platform} onChange={e => { const u=[...bulkRows]; u[i].platform=e.target.value; setBulkRows(u) }} style={{ ...inp, padding: '5px 8px', fontSize: '12px' }} placeholder="Platform" />
                    <input type="number" step="0.01" value={row.amount} onChange={e => { const u=[...bulkRows]; u[i].amount=e.target.value; setBulkRows(u) }} style={{ ...inp, padding: '5px 8px', fontSize: '12px' }} placeholder="Amount $" />
                  </div>
                )}
                {bulkTable === 'payroll' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', flex: 1 }}>
                    <input value={row.employee_name} onChange={e => { const u=[...bulkRows]; u[i].employee_name=e.target.value; setBulkRows(u) }} style={{ ...inp, padding: '5px 8px', fontSize: '12px' }} placeholder="Employee" />
                    <input type="number" step="0.5" value={row.hours_worked} onChange={e => { const u=[...bulkRows]; u[i].hours_worked=e.target.value; setBulkRows(u) }} style={{ ...inp, padding: '5px 8px', fontSize: '12px' }} placeholder="Hours" />
                  </div>
                )}
              </div>
            ))}
            <button onClick={saveBulkRows} style={{ width: '100%', marginTop: '16px', padding: '14px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '15px', fontFamily: FONT }}>
              Save {bulkRows.filter(r=>r.selected).length} Records
            </button>
          </>}
        </div>
      </div>
    )
  }
  // ── Tab Renderer ─────────────────────────────────────────────────────
  const renderTab = () => {
    switch (activeTab) {

      case 'summary': return (
        <div>
          {(pendingReviewCount > 0 || duplicateWarning) && (
            <div onClick={() => setImportQueueOpen(true)} style={{ ...card, cursor: 'pointer', background: duplicateWarning ? 'rgba(232,64,122,0.08)' : 'rgba(240,192,64,0.1)', border: `1px solid ${duplicateWarning ? C.pink : C.gold}`, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: duplicateWarning ? C.pink : '#7A5A00', fontSize: '15px' }}>{duplicateWarning ? '⚠️ Duplicate File Warning' : `📋 ${pendingReviewCount} import${pendingReviewCount === 1 ? '' : 's'} pending review`}</div>
                <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{duplicateWarning ? duplicateWarning.message : 'Tap to review and approve flagged imports'}</div>
              </div>
              <div style={{ color: duplicateWarning ? C.pink : C.gold, fontSize: '20px' }}>→</div>
            </div>
          )}
          <div style={{ background: isDark ? `linear-gradient(135deg,#0A0F1E,#111D33)` : `linear-gradient(135deg,${C.navyDark},${C.navy})`, color: '#fff', padding: '28px', borderRadius: '20px', marginBottom: '12px', fontFamily: FONT }}>
            <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>GROSS REVENUE</div>
            <div style={{ fontSize: '32px', fontWeight: 400, marginBottom: '16px' }}>{fmtK(gross)}</div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', marginBottom: '16px' }} />
            <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>TOTAL COSTS</div>
            <div style={{ fontSize: '32px', fontWeight: 400, color: '#fda4af', marginBottom: '16px' }}>{fmtK(-totalCosts)}</div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', marginBottom: '16px' }} />
            <div style={{ opacity: 0.6, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>NET REVENUE</div>
            <div style={{ fontSize: '46px', fontWeight: 900, color: netRevenue >= 0 ? '#4ade80' : '#fda4af' }}>{fmtK(netRevenue)}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            {[
              { label: 'Gross Margin %', value: pctFmt(grossMargin, netSalesAmt), color: grossMargin >= 0 ? C.teal : C.pink },
              { label: 'Net Margin %', value: pctFmt(netIncome, netSalesAmt), color: netIncome >= 0 ? C.teal : C.pink },
              { label: 'COGS Ratio', value: pctFmt(cogsRecognized, netSalesAmt), color: C.purple },
              { label: 'OpEx Ratio', value: pctFmt(totalOpEx, netSalesAmt), color: C.gold },
            ].map(t => (
              <div key={t.label} style={{ ...card, padding: '14px', marginBottom: 0, textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>{t.label}</div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: t.color }}>{t.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            {[['Selling Fees', fmt(-totalPlatformFees)], ['Op. Expenses', fmt(-opExpenses)], ['Accounts Payable', fmt(-totalAPOwed)], ['Payroll', fmt(-staffingCosts)]].map(([l, v]) => (
              <div key={String(l)} style={{ ...card, padding: '14px', marginBottom: 0 }}>
                <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>{l}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#fda4af' }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>SOLE PROP</div><div style={{ fontSize: '14px', fontWeight: 700, color: C.gold }}>Jan 1 – Mar 17</div></div>
            <div style={{ color: C.border, fontSize: '20px' }}>→</div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>MANA SOCIAL LLC</div><div style={{ fontSize: '14px', fontWeight: 700, color: C.teal }}>Mar 18 – Dec 31</div></div>
                    </div>
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
              <button onClick={() => salesFileRef.current?.click()} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.inputBg, fontSize: '14px', fontWeight: 'bold', color: C.navy, cursor: 'pointer', fontFamily: FONT }}>Upload file</button>
              <button onClick={syncManaPool} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${C.teal}`, background: 'rgba(45,191,184,0.08)', fontSize: '14px', fontWeight: 'bold', color: C.teal, cursor: 'pointer', fontFamily: FONT }}>Sync ManaPool</button>
            </div>
            <input ref={salesFileRef} type="file" accept="image/*,.pdf,.csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => {​​​​​​​​​​​​​​​​
