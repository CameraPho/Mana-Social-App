export type Entity = 'sole_prop' | 'llc'

export interface BankTxn {
  id: string
  account_name: string
  transaction_date: string
  description: string
  amount: number
  category: string | null
  is_business: boolean
  is_reconciled: boolean
  linked_expense_id: string | null
  entity: Entity
  notes: string
}

export interface ParseResult {
  records: any[]
  meta: any
}
