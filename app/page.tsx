'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import * as XLSX from 'xlsx'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs'
}

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

async function parseChaseStatementPDF(file: File): Promise<{ records: any[], meta: any }> {
  const arrayBuf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise
  let fullText = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    let lastY: number | null = null
    for (const item of content.items as any[]) {
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) fullText += '\n'
      else if (fullText.length && !fullText.endsWith('\n')) fullText += ' '
      fullText += item.str
      lastY = y
    }
    fullText += '\n'
  }

  // Detect statement year from "through Month DD, YYYY"
  const yearMatch = fullText.match(/through\s+\w+\s+\d{1,2},\s+(\d{4})/)
  const stmtYear = yearMatch ? yearMatch[1] : String(new Date().getFullYear())

  const records: any[] = []
  const lines = fullText.split('\n')
  // Chase rows start with MM/DD and contain an amount + running balance
  const rowRegex = /^(\d{2})\/(\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/
  for (const line of lines) {
    const m = line.trim().match(rowRegex)
    if (!m) continue
    const [, mm, dd, descRaw, amtRaw] = m
    const desc = descRaw.replace(/\s+/g, ' ').trim()
    if (/Beginning Balance|Ending Balance/i.test(desc)) continue
    let amount = parseFloat(amtRaw.replace(/,/g, ''))
    // Chase shows withdrawals with a leading minus; deposits are positive
    const isDebit = amtRaw.trim().startsWith('-')
    if (!isDebit && amount > 0) amount = Math.abs(amount)
    const txnDate = `${stmtYear}-${mm}-${dd}`
    records.push({
      transaction_date: txnDate,
      description: desc.slice(0, 200),
      amount: amount,
      account_name: 'Chase Business Checking',
    })
  }
  return { records, meta: { rows: records.length, year: stmtYear, fileName: file.name } }
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
    
// --- Chase PDF Parsing Helpers ---
function parseChaseStatement(text: string) {
  const lines = text.split('\n')
  const txns: any[] = []

  // Pattern: MM/DD  DESCRIPTION  -$123.45
  const regex = /(\d{2}\/\d{2})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})/

  for (const raw of lines) {
    const line = raw.trim()
    const m = line.match(regex)
    if (!m) continue

    const [, mmdd, desc, amtStr] = m

    txns.push({
      transaction_date: convertChaseDate(mmdd),
      description: desc.trim(),
      amount: parseFloat(amtStr.replace(/[$,]/g, '')),
      account_name: 'Chase Business Checking',
      category: 'Other',
      is_business: true,
      notes: '',
    })
  }

  return txns
}

function convertChaseDate(mmdd: string) {
  const [m, d] = mmdd.split('/')
  const year = new Date().getFullYear()
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

    const parsed = parseChaseStatement(text)

    setReconUploadPreview(parsed.map(r => ({ ...r, _selected: true })))
    setReconUploadStatus(`Parsed ${parsed.length} transactions`)
  } catch (err: any) {
    console.error(err)
    setReconUploadStatus('Error reading PDF')
  }
}

// --- PDF Upload Handler ---
async function handleReconPdfUpload(file: File) {
  try {
    setReconUploadStatus('Reading PDF…')

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((it: any) => it.str).join(' ') + '\n'
    }

    const parsed = parseChaseStatement(text)

    setReconUploadPreview(parsed.map(r => ({ ...r, _selected: true })))
    setReconUploadStatus(`Parsed ${parsed.length} transactions`)
  } catch (err: any) {
    console.error(err)
    setReconUploadStatus('Error reading PDF')
  }
}
  
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null)
  const [bulkTable, setBulkTable] = useState('mileage_log')
  const [bulkRows, setBulkRows] = useState<any[]>([])
  const [bulkDateMode, setBulkDateMode] = useState<'single'|'range'|'week'|'month'>('single')
  const [bulkDateFrom, setBulkDateFrom] = useState(new Date().toISOString().split('T')[0])
  const [bulkDateTo, setBulkDateTo] = useState(new Date().toISOString().split('T')[0])
  const [bulkUser, setBulkUser] = useState('Cam')
  const [bulkDefaults, setBulkDefaults] = useState<any>({})
  const [reconTransactions, setReconTransactions] = useState<any[]>([])
  const [reconAccount, setReconAccount] = useState('All')
  const [reconShowReconciled, setReconShowReconciled] = useState(false)
  const [reconShowAddForm, setReconShowAddForm] = useState(false)
  const [reconUploadPreview, setReconUploadPreview] = useState<any[]>([])
  const [reconUploadStatus, setReconUploadStatus] = useState('')
  const reconFileRef = useRef<HTMLInputElement>(null)
  const [reconNewTxn, setReconNewTxn] = useState({
  account_name: 'Chase Business Checking',
  transaction_date: new Date().toISOString().split('T')[0],
  description: '',
  amount: '',
  category: 'Other',
  is_business: true,
  notes: '',
})
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
    const [s, e, ap, p, d, ml, ci, allCI, ast, ba, sc, bst] = await Promise.all([
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
    setReconTransactions(bst.data || [])
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

  const confirmReconImport = async () => {
    const toImport = reconUploadPreview.filter(r => r._selected)
    if (toImport.length === 0) return alert('No transactions selected')
    setReconUploadStatus('Importing...')
    const { error } = await supabase.from('bank_statement_transactions').insert(
      toImport.map(r => ({
        account_name: r.account_name,
        transaction_date: r.transaction_date,
        description: r.description,
        amount: r.amount,
        category: r.category || 'Other',
        is_business: r.is_business,
        is_reconciled: false,
        entity: getEntity(r.transaction_date),
        notes: '',
      }))
    )
    if (error) { setReconUploadStatus('Error: ' + error.message); return }
    setReconUploadPreview([])
    setReconUploadStatus(`Imported ${toImport.length} transactions ✓`)
    fetchData()
    setTimeout(() => setReconUploadStatus(''), 4000)
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
            <input ref={salesFileRef} type="file" accept="image/*,.pdf,.csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'sales'); e.target.value = '' }} />
            <div style={{ fontSize: '12px', color: C.muted }}>TCGplayer .xlsx · eBay .csv · ManaPool .csv · photos · PDFs</div>
            {syncStatus && <div style={{ marginTop: '8px', fontSize: '13px', color: C.teal }}>{syncStatus}</div>}
          </div>
          {renderUploadPreview()}
          {(() => {
            const platforms = Array.from(new Set(sales.map(s => s.platform)))
            if (platforms.length === 0) return <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No sales this period</div>
            return platforms.map(platform => {
              const ps = sales.filter(s => s.platform === platform)
              const pt = ps.reduce((a, s) => a + Number(s.amount), 0)
              const pf = ps.reduce((a, s) => a + Number(s.fees||0) + Number(s.shipping||0), 0)
              const isOpen = expandedTiles[`sales_${platform}`]
              return (
                <div key={platform} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <div onClick={() => setExpandedTiles(prev => ({ ...prev, [`sales_${platform}`]: !prev[`sales_${platform}`] }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer', background: isOpen ? 'rgba(45,191,184,0.04)' : 'transparent' }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '15px', textTransform: 'capitalize', color: C.navy }}>{platform}</div>
                      <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{ps.length} record{ps.length !== 1 ? 's' : ''} · Fees {fmt(pf)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 900, color: C.green, fontSize: '18px' }}>{fmt(pt)}</span>
                      <span style={{ color: C.muted, fontSize: '14px' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${C.border}` }}>
                      {ps.map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.period_start && s.period_start !== s.sale_date ? `${s.period_start} – ${s.period_end}` : s.sale_date}</div>
                            <div style={{ fontSize: '12px', color: C.muted }}>Fees {fmt(Number(s.fees||0)+Number(s.shipping||0))} · {s.num_orders||1} orders</div>
                            <div style={{ fontSize: '11px', color: s.entity === 'llc' ? C.teal : C.gold }}>{s.entity === 'llc' ? 'LLC' : 'Sole Prop'}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, color: C.green, fontSize: '15px' }}>{fmt(Number(s.amount))}</span>
                            <button onClick={() => startEdit('sales', s)} style={editBtn}>Edit</button>
                            <button onClick={() => handleDelete('sales', s.id)} style={delBtn}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      )

      case 'expense': return (
        <div>
          <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>TOTAL EXPENSES</div>
            <div style={{ fontSize: '30px', fontWeight: 900, color: '#fda4af' }}>{fmt(opExpenses + totalAPOwed)}</div>
          </div>
          {(() => {
            const totalOwed = accountsPayable.reduce((a, r) => a + Math.max(0, Number(r.total_amount) - Number(r.amount_paid||0)), 0)
            const totalAP = accountsPayable.reduce((a, r) => a + Number(r.total_amount), 0)
            const isOpen = expandedTiles['ap_tile']
            return (
              <div style={{ ...card, border: `1px solid rgba(240,192,64,0.4)`, padding: 0, overflow: 'hidden' }}>
                <div onClick={() => setExpandedTiles(prev => ({ ...prev, ap_tile: !prev.ap_tile }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer', background: isOpen ? 'rgba(240,192,64,0.06)' : 'transparent' }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: '15px', color: '#7A5A00' }}>Accounts Payable</div>
                    <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{accountsPayable.length} transaction{accountsPayable.length !== 1 ? 's' : ''} · Total {fmt(totalAP)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, fontSize: '18px', color: totalOwed > 0 ? C.pink : C.teal }}>{fmt(totalOwed)}</div>
                      <div style={{ fontSize: '11px', color: C.muted }}>outstanding</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button onClick={e => { e.stopPropagation(); setEditingItem({ table: 'accounts_payable' }) }} style={{ background: C.gold, color: '#7A5A00', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>+ Add</button>
                      <span style={{ color: C.muted, fontSize: '14px' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop: `1px solid rgba(240,192,64,0.3)` }}>
                    {accountsPayable.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '13px' }}>No accounts payable recorded</div>
                    ) : accountsPayable.map(b => {
                      const paid = Number(b.amount_paid||0), owed = Number(b.total_amount) - paid
                      const pct = Number(b.total_amount) > 0 ? (paid / Number(b.total_amount) * 100) : 0
                      return (
                        <div key={b.id} style={{ padding: '14px 16px', borderBottom: `1px solid rgba(240,192,64,0.2)` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '15px' }}>{b.vendor_name}</div>
                              {b.description && <div style={{ fontSize: '12px', color: C.muted }}>{b.description}</div>}
                              {b.notes && b.notes.includes('cards @') && <div style={{ fontSize: '12px', color: C.purple, fontWeight: 700 }}>{b.notes.split('|')[1]?.trim()}</div>}
                              <div style={{ fontSize: '11px', color: C.muted }}>{b.invoice_date}{b.due_date && b.due_date !== b.invoice_date ? ` · Due ${b.due_date}` : ''}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                              <div style={{ fontSize: '15px', fontWeight: 700, color: owed > 0 ? C.pink : C.teal }}>{fmt(owed)} {owed <= 0 ? '✓' : 'left'}</div>
                              <div style={{ fontSize: '11px', color: C.muted }}>of {fmt(Number(b.total_amount))}</div>
                            </div>
                          </div>
                          <div style={{ height: '5px', background: C.border, borderRadius: '3px', margin: '6px 0' }}>
                            <div style={{ height: '100%', width: `${Math.min(pct,100)}%`, background: pct >= 100 ? C.teal : C.gold, borderRadius: '3px' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: C.muted, marginBottom: '6px' }}>
                            <span>Paid: {fmt(paid)}</span><span>{pct.toFixed(0)}% complete</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => startEdit('accounts_payable', b)} style={editBtn}>Update</button>
                            <button onClick={() => handleDelete('accounts_payable', b.id)} style={{ ...editBtn, color: C.pink }}>Delete</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
          <div style={{ ...card, padding: '14px' }}>
            <span style={secHdr}>IMPORT EXPENSES</span>
            <button onClick={() => expFileRef.current?.click()} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.inputBg, fontSize: '14px', fontWeight: 'bold', color: C.navy, cursor: 'pointer', fontFamily: FONT }}>Upload receipt / Amazon CSV / photo</button>
            <input ref={expFileRef} type="file" accept="image/*,.pdf,.csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'expenses'); e.target.value = '' }} />
            <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px' }}>Amazon orders .csv · receipts · PDFs</div>
          </div>
          {renderUploadPreview()}
          {uniqueSupplyItems.length > 0 && (() => {
            const isOpen = expandedTiles['supply_tile']
            const shipItems = ['Penny Sleeve','Semi-Rigid Card Saver','Team Bag','A6 Envelope','Forever Stamp','LetterTrack Pro']
            let shipTotal = 0
            const shipRows = shipItems.map(item => { const cost = getLatestSupplyCost(item); shipTotal += cost; return { item, cost } }).filter(r => r.cost > 0)
            return (
              <div style={{ ...card, border: `1px solid rgba(107,63,160,0.25)`, padding: 0, overflow: 'hidden' }}>
                <div onClick={() => setExpandedTiles(prev => ({ ...prev, supply_tile: !prev.supply_tile }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: C.purple, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supply Cost Tracker</span>
                    <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{uniqueSupplyItems.length} items tracked</div>
                    {shipTotal > 0 && <div style={{ fontSize: '12px', color: C.purple }}>Per shipment: ${shipTotal.toFixed(4)}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={e => { e.stopPropagation(); setEditingItem({ table: 'supply_costs' }) }} style={{ background: C.purple, color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>+ Add</button>
                    <span style={{ color: C.muted, fontSize: '14px' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 16px' }}>
                    {uniqueSupplyItems.map(item => {
                      const history = supplyCosts.filter(s => s.item_name === item).sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())
                      const latest = history[0]
                      return (
                        <div key={item} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '14px' }}>{item}</div>
                              <div style={{ fontSize: '12px', color: C.muted }}>{latest.unit_description} · as of {latest.effective_date}</div>
                            </div>
                            <div style={{ fontWeight: 700, color: C.purple, fontSize: '15px' }}>${parseFloat(latest.cost_per_unit).toFixed(4)}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            <button onClick={() => startEdit('supply_costs', latest)} style={editBtn}>Update price</button>
                            <button onClick={() => handleDelete('supply_costs', latest.id)} style={{ ...editBtn, color: C.pink }}>Delete</button>
                          </div>
                        </div>
                      )
                    })}
                    {shipRows.length > 0 && (
                      <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(107,63,160,0.06)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '11px', color: C.purple, fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>Shipping Cost Calculator</div>
                        {shipRows.map(r => (
                          <div key={r.item} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0' }}>
                            <span style={{ color: C.muted }}>{r.item}</span><span>${r.cost.toFixed(4)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, padding: '6px 0 0', borderTop: `1px solid ${C.border}`, marginTop: '4px' }}>
                          <span>Per shipment</span><span style={{ color: C.purple }}>${shipTotal.toFixed(4)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
          {(() => {
            const cats = EXPENSE_CATEGORIES.filter(cat => expenses.some(e => e.category === cat))
            if (cats.length === 0) return <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No expenses this period</div>
            return cats.map(cat => {
              const catExpenses = expenses.filter(e => e.category === cat)
              const catTotal = catExpenses.reduce((a, e) => a + Number(e.cost), 0)
              const isOpen = expandedTiles[`exp_${cat}`]
              const rule = DEDUCTIBILITY[cat]
              return (
                <div key={cat} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <div onClick={() => setExpandedTiles(prev => ({ ...prev, [`exp_${cat}`]: !prev[`exp_${cat}`] }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer', background: isOpen ? 'rgba(232,64,122,0.03)' : 'transparent' }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '15px', color: C.navy }}>{cat}</div>
                      <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
                        {catExpenses.length} item{catExpenses.length !== 1 ? 's' : ''}
                        {rule && <span style={{ marginLeft: '6px', padding: '1px 5px', borderRadius: '3px', background: rule.pct === 100 ? '#E1F5EE' : '#FEF3E2', color: rule.pct === 100 ? '#085041' : '#7A5A00', fontSize: '11px' }}>{rule.label}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 900, color: '#ef4444', fontSize: '18px' }}>{fmt(-catTotal)}</span>
                      <span style={{ color: C.muted, fontSize: '14px' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${C.border}` }}>
                      {catExpenses.map(e => (
                        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                          <div>
                            {e.notes && <div style={{ fontSize: '13px', fontWeight: 600 }}>{e.notes}</div>}
                            <div style={{ fontSize: '12px', color: C.muted }}>{e.purchase_date}</div>
                            <div style={{ fontSize: '11px', padding: '1px 5px', borderRadius: '3px', display: 'inline-block', marginTop: '2px', background: e.paid_by_company ? 'rgba(16,185,129,0.12)' : 'rgba(240,192,64,0.15)', color: e.paid_by_company ? '#085041' : '#7A5A00' }}>
                              {e.user_name || 'Cam'}{e.paid_by_company ? ' — LLC' : ' — personal'}
                            </div>
                            {e.asset_created && <div style={{ fontSize: '11px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(107,63,160,0.12)', color: C.purple, display: 'inline-block', marginLeft: '4px' }}>→ Asset</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                            <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '15px' }}>{fmt(-Number(e.cost))}</span>
                            <button onClick={() => startEdit('expenses', e)} style={editBtn}>Edit</button>
                            <button onClick={() => handleDelete('expenses', e.id)} style={delBtn}>×</button>
                          </div>
                        </div>
                      ))}
                      <div style={{ padding: '10px 16px', background: C.inputBg, display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
                        <span>{cat} Total</span><span style={{ color: '#ef4444' }}>{fmt(-catTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      )

      case 'assets': return (
        <div>
          <div style={{ ...card, background: `linear-gradient(135deg,${C.purple},#4A2070)`, color: '#fff', padding: '20px', marginBottom: '12px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', background: 'rgba(240,192,64,0.25)', color: '#FFD96B', borderRadius: '4px' }}>WIP — singles tracking coming soon</div>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>INVENTORY VALUE (COST BASIS)</div>
            <div style={{ fontSize: '32px', fontWeight: 400 }}>{fmt(endingInventory)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '14px' }}>
              <div><div style={{ fontSize: '10px', opacity: 0.6 }}>TOTAL LOTS</div><div style={{ fontSize: '18px', fontWeight: 700 }}>{allCogsInventory.length}</div></div>
              <div><div style={{ fontSize: '10px', opacity: 0.6 }}>COGS RECOGNIZED</div><div style={{ fontSize: '18px', fontWeight: 700, color: '#fda4af' }}>{fmt(cogsRecognized)}</div></div>
              <div><div style={{ fontSize: '10px', opacity: 0.6 }}>EST. MARGIN</div><div style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80' }}>{endingInventory > 0 ? ((allCogsInventory.reduce((a,r) => a + parseFloat(r.est_sell_value||0), 0) - endingInventory) / endingInventory * 100).toFixed(0) + '%' : '—'}</div></div>
            </div>
          </div>
          {allCogsInventory.length > 0 && (
            <div style={card}>
              <div onClick={() => setExpandedTiles(prev => ({ ...prev, inv_lots: !prev.inv_lots }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <span style={secHdr}>INVENTORY LOTS</span>
                <span style={{ color: C.muted, fontSize: '14px', marginTop: '-10px' }}>{expandedTiles.inv_lots ? '▲' : '▼'}</span>
              </div>
              {expandedTiles.inv_lots && allCogsInventory.map(r => {
                const ratio = r.total_units > 0 ? Math.min((r.sold_units||0)/r.total_units, 1) : 0
                const remaining = parseFloat(r.total_cost||0) * (1 - ratio)
                const pct = Math.round(ratio * 100)
                return (
                  <div key={r.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{r.description}</div>
                        <div style={{ fontSize: '11px', color: C.muted }}>{r.date} · {r.inventory_type} · {r.total_units} units</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: C.purple }}>{fmt(remaining)}</div>
                        <div style={{ fontSize: '11px', color: C.muted }}>{pct}% sold</div>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(27,42,74,0.1)', borderRadius: '2px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? C.teal : C.purple, borderRadius: '2px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <button onClick={() => startEdit('cogs_inventory', r)} style={editBtn}>Edit</button>
                      <button onClick={() => handleDelete('cogs_inventory', r.id)} style={delBtn}>×</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '16px 20px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px' }}>FIXED ASSETS (COST)</div>
            <div style={{ fontSize: '30px', fontWeight: 900 }}>{fmt(totalAssetCost)}</div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', opacity: 0.7 }}>
              <span>Book Value: {fmt(totalBookValue)}</span><span>Acc. Dep: {fmt(totalAccumulatedDep)}</span>
            </div>
          </div>
          <div style={{ ...card, padding: '14px' }}>
            <span style={secHdr}>DEPRECIATION SUMMARY · {selectedYear}</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ padding: '12px', background: C.inputBg, borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>STRAIGHT-LINE / YR</div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: C.purple }}>{fmt(totalDepreciation)}</div>
              </div>
              <div style={{ padding: '12px', background: C.inputBg, borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>SECTION 179 (FULL)</div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: C.teal }}>{fmt(totalAssetCost)}</div>
              </div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: C.muted, padding: '8px', background: 'rgba(240,192,64,0.08)', borderRadius: '8px' }}>Confirm with Kannie at tax time. Sec 179 = deduct full cost this year. Straight-line = spread over useful life.</div>
          </div>
          {ASSET_CATEGORIES.map(cat => {
            const catAssets = assets.filter(a => a.category === cat)
            if (!catAssets.length) return null
            return (
              <div key={cat} style={card}>
                <span style={secHdr}>{cat}</span>
                {catAssets.map(a => {
                  const life = parseInt(a.useful_life_yrs) || USEFUL_LIFE[a.category] || 5
                  const { slAnnual, slBookValue } = calcDepreciation(parseFloat(a.cost), life, a.purchase_date, selectedYear)
                  return (
                    <div key={a.id} style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div><div style={{ fontWeight: 700, fontSize: '15px' }}>{a.description}</div><div style={{ fontSize: '12px', color: C.muted }}>{a.purchase_date} · {life}yr · {a.user_name}</div></div>
                        <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700, fontSize: '15px' }}>{fmt(parseFloat(a.cost))}</div><div style={{ fontSize: '12px', color: C.muted }}>Book: {fmt(slBookValue)}</div></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
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
                  <input type="number" min="0" max="100" step="0.1" value={homeOfficePct} onChange={e => setHomeOfficePct(parseFloat(e.target.value) || 0)} style={{ ...inp, width: '80px' }} />
                  <span style={{ color: C.muted, fontSize: '14px' }}>% (e.g. 150/1500 sqft = 10%)</span>
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={lbl}>Internet & Phone Business Use %</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" min="0" max="100" step="1" value={internetPct} onChange={e => setInternetPct(parseFloat(e.target.value) || 0)} style={{ ...inp, width: '80px' }} />
                  <span style={{ color: C.muted, fontSize: '14px' }}>%</span>
                </div>
              </div>
              <div style={{ fontSize: '14px', color: C.text }}>Mileage: {MILEAGE_RATE * 100}¢/mile · {totalMiles.toFixed(1)} miles · <strong style={{ color: C.teal }}>{fmt(mileageDeduction)}</strong></div>
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
          <div>
            <span style={{ ...secHdr, paddingLeft: '4px' }}>EXPENSE DEDUCTIBILITY</span>
            {(() => {
              const cats = EXPENSE_CATEGORIES.filter(cat => expenses.some(e => e.category === cat))
              if (cats.length === 0) return <div style={{ ...card, textAlign: 'center', padding: '30px', color: C.muted }}>No expenses logged yet</div>
              return cats.map(cat => {
                const catExpenses = expenses.filter(e => e.category === cat)
                const rule = DEDUCTIBILITY[cat] || DEDUCTIBILITY['Other']
                const catTotal = catExpenses.reduce((a, e) => a + Number(e.cost), 0)
                const catDeductible = catExpenses.reduce((a, e) => {
                  const amt = Number(e.cost)
                  if (rule.pct === 100) return a + amt
                  if (rule.pct === 50) return a + amt * 0.5
                  if (cat === 'Home Office') return a + amt * (homeOfficePct / 100)
                  if (cat === 'Internet & Phone') return a + amt * (internetPct / 100)
                  return a
                }, 0)
                const isOpen = expandedTiles[`ded_${cat}`]
                return (
                  <div key={cat} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                    <div onClick={() => setExpandedTiles(prev => ({ ...prev, [`ded_${cat}`]: !prev[`ded_${cat}`] }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', background: isOpen ? 'rgba(45,191,184,0.04)' : 'transparent' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: '14px', color: C.navy }}>{cat}</div>
                        <div style={{ fontSize: '11px', padding: '1px 5px', borderRadius: '3px', display: 'inline-block', marginTop: '3px', background: rule.pct === 100 ? '#E1F5EE' : '#FEF3E2', color: rule.pct === 100 ? '#085041' : '#7A5A00' }}>{rule.label} · {rule.line}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 900, color: C.teal }}>{fmt(catDeductible)}</div>
                        <div style={{ fontSize: '11px', color: C.muted }}>saves {fmt(catDeductible * 0.313)}</div>
                        <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{isOpen ? '▲' : '▼'}</div>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ borderTop: `1px solid ${C.border}` }}>
                        {catExpenses.map(e => {
                          const amt = Number(e.cost)
                          const ded = rule.pct === 100 ? amt : rule.pct === 50 ? amt * 0.5 : cat === 'Home Office' ? amt * (homeOfficePct/100) : cat === 'Internet & Phone' ? amt * (internetPct/100) : 0
                          return (
                            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
                              <div>
                                {e.notes && <div style={{ fontSize: '13px', fontWeight: 600 }}>{e.notes}</div>}
                                <div style={{ fontSize: '11px', color: C.muted }}>{e.purchase_date} · {e.user_name || 'Cam'}</div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>{fmt(-amt)}</div>
                                <div style={{ fontSize: '11px', color: C.teal }}>→ {fmt(ded)} ded.</div>
                              </div>
                            </div>
                          )
                        })}
                        <div style={{ padding: '10px 16px', background: C.inputBg, display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 }}>
                          <span>Total</span>
                          <span>{fmt(catTotal)} → <span style={{ color: C.teal }}>{fmt(catDeductible)} deductible</span></span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={secHdr}>MILEAGE LOG</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => { setBulkTable('mileage_log'); setBulkAddOpen(true) }} style={{ ...editBtn, background: 'rgba(45,191,184,0.08)', borderColor: C.teal, color: C.teal }}>Bulk Add</button>
                <button onClick={() => setEditingItem({ table: 'mileage_log' })} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>+ Trip</button>
              </div>
            </div>
            {mileageLog.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: C.muted }}>No trips logged yet</div> : (() => {
              const users = Array.from(new Set(mileageLog.map(r => r.user_name || 'Cam')))
              return (
                <>
                  {users.map(user => {
                    const userTrips = mileageLog.filter(r => (r.user_name || 'Cam') === user)
                    const userMiles = userTrips.reduce((a, r) => a + parseFloat(r.miles||0), 0)
                    const isOpen = expandedTiles[`mile_${user}`]
                    return (
                      <div key={user} style={{ marginBottom: '8px', border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                        <div onClick={() => setExpandedTiles(prev => ({ ...prev, [`mile_${user}`]: !prev[`mile_${user}`] }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', cursor: 'pointer', background: isOpen ? 'rgba(45,191,184,0.04)' : C.inputBg }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>{user}</div>
                            <div style={{ fontSize: '12px', color: C.muted }}>{userTrips.length} trips · {userMiles.toFixed(1)} mi</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, color: C.teal }}>{fmt(userMiles * MILEAGE_RATE)}</span>
                            <span style={{ color: C.muted }}>{isOpen ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {isOpen && userTrips.map(r => (
                          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: `1px solid ${C.border}` }}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600 }}>{r.purpose}</div>
                              <div style={{ fontSize: '12px', color: C.muted }}>{r.date} · {r.from_location} → {r.to_location}</div>
                              <div style={{ fontSize: '12px', color: C.teal }}>{parseFloat(r.miles).toFixed(1)} mi · {fmt(parseFloat(r.miles) * MILEAGE_RATE)}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <button onClick={() => startEdit('mileage_log', r)} style={editBtn}>Edit</button>
                              <button onClick={() => handleDelete('mileage_log', r.id)} style={delBtn}>×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '14px', fontWeight: 700 }}>
                    <span>{totalMiles.toFixed(1)} total miles</span>
                    <span style={{ color: C.teal }}>{fmt(mileageDeduction)}</span>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )

      case 'tax': return (
        <div>
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(240,192,64,0.1)', border: '1px solid rgba(240,192,64,0.3)', marginBottom: '8px', fontSize: '13px', color: '#7A5A00', fontFamily: FONT }}>
            Estimates only — 22% federal. Confirm with Kannie before paying.
          </div>
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', marginBottom: '12px', fontSize: '13px', color: '#5B21B6', fontFamily: FONT }}>
            <strong>PTE Elective Tax (AB 150):</strong> LLC pays 9.3% CA tax on members behalf. LLC gets federal deduction — saves ~2% vs paying personally. Elect by filing FTB 3893. Confirm with Kannie.
          </div>
          <div style={{ ...card, background: C.navyDark, color: '#fff', padding: '20px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', opacity: 0.6, fontWeight: 'bold', letterSpacing: '1px', marginBottom: '4px' }}>YTD EST. TOTAL TAX</div>
            <div style={{ fontSize: '38px', fontWeight: 700, color: '#fda4af' }}>{fmtK(ytdTax)}</div>
          </div>
          {quarters.map(q => (
            <div key={q.label} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div><div style={{ fontWeight: 700, fontSize: '17px', color: C.navy }}>{q.label} 2026</div><div style={{ fontSize: '12px', color: C.muted }}>{q.start} – {q.end}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: '21px', fontWeight: 700, color: C.pink }}>{fmt(q.grand)}</div><div style={{ fontSize: '12px', color: C.muted }}>est. total</div></div>
              </div>
              {[['Form 941 — FICA', fmt(q.fica), `Due ${q.due941}`], ['Form 940 — FUTA', fmt(q.futa), 'Due Jan 31'], ['CA UI/ETT', fmt(q.caUI), `Due ${q.due941}`], ['1040-ES Federal', fmt(q.fedEst), `Due ${q.due1040}`], ['PTE Elective Tax (CA)', fmt(q.pte), `Due ${q.due1040}`]].map(([l, v, d]) => (
                <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontSize: '14px' }}>
                  <span>{l}</span>
                  <div style={{ textAlign: 'right' }}><span style={{ fontWeight: 700, color: C.pink, marginRight: '8px' }}>{v}</span><span style={{ fontSize: '12px', color: C.muted }}>{d}</span></div>
                </div>
              ))}
              <div style={{ marginTop: '10px', padding: '8px 10px', background: C.inputBg, borderRadius: '8px', fontSize: '12px', color: C.muted, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <span>Net rev: <strong style={{ color: C.text }}>{fmt(q.netRev)}</strong></span>
                <span>Exp: <strong style={{ color: C.text }}>{fmt(q.exp)}</strong></span>
                <span>Payroll: <strong style={{ color: C.text }}>{fmt(q.grossPay)}</strong></span>
                <span>Taxable: <strong style={{ color: C.text }}>{fmt(q.taxable)}</strong></span>
              </div>
            </div>
          ))}
          <div style={{ ...card, border: `1px solid rgba(45,191,184,0.25)` }}>
            <span style={secHdr}>CA LLC FEE (ANNUAL)</span>
            {(() => {
              const annualGross = sales.reduce((a, r) => a + Number(r.amount), 0)
              let llcFee = 0, feeLabel = 'No fee (under $250k gross)'
              if (annualGross >= 5000000) { llcFee = 11790; feeLabel = '$11,790 (over $5M)' }
              else if (annualGross >= 1000000) { llcFee = 6000; feeLabel = '$6,000 ($1M–$4.99M)' }
              else if (annualGross >= 500000) { llcFee = 2500; feeLabel = '$2,500 ($500k–$999k)' }
              else if (annualGross >= 250000) { llcFee = 900; feeLabel = '$900 ($250k–$499k)' }
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>LLC Fee — gross receipts based</div>
                    <div style={{ fontSize: '12px', color: C.muted }}>Due April 15 · FTB 3536 · Current gross: {fmt(annualGross)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: llcFee > 0 ? C.pink : C.teal }}>{llcFee > 0 ? fmt(llcFee) : '$0'}</div>
                    <div style={{ fontSize: '11px', color: C.muted }}>{feeLabel}</div>
                  </div>
                </div>
              )
            })()}
            <div style={{ marginTop: '8px', fontSize: '12px', color: C.muted, padding: '8px', background: 'rgba(45,191,184,0.06)', borderRadius: '6px' }}>Separate from the $800 franchise tax already paid. Kicks in at $250k gross.</div>
          </div>
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
            <div style={{ fontSize: '13px', opacity: 0.5, marginTop: '2px' }}>FICA: {fmt(staffingCosts * 0.153)} · FUTA: {fmt(staffingCosts * 0.006)}</div>
            <div style={{ fontSize: '13px', opacity: 0.5 }}>Roth IRA Contributed: {fmt(payroll.reduce((a, r) => a + Number(r.roth_ira_contributed || 0), 0))}</div>
          </div>
          {(() => {
            const employees = Array.from(new Set(payroll.map(p => p.employee_name)))
            if (employees.length === 0) return <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No payroll this period</div>
            return employees.map(emp => {
              const empPayroll = payroll.filter(p => p.employee_name === emp)
              const empTotal = empPayroll.reduce((a, p) => a + Number(p.amount), 0)
              const empHours = empPayroll.reduce((a, p) => a + Number(p.hours_worked || 0), 0)
              const empRoth = empPayroll.reduce((a, p) => a + Number(p.roth_ira_contributed || 0), 0)
              const isOpen = expandedTiles[`pay_${emp}`]
              return (
                <div key={emp} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <div onClick={() => setExpandedTiles(prev => ({ ...prev, [`pay_${emp}`]: !prev[`pay_${emp}`] }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer', background: isOpen ? 'rgba(45,191,184,0.04)' : 'transparent' }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '15px', color: C.navy }}>{emp}</div>
                      <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>
                        {empPayroll.length} payment{empPayroll.length !== 1 ? 's' : ''}
                        {empHours > 0 && ` · ${empHours.toFixed(1)} hrs`}
                        {empRoth > 0 && ` · Roth ${fmt(empRoth)}`}
                      </div>
                      <div style={{ fontSize: '12px', color: C.muted }}>FICA: {fmt(empTotal * 0.153)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 900, fontSize: '18px', color: C.text }}>{fmt(empTotal)}</span>
                      <span style={{ color: C.muted, fontSize: '14px' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${C.border}` }}>
                      {empPayroll.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.pay_date}{p.pay_period ? ` · Period ends ${p.pay_period}` : ''}</div>
                            {p.hours_worked > 0 && <div style={{ fontSize: '12px', color: C.muted }}>{p.hours_worked} hrs @ ${p.hourly_rate}/hr</div>}
                            {p.roth_ira_contributed > 0 && <div style={{ fontSize: '12px', color: C.teal }}>Roth IRA: {fmt(p.roth_ira_contributed)}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '15px' }}>{fmt(Number(p.amount))}</span>
                            <button onClick={() => startEdit('payroll', p)} style={editBtn}>Edit</button>
                            <button onClick={() => handleDelete('payroll', p.id)} style={delBtn}>×</button>
                          </div>
                        </div>
                      ))}
                      <div style={{ padding: '10px 16px', background: C.inputBg, display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
                        <span>{emp} Total</span><span>{fmt(empTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      )
        
case 'reconcile': return (
        <div>
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(45,191,184,0.1)', border: `1px solid rgba(45,191,184,0.25)`, marginBottom: '12px', fontSize: '12px', color: '#1A7A75', fontWeight: 'bold', fontFamily: FONT }}>
            🏦 Bank Reconciliation — manually enter transactions from your bank statements and categorize them.
          </div>
        <div style={{ ...card, padding: '14px' }}>
            <span style={secHdr}>UPLOAD BANK STATEMENT</span>
            <button onClick={() => reconFileRef.current?.click()} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${C.teal}`, background: 'rgba(45,191,184,0.08)', fontSize: '14px', fontWeight: 'bold', color: C.teal, cursor: 'pointer', fontFamily: FONT }}>
              Upload Chase Checking PDF
            </button>
            <input ref={reconFileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleReconPdfUpload(f); e.target.value = '' }} />
            <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px' }}>Chase Total Checking statements · AI parsing for other banks coming soon</div>
            {reconUploadStatus && <div style={{ marginTop: '8px', fontSize: '13px', color: C.teal }}>{reconUploadStatus}</div>}
          </div>

          {reconUploadPreview.length > 0 && (
            <div style={{ ...card, border: `1px solid ${C.teal}` }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: C.teal, marginBottom: '8px', textTransform: 'uppercase' }}>Import Preview — {reconUploadPreview.filter(r => r._selected).length} selected</div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <button onClick={() => setReconUploadPreview(reconUploadPreview.map(r => ({ ...r, _selected: true })))} style={editBtn}>Select All</button>
                <button onClick={() => setReconUploadPreview(reconUploadPreview.map(r => ({ ...r, _selected: false })))} style={editBtn}>Deselect All</button>
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {reconUploadPreview.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                    <input type="checkbox" checked={r._selected} onChange={e => { const u = [...reconUploadPreview]; u[i]._selected = e.target.checked; setReconUploadPreview(u) }} style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div>
                      <div style={{ fontSize: '11px', color: C.muted }}>{r.transaction_date}</div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: r.amount >= 0 ? C.green : '#ef4444', flexShrink: 0 }}>{fmt(r.amount)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button onClick={confirmReconImport} style={{ padding: '10px 18px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Import Selected</button>
                <button onClick={() => { setReconUploadPreview([]); setReconUploadStatus('') }} style={{ padding: '10px 14px', background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.muted, cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', color: C.muted }}>
              {reconTransactions.length} transaction{reconTransactions.length !== 1 ? 's' : ''} · {reconTransactions.filter(t => t.is_reconciled).length} reconciled
            </div>
            <button onClick={() => setReconShowAddForm(!reconShowAddForm)} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>
              {reconShowAddForm ? 'Cancel' : '+ Add Transaction'}
            </button>
          </div>

          {reconShowAddForm && (
            <div style={{ ...card, border: `1px solid ${C.teal}`, marginBottom: '12px' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div><span style={lbl}>Account</span>
                  <select value={reconNewTxn.account_name} onChange={e => setReconNewTxn({ ...reconNewTxn, account_name: e.target.value })} style={inp}>
                    <option value="Chase Business Checking">Chase Business Checking</option>
                    <option value="Wells Fargo Business Checking">Wells Fargo Business Checking</option>
                    <option value="Chase Credit Card">Chase Credit Card</option>
                    <option value="Other Credit Card">Other Credit Card</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><span style={lbl}>Date</span><input type="date" value={reconNewTxn.transaction_date} onChange={e => setReconNewTxn({ ...reconNewTxn, transaction_date: e.target.value })} style={inp} /></div>
                  <div><span style={lbl}>Amount ($)</span><input type="number" step="0.01" value={reconNewTxn.amount} onChange={e => setReconNewTxn({ ...reconNewTxn, amount: e.target.value })} placeholder="Use - for debits" style={inp} /></div>
                </div>
                <div><span style={lbl}>Description</span><input value={reconNewTxn.description} onChange={e => setReconNewTxn({ ...reconNewTxn, description: e.target.value })} placeholder="e.g. Amazon, USPS, TCGplayer deposit" style={inp} /></div>
                <div><span style={lbl}>Category</span>
                  <select value={reconNewTxn.category} onChange={e => setReconNewTxn({ ...reconNewTxn, category: e.target.value })} style={inp}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Income">Income / Deposit</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><span style={lbl}>Business or Personal</span>
                    <select value={String(reconNewTxn.is_business)} onChange={e => setReconNewTxn({ ...reconNewTxn, is_business: e.target.value === 'true' })} style={inp}>
                      <option value="true">Business</option>
                      <option value="false">Personal</option>
                    </select>
                  </div>
                  <div><span style={lbl}>Notes</span><input value={reconNewTxn.notes} onChange={e => setReconNewTxn({ ...reconNewTxn, notes: e.target.value })} placeholder="Optional" style={inp} /></div>
                </div>
                <button onClick={async () => {
                  if (!reconNewTxn.description || !reconNewTxn.amount) return alert('Missing description or amount')
                  const { error } = await supabase.from('bank_statement_transactions').insert([{
                    account_name: reconNewTxn.account_name,
                    transaction_date: reconNewTxn.transaction_date,
                    description: reconNewTxn.description,
                    amount: parseFloat(reconNewTxn.amount),
                    category: reconNewTxn.category,
                    is_business: reconNewTxn.is_business,
                    is_reconciled: false,
                    entity: getEntity(reconNewTxn.transaction_date),
                    notes: reconNewTxn.notes,
                  }])
                  if (error) return alert(error.message)
                  setReconShowAddForm(false)
                  setReconNewTxn({ account_name: 'Chase Business Checking', transaction_date: new Date().toISOString().split('T')[0], description: '', amount: '', category: 'Other', is_business: true, notes: '' })
                  fetchData()
                }} style={{ background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', padding: '14px', borderRadius: '12px', fontWeight: 900, border: 'none', fontSize: '15px', cursor: 'pointer', fontFamily: FONT }}>
                  SAVE TRANSACTION
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {['All', 'Chase Business Checking', 'Wells Fargo Business Checking', 'Chase Credit Card', 'Other Credit Card'].map(acct => (
              <button key={acct} onClick={() => setReconAccount(acct)} style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${reconAccount === acct ? C.teal : C.border}`, background: reconAccount === acct ? 'rgba(45,191,184,0.12)' : C.inputBg, fontSize: '12px', fontWeight: reconAccount === acct ? 'bold' : 'normal', color: reconAccount === acct ? C.teal : C.muted, cursor: 'pointer', fontFamily: FONT }}>
                {acct === 'All' ? 'All Accounts' : acct}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <input type="checkbox" id="showReconciled" checked={reconShowReconciled} onChange={e => setReconShowReconciled(e.target.checked)} style={{ width: '16px', height: '16px' }} />
            <label htmlFor="showReconciled" style={{ fontSize: '13px', color: C.muted, cursor: 'pointer' }}>Show reconciled transactions</label>
          </div>

          {(() => {
            const filtered = reconTransactions.filter(t => reconAccount === 'All' || t.account_name === reconAccount)
            const debits = filtered.filter(t => t.amount < 0).reduce((a, t) => a + t.amount, 0)
            const credits = filtered.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0)
            const unreconciled = filtered.filter(t => !t.is_reconciled).length
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div style={{ ...card, padding: '12px', marginBottom: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>CREDITS</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: C.green }}>{fmt(credits)}</div>
                </div>
                <div style={{ ...card, padding: '12px', marginBottom: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>DEBITS</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#ef4444' }}>{fmt(debits)}</div>
                </div>
                <div style={{ ...card, padding: '12px', marginBottom: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: C.muted, fontWeight: 'bold', marginBottom: '4px' }}>UNREVIEWED</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: unreconciled > 0 ? C.gold : C.teal }}>{unreconciled}</div>
                </div>
              </div>
            )
          })()}

          {(() => {
            const filtered = reconTransactions
              .filter(t => reconAccount === 'All' || t.account_name === reconAccount)
              .filter(t => reconShowReconciled || !t.is_reconciled)
            if (filtered.length === 0) return (
              <div style={{ textAlign: 'center', padding: '40px', color: C.muted, fontSize: '14px' }}>
                No transactions yet — tap + Add Transaction to get started
              </div>
            )
            return filtered.map(txn => (
              <div key={txn.id} style={{ ...card, padding: '14px', border: `1px solid ${txn.is_reconciled ? 'rgba(16,185,129,0.2)' : C.border}`, background: txn.is_reconciled ? 'rgba(16,185,129,0.04)' : C.cardBg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{txn.description}</div>
                    <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{txn.transaction_date} · {txn.account_name}</div>
                    {txn.notes && <div style={{ fontSize: '11px', color: C.muted }}>{txn.notes}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: txn.amount >= 0 ? C.green : '#ef4444' }}>{fmt(txn.amount)}</div>
                    <div style={{ fontSize: '11px', color: txn.is_business ? C.teal : C.gold }}>{txn.is_business ? 'Business' : 'Personal'}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                  <select value={txn.category || 'Other'} onChange={async e => { await supabase.from('bank_statement_transactions').update({ category: e.target.value }).eq('id', txn.id); fetchData() }} style={{ ...inp, padding: '6px 8px', fontSize: '12px' }}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Income">Income / Deposit</option>
                  </select>
                  <select value={String(txn.is_business)} onChange={async e => { await supabase.from('bank_statement_transactions').update({ is_business: e.target.value === 'true' }).eq('id', txn.id); fetchData() }} style={{ ...inp, padding: '6px 8px', fontSize: '12px' }}>
                    <option value="true">Business</option>
                    <option value="false">Personal</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={async () => { await supabase.from('bank_statement_transactions').update({ is_reconciled: !txn.is_reconciled }).eq('id', txn.id); fetchData() }} style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${txn.is_reconciled ? C.teal : C.border}`, background: txn.is_reconciled ? 'rgba(45,191,184,0.1)' : 'none', fontSize: '12px', fontWeight: 'bold', color: txn.is_reconciled ? C.teal : C.muted, cursor: 'pointer', fontFamily: FONT }}>
                    {txn.is_reconciled ? '✓ Reconciled' : 'Mark Reconciled'}
                  </button>
                  {txn.is_business && txn.amount < 0 && !txn.linked_expense_id && (
                    <button onClick={async () => {
                      const { data: inserted, error } = await supabase.from('expenses').insert([{ category: txn.category || 'Other', cost: Math.abs(txn.amount), purchase_date: txn.transaction_date, notes: txn.description, entity: txn.entity || 'llc', user_name: 'Cam', paid_by_company: true }]).select().single()
                      if (error) return alert(error.message)
                      await supabase.from('bank_statement_transactions').update({ linked_expense_id: inserted.id, is_reconciled: true }).eq('id', txn.id)
                      fetchData()
                      alert('Pushed to Expenses ✓')
                    }} style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${C.purple}`, background: 'rgba(107,63,160,0.08)', fontSize: '12px', fontWeight: 'bold', color: C.purple, cursor: 'pointer', fontFamily: FONT }}>
                      → Push to Expenses
                    </button>
                  )}
                  {txn.linked_expense_id && <span style={{ padding: '5px 12px', fontSize: '12px', color: C.teal }}>✓ In Expenses</span>}
                  <button onClick={async () => { if (!confirm('Delete?')) return; await supabase.from('bank_statement_transactions').delete().eq('id', txn.id); fetchData() }} style={{ ...editBtn, color: C.pink, marginLeft: 'auto' }}>Delete</button>
                </div>
              </div>
            ))
          })()}
        </div>
      )
        
      case 'accounting': return (
        <div>
          <div style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(45,191,184,0.1)', border: `1px solid rgba(45,191,184,0.25)`, marginBottom: '12px', fontSize: '12px', color: '#1A7A75', fontWeight: 'bold', fontFamily: FONT }}>
            ⚖️ Accrual Method — revenue & expenses recognized in period earned/incurred
          </div>
          <div style={card}>
            <span style={secHdr}>INCOME STATEMENT · {selectedMonth === 0 ? selectedYear : new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <PLRow label="Gross Revenue" value={gross} bold />
            <PLRow label="Less: Selling Fees & Commissions" value={totalPlatformFees} indent isNegative />
            <PLRow label="Less: Shipping Expense" value={totalShippingExpense} indent isNegative />
            <PLRow label="Net Sales" value={netSalesAmt} bold />
            <PLRow label="Cost of Goods Sold" value={cogsRecognized} isNegative showDrilldown drillId="cogs" />
            {acctDrilldown === 'cogs' && <DD>{cogsInventory.map(r => { const ratio = r.total_units > 0 ? Math.min((r.sold_units||0)/r.total_units,1) : 0; const recog = parseFloat(r.total_cost||0)*ratio; return recog > 0 ? <DDRow key={r.id} label={r.description} value={recog} neg /> : null })}</DD>}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `2px solid ${C.border}` }}>
              <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: FONT }}>Gross Profit</span>
              <span style={{ fontSize: '16px', fontWeight: 900, color: grossMargin >= 0 ? C.green : '#ef4444', fontFamily: FONT }}>{grossMargin < 0 ? `(${fmt(Math.abs(grossMargin))})` : fmt(grossMargin)}</span>
            </div>
            <div style={{ padding: '10px 0 4px', fontSize: '12px', color: C.muted, fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: FONT }}>Operating Expenses</div>
            {EXPENSE_CATEGORIES.filter(cat => expByCategory[cat] > 0).map(cat => (
              <div key={cat}>
                <PLRow label={cat} value={expByCategory[cat]} indent isNegative showDrilldown drillId={`exp_${cat}`} />
                {acctDrilldown === `exp_${cat}` && <DD>{expenses.filter(e => e.category === cat).map(e => <DDRow key={e.id} label={`${e.notes || e.purchase_date}${e.user_name ? ` · ${e.user_name}` : ''}`} value={Number(e.cost)} neg />)}</DD>}
              </div>
            ))}
            <PLRow label="Salaries & Wages" value={staffingCosts} indent isNegative showDrilldown drillId="payroll_dd" />
            {acctDrilldown === 'payroll_dd' && <DD>{payroll.map(p => <DDRow key={p.id} label={`${p.employee_name} · ${p.pay_date}`} value={Number(p.amount)} neg />)}</DD>}
            {totalDepreciation > 0 && <PLRow label="Depreciation" value={totalDepreciation} indent isNegative showDrilldown drillId="dep_dd" />}
            {acctDrilldown === 'dep_dd' && <DD>{assets.map(a => { const life = parseInt(a.useful_life_yrs)||USEFUL_LIFE[a.category]||5; const { slAnnual } = calcDepreciation(parseFloat(a.cost), life, a.purchase_date, selectedYear); return slAnnual > 0 ? <DDRow key={a.id} label={`${a.description} (${life}yr SL)`} value={slAnnual} neg /> : null })}</DD>}
            <PLRow label="Total Operating Expenses" value={totalOpEx} bold isNegative />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', marginTop: '4px' }}>
              <span style={{ fontSize: '18px', fontWeight: 900, fontFamily: FONT, textDecoration: 'underline double' }}>Net Income</span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: netIncome >= 0 ? C.green : '#ef4444', fontFamily: FONT, textDecoration: 'underline double' }}>{netIncome < 0 ? `(${fmt(Math.abs(netIncome))})` : fmt(netIncome)}</span>
            </div>
          </div>
          <div style={card}>
            <span style={secHdr}>BALANCE SHEET — as of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <div style={{ fontSize: '13px', fontWeight: 700, color: C.navy, padding: '6px 0', borderBottom: `1px solid ${C.border}`, marginBottom: '4px' }}>ASSETS</div>
            <div style={{ fontSize: '12px', color: C.muted, fontWeight: 'bold', padding: '6px 0 2px' }}>Current Assets</div>
            <PLRow label="Cash & Bank Accounts" value={totalCash} indent showDrilldown drillId="cash_dd" />
            {acctDrilldown === 'cash_dd' && <DD>
              {bankAccounts.filter(b => b.account_type !== 'Credit').map(b => <DDRow key={b.id} label={`${b.bank_name} ${b.account_type}${b.account_last4 ? ` ·${b.account_last4}` : ''}`} value={Number(b.current_balance)} />)}
              <div style={{ textAlign: 'right', marginTop: '6px' }}><button onClick={() => setEditingItem({ table: 'bank_accounts' })} style={editBtn}>+ Update Balance</button></div>
            </DD>}
            <PLRow label="Accounts Receivable" value={0} indent />
            <PLRow label="Inventory (ending)" value={endingInventory} indent showDrilldown drillId="inv_dd" />
            {acctDrilldown === 'inv_dd' && <DD>{allCogsInventory.filter(r => (r.sold_units||0) < (r.total_units||0)).map(r => { const rem = parseFloat(r.total_cost||0) * (1 - Math.min((r.sold_units||0)/(r.total_units||1),1)); return <DDRow key={r.id} label={r.description} value={rem} /> })}</DD>}
            <PLRow label="Total Current Assets" value={totalCurrentAssets} bold />
            <div style={{ fontSize: '12px', color: C.muted, fontWeight: 'bold', padding: '10px 0 2px' }}>Fixed Assets</div>
            <PLRow label="Equipment & Furniture (cost)" value={totalAssetCost} indent showDrilldown drillId="fixed_dd" />
            {acctDrilldown === 'fixed_dd' && <DD>{assets.map(a => <DDRow key={a.id} label={`${a.description} (${a.purchase_date})`} value={parseFloat(a.cost)} />)}</DD>}
            {totalAccumulatedDep > 0 && <PLRow label="Less: Accumulated Depreciation" value={totalAccumulatedDep} indent isNegative />}
            <PLRow label="Net Fixed Assets" value={totalBookValue} bold />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: `2px solid ${C.border}`, marginTop: '4px' }}>
              <span style={{ fontSize: '16px', fontWeight: 900, fontFamily: FONT }}>Total Assets</span>
              <span style={{ fontSize: '16px', fontWeight: 900, color: C.navy, fontFamily: FONT }}>{fmt(totalAssets)}</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: C.navy, padding: '10px 0 4px', borderBottom: `1px solid ${C.border}`, marginTop: '8px' }}>LIABILITIES & EQUITY</div>
            <div style={{ fontSize: '12px', color: C.muted, fontWeight: 'bold', padding: '6px 0 2px' }}>Current Liabilities</div>
            <PLRow label="Accounts Payable" value={totalAPOwed} indent showDrilldown drillId="ap_dd" />
            {acctDrilldown === 'ap_dd' && <DD>
              {accountsPayable.filter(a => Number(a.total_amount) - Number(a.amount_paid||0) > 0).map(a => { const owed = Number(a.total_amount) - Number(a.amount_paid||0); return <DDRow key={a.id} label={`${a.vendor_name}${a.due_date ? ` · Due ${a.due_date}` : ''}`} value={owed} neg /> })}
              <div style={{ textAlign: 'right', marginTop: '6px' }}><button onClick={() => setEditingItem({ table: 'accounts_payable' })} style={editBtn}>+ Add A/P</button></div>
            </DD>}
            <PLRow label="Credit Card Balances" value={totalCreditDebt} indent showDrilldown drillId="cc_dd" />
            {acctDrilldown === 'cc_dd' && <DD>{bankAccounts.filter(b => b.account_type === 'Credit').map(b => <DDRow key={b.id} label={`${b.bank_name}${b.notes ? ` — ${b.notes}` : ''}`} value={Math.abs(Number(b.current_balance))} neg />)}</DD>}
            <PLRow label="Total Liabilities" value={totalLiabilities} bold />
            <div style={{ fontSize: '12px', color: C.muted, fontWeight: 'bold', padding: '10px 0 2px' }}>Owner's Equity</div>
            <PLRow label="Retained Earnings / Net Income" value={netIncome} indent />
            <PLRow label="Total Owner's Equity" value={ownerEquity} bold />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: `2px solid ${C.border}`, marginTop: '4px' }}>
              <span style={{ fontSize: '16px', fontWeight: 900, fontFamily: FONT }}>Total Liabilities & Equity</span>
              <span style={{ fontSize: '16px', fontWeight: 900, color: C.navy, fontFamily: FONT }}>{fmt(totalLiabilities + ownerEquity)}</span>
            </div>
          </div>
          <div style={card}>
            <span style={secHdr}>INVENTORY FLOW — {selectedYear}</span>
            {inventoryFlow.length === 0
              ? <div style={{ textAlign: 'center', padding: '30px', color: C.muted, fontSize: '14px' }}>No inventory data yet</div>
              : <>
                {inventoryFlow.map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: '14px', color: C.text, fontFamily: FONT, flex: 1, paddingRight: '8px' }}>{row.label}</span>
                    <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: FONT, minWidth: '90px', textAlign: 'right', color: row.isAddition ? C.green : '#ef4444' }}>
                      {row.isAddition ? '' : '('}{fmt(row.amount)}{row.isAddition ? '' : ')'}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', marginTop: '4px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: FONT, textDecoration: 'underline' }}>Ending Inventory</span>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: C.teal, fontFamily: FONT, textDecoration: 'underline' }}>{fmt(endingBalance)}</span>
                </div>
              </>}
          </div>
          <div style={card}>
            <span style={secHdr}>REVENUE BY ENTITY</span>
            {(['sole_prop', 'llc'] as const).map(entity => {
              const es = sales.filter(s => s.entity === entity)
              const eGross = es.reduce((a, r) => a + Number(r.amount), 0)
              const eNet = es.reduce((a, r) => a + Number(r.net_sales || r.amount), 0)
              if (eGross === 0) return null
              return (
                <div key={entity} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: entity === 'llc' ? C.teal : C.gold }}>{entity === 'llc' ? 'Mana Social LLC' : 'Camera Pho (Sole Prop)'}</div>
                    <div style={{ fontSize: '12px', color: C.muted }}>Net: {fmt(eNet)}</div>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: C.green }}>{fmt(eGross)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )

      default: return null
    }
  }

  // ── Final render ──────────────────────────────────────────────────────
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
    { id: 'assets',     label: 'Assets'     },
    { id: 'deductions', label: 'Deductions' },
    { id: 'tax',        label: 'Tax'        },
    { id: 'payroll',    label: 'Payroll'    },
    { id: 'reconcile', label: 'Reconcile'   },
    { id: 'accounting', label: 'Accounting' },
  ]

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', paddingBottom: '140px', color: C.text, transition: 'background 0.2s, color 0.2s' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>
        <header style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 900, color: C.navy, fontSize: '17px', letterSpacing: '-0.3px', fontFamily: FONT }}>MANA SOCIAL LLC</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={cycleTheme} title={`Mode: ${themeMode}`} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '6px 10px', fontSize: '15px', cursor: 'pointer' }}>{themeIcon}</button>
              <button onClick={signOut} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '6px 14px', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: FONT }}>Sign out</button>
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
                  ['sales',           'SALE',        C.green],
                  ['accounts_payable','A/P',          C.pink],
                  ['expenses',        'EXPENSE',     '#ef4444'],
                  ['payroll',         'PAYROLL',     C.text],
                  ['cogs_inventory',  'INVENTORY',   C.purple],
                  ['mileage_log',     'MILEAGE',     C.teal],
                  ['assets',          'ASSET',       C.navy],
                  ['supply_costs',    'SUPPLY COST', C.purple],
                ].map(([table, l, color]) => (
                  <button key={String(table)} onClick={() => { setEditingItem({ table: String(table) }); setIsQuickAddOpen(false) }} style={{ padding: '17px', borderRadius: '12px', border: `1px solid ${C.border}`, fontWeight: 'bold', fontSize: '14px', background: C.white, color: color as string, cursor: 'pointer', fontFamily: FONT }}>{l}</button>
                ))}
                <button onClick={() => { setIsQuickAddOpen(false); setBulkAddOpen(true) }} style={{ padding: '17px', borderRadius: '12px', border: `2px solid ${C.gold}`, color: '#7A5A00', fontWeight: 900, background: 'rgba(240,192,64,0.08)', cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>BULK ADD</button>
                <button onClick={() => { setEditingItem({ table: 'disbursements' }); setIsQuickAddOpen(false) }} style={{ padding: '17px', borderRadius: '12px', border: `2px solid ${C.teal}`, color: C.teal, fontWeight: 900, background: C.white, cursor: 'pointer', fontSize: '14px', fontFamily: FONT }}>OWNER DRAW</button>
              </div>
              <button onClick={() => setIsQuickAddOpen(false)} style={{ width: '100%', marginTop: '16px', border: 'none', background: 'none', color: C.muted, fontWeight: 'bold', cursor: 'pointer', padding: '8px', fontSize: '14px', fontFamily: FONT }}>CANCEL</button>
            </div>
          </div>
        )}
      </div>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: isDark ? '#111D33' : '#FFFFFF', borderTop: `2px solid ${C.border}`, display: 'flex', zIndex: 400, height: '80px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: 1, border: 'none', background: 'none', fontSize: '13px', fontWeight: 900, color: activeTab === t.id ? C.teal : C.muted, padding: '8px 2px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, borderTop: activeTab === t.id ? `3px solid ${C.teal}` : '3px solid transparent', minWidth: 0 }}>
            {t.label}
          </button>
        ))}
      </nav>

      {renderBulkModal()}

      {importQueueOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.92)', display: 'flex', alignItems: 'flex-end', zIndex: 2000, fontFamily: FONT }}>
          <div style={{ background: C.white, width: '100%', borderRadius: '20px 20px 0 0', padding: '24px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontWeight: 900, color: C.navy, fontSize: '17px' }}>IMPORT QUEUE</h2>
              <button onClick={() => setImportQueueOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', color: C.muted, cursor: 'pointer' }}>×</button>
            </div>
            {importQueue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>No pending imports</div>
            ) : (
              <>
                <div style={{ fontSize: '12px', color: C.muted, marginBottom: '12px' }}>Auto-tier (95%+) can be batch-approved. Review-tier (80-94%) should be checked. Manual items need verification.</div>
                <button onClick={async () => {
                  const autoIds = importQueue.filter(i => i.confidence_tier === 'auto' && i.validation_passed).map(i => i.id)
                  if (autoIds.length === 0) return alert('No auto-approvable items')
                  const res = await fetch('/api/import-queue/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: autoIds, reviewedBy: 'Cam' }) })
                  const data = await res.json()
                  if (data.success) { fetchImportQueue(); fetchData(); alert(`Imported ${data.imported} records`) }
                  else alert('Error: ' + (data.error || 'Unknown'))
                }} style={{ width: '100%', padding: '12px', background: `linear-gradient(135deg,${C.teal},#1A7A75)`, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', fontFamily: FONT, marginBottom: '12px' }}>
                  Auto-approve all high-confidence ({importQueue.filter(i => i.confidence_tier === 'auto').length})
                </button>
                {importQueue.map(item => {
                  const c = item.canonical_data || {}
                  const tier = item.confidence_tier
                  const tierColor = tier === 'auto' ? C.teal : tier === 'review' ? C.gold : C.pink
                  const tierLabel = tier === 'auto' ? 'AUTO' : tier === 'review' ? 'REVIEW' : 'MANUAL'
                  return (
                    <div key={item.id} style={{ padding: '12px', borderBottom: `1px solid ${C.border}`, fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: tierColor, background: tier === 'auto' ? 'rgba(45,191,184,0.1)' : tier === 'review' ? 'rgba(240,192,64,0.15)' : 'rgba(232,64,122,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{tierLabel} · {Math.round(parseFloat(item.confidence) * 100)}%</span>
                        <span style={{ fontSize: '11px', color: C.muted }}>{item.target_table}</span>
                      </div>
                      <div style={{ fontWeight: 700, marginBottom: '4px' }}>{c.notes || c.description || c.platform || 'Item'}</div>
                      <div style={{ fontSize: '12px', color: C.muted, marginBottom: '4px' }}>
                        {c.category && <>Category: <strong>{c.category}</strong> · </>}
                        Amount: <strong>${(c.amount || c.cost || c.total_cost || 0).toLocaleString()}</strong>
                        {c.purchase_date && <> · {c.purchase_date}</>}{c.sale_date && <> · {c.sale_date}</>}
                      </div>
                      {item.validation_errors && item.validation_errors.length > 0 && <div style={{ fontSize: '11px', color: C.pink, marginBottom: '4px' }}>⚠️ {item.validation_errors.join(', ')}</div>}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={async () => {
                          const res = await fetch('/api/import-queue/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [item.id], reviewedBy: 'Cam' }) })
                          const data = await res.json()
                          if (data.success) { fetchImportQueue(); fetchData() }
                          else alert('Error: ' + (data.error || 'Unknown'))
                        }} style={{ padding: '5px 12px', background: C.teal, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>Approve</button>
                        <button onClick={async () => { await fetch(`/api/import-queue/approve?id=${item.id}`, { method: 'DELETE' }); fetchImportQueue() }} style={{ padding: '5px 12px', background: 'none', border: `1px solid ${C.pink}`, color: C.pink, borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>Reject</button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      )}

      {duplicateWarning && !importQueueOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 2100, fontFamily: FONT }}>
          <div style={{ background: C.white, borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ color: C.pink, marginBottom: '12px', fontSize: '17px', fontWeight: 900 }}>⚠️ Duplicate File</h3>
            <p style={{ fontSize: '14px', color: C.text, marginBottom: '16px' }}>{duplicateWarning.message}</p>
            <p style={{ fontSize: '13px', color: C.muted, marginBottom: '16px' }}>Do you want to import it anyway?</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={confirmDuplicateOverride} style={{ flex: 1, padding: '12px', background: C.pink, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>Import Anyway</button>
              <button onClick={() => { setDuplicateWarning(null); setUploadStatus('') }} style={{ flex: 1, padding: '12px', background: 'none', border: `1px solid ${C.border}`, color: C.muted, borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
