import * as XLSX from 'xlsx'
import { LLC_START } from '@/lib/format'
import { AI_LEARN_KEY } from '@/lib/constants'
import type { ParseResult } from '@/lib/types'

function getCorrections(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(AI_LEARN_KEY) || '{}') } catch { return {} }
}
function findLearned(title: string): string | null {
  const corrections = getCorrections()
  const t = title.toLowerCase()
  for (const [key, val] of Object.entries(corrections)) { if (t.includes(key)) return val }
  return null
}
function normalizeUser(user: string): string {
  const u = (user || '').toLowerCase()
  if (u.includes('kenny') || u.includes('ken')) return 'Kenny'
  return 'Cam'
}
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

export function saveCorrection(title: string, category: string) {
  const corrections = getCorrections()
  corrections[title.toLowerCase().slice(0, 40)] = category
  localStorage.setItem(AI_LEARN_KEY, JSON.stringify(corrections))
}

export function parseAmazonCSV(file: File): Promise<ParseResult> {
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
