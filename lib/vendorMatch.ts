// lib/vendorMatch.ts
// Matches a bank transaction description against learned vendor mappings.
// Used by BankTab to suggest categories before user confirms.
// Mappings are written/updated by /api/import-queue/approve when a vendor is learned.

export type VendorMapping = {
  id: string
  vendor_name: string
  vendor_keywords: string[] | null
  default_category: string | null
  default_table: string | null   // 'expenses' | 'sales' | 'cogs_inventory' | 'assets' | 'mileage_log'
  is_inventory?: boolean
  is_asset?: boolean
  correction_count?: number
}

export type VendorMatch = {
  mapping: VendorMapping
  matchedKeyword: string
  suggestedCategory: string
  suggestedTable: string
  // Pre-built canonical insert payload for fast bulk-apply:
  isSale: boolean      // true if default_table === 'sales'
}

/**
 * Find the best vendor mapping for a given bank transaction.
 *
 * Rules:
 * - Case-insensitive "contains" match on description vs each keyword
 * - Sign filter:
 *     - If sign === 'debit', only consider mappings where default_table is an expense-like table
 *     - If sign === 'credit', only consider mappings where default_table === 'sales'
 * - Longest matched keyword wins (most specific)
 * - Tiebreaker: highest correction_count (most-trusted vendor)
 */
export function findVendorMatch(
  description: string,
  amount: number,
  mappings: VendorMapping[]
): VendorMatch | null {
  if (!description || !mappings || mappings.length === 0) return null

  const desc = description.toLowerCase()
  const sign: 'debit' | 'credit' = amount < 0 ? 'debit' : 'credit'

  let best: { mapping: VendorMapping; keyword: string } | null = null

  for (const m of mappings) {
    // Filter by sign vs table type
    const table = m.default_table || 'expenses'
    if (sign === 'credit' && table !== 'sales') continue
    if (sign === 'debit'  && table === 'sales') continue

    const kws = m.vendor_keywords || []
    // Also try vendor_name itself as an implicit keyword
    const candidates = [m.vendor_name, ...kws].filter(Boolean).map(k => k!.toLowerCase())

    for (const kw of candidates) {
      if (!kw) continue
      if (desc.includes(kw)) {
        if (!best
          || kw.length > best.keyword.length
          || (kw.length === best.keyword.length && (m.correction_count || 0) > (best.mapping.correction_count || 0))
        ) {
          best = { mapping: m, keyword: kw }
        }
      }
    }
  }

  if (!best) return null

  const table = best.mapping.default_table || 'expenses'
  return {
    mapping: best.mapping,
    matchedKeyword: best.keyword,
    suggestedCategory: best.mapping.default_category || 'Other',
    suggestedTable: table,
    isSale: table === 'sales',
  }
}

/**
 * Apply a vendor match to a bank transaction — build the ledger insert payload.
 * Returns { targetTable, payload } ready to insert.
 */
export function buildLedgerPayloadFromMatch(
  txn: { id: string; description: string; amount: number; transaction_date: string },
  match: VendorMatch,
  entity: string,
  userName = 'Cam'
): { targetTable: string; payload: any } {
  const absAmt = Math.abs(txn.amount)

  if (match.isSale) {
    return {
      targetTable: 'sales',
      payload: {
        platform: match.mapping.vendor_name?.toLowerCase() || 'other',
        amount: absAmt,
        fees: 0,
        shipping: 0,
        sale_date: txn.transaction_date,
        period_start: txn.transaction_date,
        period_end: txn.transaction_date,
        entity,
        net_sales: absAmt,
        num_orders: 1,
        bank_txn_id: txn.id,
      }
    }
  }

  return {
    targetTable: 'expenses',
    payload: {
      category: match.suggestedCategory,
      cost: absAmt,
      purchase_date: txn.transaction_date,
      notes: txn.description,
      entity,
      user_name: userName,
      paid_by_company: true,
      vendor: match.mapping.vendor_name,
      bank_txn_id: txn.id,
    }
  }
}
