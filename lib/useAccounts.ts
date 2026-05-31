'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { CHECKING_ACCOUNTS, CREDIT_CARD_ACCOUNTS } from '@/lib/constants'

export interface AccountRow {
  id: string
  account_name: string
  owner: 'Mana Social' | 'Cam' | 'Kenny'
  account_type: 'checking' | 'credit_card'
  is_business: boolean
  notes: string | null
}

/**
 * Hybrid account list: returns hardcoded fallback first, replaces with DB
 * once loaded. Forms can render immediately with stale data, refresh on mount.
 *
 * Returns merged unique lists with DB rows taking precedence (so renaming an
 * account via DB takes effect).
 */
export function useAccounts() {
  const [rows, setRows] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('custom_accounts')
        .select('*')
        .order('account_type', { ascending: true })
        .order('account_name', { ascending: true })
      if (!error && data) setRows(data as AccountRow[])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { refresh() }, [refresh])

  // Build the merged dropdown lists. DB rows are the source of truth when present.
  // If DB is empty (first load or fetch failed), fall back to hardcoded constants
  // so the app never breaks.
  const dbChecking = rows.filter(r => r.account_type === 'checking').map(r => r.account_name)
  const dbCards = rows.filter(r => r.account_type === 'credit_card').map(r => r.account_name)

  const checking = dbChecking.length > 0 ? dbChecking : CHECKING_ACCOUNTS
  const cards = dbCards.length > 0 ? dbCards : CREDIT_CARD_ACCOUNTS

  return { rows, checking, cards, loading, refresh }
}
