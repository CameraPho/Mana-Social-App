// lib/bankActions.ts
// Defines all bank reconciliation action types for the Stage 2 categorization redesign.
// Each action represents a different way a bank transaction can be mapped to the ledger.

export type ActionType =
  | 'categorize'         // Default: creates expense or sale
  | 'split'              // Splits into multiple expenses
  | 'platform_payout'    // TCGplayer/eBay/ManaPool deposits — reconcile-only
  | 'card_payment'       // Paying down credit card from checking — reconcile-only
  | 'owner_contribution' // Member putting capital INTO the LLC (equity)
  | 'owner_loan'         // Member LENDING money to LLC (liability, expects repayment)
  | 'loan_repayment'     // LLC paying back a member loan (principal + interest)
  | 'owner_draw'         // Member taking money OUT of LLC
  | 'ap_payment'         // Paying down an accounts_payable line
  | 'collection_payment' // Paying for buyout inventory (collections table)
  | 'transfer'           // Moving money between own accounts — reconcile-only

export const ACTION_LABELS: Record<ActionType, string> = {
  categorize:         'Categorize',
  split:              'Split',
  platform_payout:    'Platform Payout',
  card_payment:       'Card Payment',
  owner_contribution: 'Owner Contribution',
  owner_loan:         'Owner Loan',
  loan_repayment:     'Loan Repayment',
  owner_draw:         'Owner Draw',
  ap_payment:         'AP Payment',
  collection_payment: 'Collection Payment',
  transfer:           'Transfer',
}

// Short helper labels shown in dropdown alongside the main label
export const ACTION_HINTS: Record<ActionType, string> = {
  categorize:         'Regular expense or sale',
  split:              'Split into multiple expenses',
  platform_payout:    'TCGplayer / eBay / ManaPool deposit (sales already imported)',
  card_payment:       'Paying down a credit card from checking',
  owner_contribution: 'Member putting capital INTO the LLC',
  owner_loan:         'Member lending money to LLC (must be repaid)',
  loan_repayment:     'LLC repaying a member loan',
  owner_draw:         'Member taking money OUT of LLC',
  ap_payment:         'Paying a vendor bill already recorded',
  collection_payment: 'Paying for buyout inventory',
  transfer:           'Moving money between your own accounts',
}

// Whether each action requires a ledger entry on the OUTflow side (negative amount).
// If true, the action is appropriate for debit transactions.
export const ACTION_ALLOWS_OUTFLOW: Record<ActionType, boolean> = {
  categorize:         true,
  split:              true,
  platform_payout:    false,  // payouts are inflows
  card_payment:       true,
  owner_contribution: false,  // contributions are inflows (money coming in)
  owner_loan:         false,  // loans from member are inflows
  loan_repayment:     true,   // LLC paying member is outflow
  owner_draw:         true,
  ap_payment:         true,
  collection_payment: true,
  transfer:           true,
}

// Whether each action requires a ledger entry on the INflow side (positive amount).
export const ACTION_ALLOWS_INFLOW: Record<ActionType, boolean> = {
  categorize:         true,
  split:              false,  // splits only make sense for outflows
  platform_payout:    true,
  card_payment:       false,
  owner_contribution: true,
  owner_loan:         true,
  loan_repayment:     false,
  owner_draw:         false,
  ap_payment:         false,
  collection_payment: false,
  transfer:           true,
}

// Returns the subset of action types valid for a given transaction sign.
export function getValidActions(amount: number): ActionType[] {
  const isOutflow = amount < 0
  const all: ActionType[] = [
    'categorize', 'split', 'platform_payout', 'card_payment',
    'owner_contribution', 'owner_loan', 'loan_repayment',
    'owner_draw', 'ap_payment', 'collection_payment', 'transfer',
  ]
  return all.filter(a => isOutflow ? ACTION_ALLOWS_OUTFLOW[a] : ACTION_ALLOWS_INFLOW[a])
}

// --- Smart Default Detection -------------------------------------------

// Pattern → suggested action type. Longest pattern wins (most specific).
const PATTERN_RULES: { pattern: RegExp; action: ActionType; note?: string }[] = [
  // Micro deposits from platforms (verification) — not real payouts
  { pattern: /(tcgplayer|paypal|jpmorgan|venmo).+acctverify/i, action: 'categorize', note: 'Verification micro-deposit' },

  // Platform payouts (inflows)
  { pattern: /tcgplayer\s+inc(?!.*acctverify)/i, action: 'platform_payout' },
  { pattern: /ebay\s+commerce/i,                action: 'platform_payout' },
  { pattern: /manapool|mana\s+pool/i,           action: 'platform_payout' },
  { pattern: /paypal.*ebay/i,                   action: 'platform_payout' },
  { pattern: /instant\s+pmt\s+from\s+camera/i,  action: 'platform_payout' }, // your TCGplayer auto-deposit

  // Credit card payments from checking
  { pattern: /payment\s+to\s+chase/i,           action: 'card_payment' },
  { pattern: /payment\s+to\s+citi/i,            action: 'card_payment' },
  { pattern: /payment\s+to\s+barclays/i,        action: 'card_payment' },
  { pattern: /payment\s+to\s+amex/i,            action: 'card_payment' },
  { pattern: /card\s+online\s+payment/i,        action: 'card_payment' },
  { pattern: /cc\s+payment|credit\s+card\s+pmt/i, action: 'card_payment' },

  // Owner contributions (inflows from owner's personal account)
  { pattern: /online\s+transfer\s+from\s+pho\s+c.*business\s+funding/i, action: 'owner_contribution' },
  { pattern: /online\s+transfer\s+from\s+pho\s+c/i,                     action: 'owner_contribution' },
  { pattern: /online\s+transfer\s+from\s+diep\s+k/i,                    action: 'owner_contribution' },
  { pattern: /opening\s+deposit/i,                                      action: 'owner_contribution' },

  // Owner draws (outflows to owner's personal account)
  { pattern: /online\s+transfer\s+to\s+pho\s+c/i,  action: 'owner_draw' },
  { pattern: /online\s+transfer\s+to\s+diep\s+k/i, action: 'owner_draw' },

  // Common expense vendors (these stay as 'categorize' but vendor matching will fill the category)
  // (No rule needed — falls through to 'categorize')
]

/** Suggest the most likely action type for a bank transaction based on its description and amount. */
export function suggestActionType(description: string, amount: number): { action: ActionType; note?: string } {
  if (!description) return { action: 'categorize' }
  const desc = description.toLowerCase()

  // Find the longest matching pattern (most specific wins)
  let best: { action: ActionType; note?: string; specificity: number } | null = null
  for (const rule of PATTERN_RULES) {
    const m = desc.match(rule.pattern)
    if (m) {
      const specificity = m[0].length
      if (!best || specificity > best.specificity) {
        best = { action: rule.action, note: rule.note, specificity }
      }
    }
  }

  if (best) return { action: best.action, note: best.note }

  // Sign-based safety check for actions that wouldn't normally apply
  // (e.g., a positive amount being labeled 'categorize' default is fine)
  return { action: 'categorize' }
}

// --- Payload Builders -------------------------------------------------
// Each builder returns { targetTable, payload } ready to insert.
// Returns null for actions that don't create a ledger row (reconcile-only).

export type LedgerInsert = {
  targetTable: string
  payload: Record<string, any>
} | null

export function buildOwnerContributionPayload(
  txn: { id: string; description: string; amount: number; transaction_date: string },
  memberName: string,
  entity: string,
  notes?: string
): LedgerInsert {
  return {
    targetTable: 'equity_transactions',
    payload: {
      transaction_date: txn.transaction_date,
      member_name: memberName,
      transaction_type: 'contribution',
      amount: Math.abs(txn.amount),
      notes: notes || txn.description,
      bank_txn_id: txn.id,
      entity,
    }
  }
}

export function buildOwnerLoanPayload(
  txn: { id: string; description: string; amount: number; transaction_date: string },
  memberName: string,
  entity: string,
  interestRate?: number,
  notes?: string
): LedgerInsert {
  const principal = Math.abs(txn.amount)
  return {
    targetTable: 'member_loans',
    payload: {
      loan_date: txn.transaction_date,
      member_name: memberName,
      direction: 'from_member', // member is lending TO the LLC
      principal,
      interest_rate: interestRate || null,
      outstanding_balance: principal,
      notes: notes || txn.description,
      bank_txn_id: txn.id,
      entity,
      is_active: true,
    }
  }
}

export function buildOwnerDrawPayload(
  txn: { id: string; description: string; amount: number; transaction_date: string },
  recipientName: string,
  notes?: string
): LedgerInsert {
  return {
    targetTable: 'disbursements',
    payload: {
      recipient: recipientName,
      amount: Math.abs(txn.amount),
      disbursement_date: txn.transaction_date,
      notes: notes || txn.description,
      bank_txn_id: txn.id,
    }
  }
}

export function buildLoanRepaymentPayload(
  txn: { id: string; description: string; amount: number; transaction_date: string },
  loanId: string,
  principalPaid: number,
  interestPaid: number,
  notes?: string
): LedgerInsert {
  return {
    targetTable: 'member_loan_payments',
    payload: {
      loan_id: loanId,
      payment_date: txn.transaction_date,
      principal_paid: principalPaid,
      interest_paid: interestPaid,
      notes: notes || txn.description,
      bank_txn_id: txn.id,
    }
  }
}

// Note: ap_payment and collection_payment don't INSERT new rows — they UPDATE existing ones.
// These are handled directly in BankTab's executeAction, not via a builder here.

// platform_payout, card_payment, and transfer are reconcile-only — no ledger row created.
