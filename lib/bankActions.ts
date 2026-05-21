// lib/bankActions.ts
// Defines all bank reconciliation action types for the Stage 2 categorization redesign.

export type ActionType =
  | 'categorize'
  | 'split'
  | 'platform_payout'
  | 'card_payment'
  | 'owner_contribution'
  | 'owner_loan'
  | 'loan_repayment'
  | 'owner_draw'
  | 'ap_payment'
  | 'collection_payment'
  | 'transfer'
  | 'sales_tax_remittance'

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
  sales_tax_remittance: 'Sales Tax Remittance (CDTFA)',
}

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
  sales_tax_remittance: 'Quarterly sales tax payment to California CDTFA',
}

export const ACTION_ALLOWS_OUTFLOW: Record<ActionType, boolean> = {
  categorize:         true,
  split:              true,
  platform_payout:    false,
  card_payment:       true,
  owner_contribution: false,
  owner_loan:         false,
  loan_repayment:     true,
  owner_draw:         true,
  ap_payment:         true,
  collection_payment: true,
  transfer:           true,
  sales_tax_remittance: true,
}

export const ACTION_ALLOWS_INFLOW: Record<ActionType, boolean> = {
  categorize:         true,
  split:              false,
  platform_payout:    true,
  card_payment:       false,
  owner_contribution: true,
  owner_loan:         true,
  loan_repayment:     false,
  owner_draw:         false,
  ap_payment:         false,
  collection_payment: false,
  transfer:           true,
  sales_tax_remittance: false,
}

export function getValidActions(amount: number): ActionType[] {
  const isOutflow = amount < 0
  const all: ActionType[] = [
    'categorize', 'split', 'platform_payout', 'card_payment',
    'owner_contribution', 'owner_loan', 'loan_repayment',
    'owner_draw', 'ap_payment', 'collection_payment', 'transfer',
    'sales_tax_remittance',
  ]
  return all.filter(a => isOutflow ? ACTION_ALLOWS_OUTFLOW[a] : ACTION_ALLOWS_INFLOW[a])
}

const PATTERN_RULES: { pattern: RegExp; action: ActionType; note?: string }[] = [
  { pattern: /(tcgplayer|paypal|jpmorgan|venmo).+acctverify/i, action: 'categorize', note: 'Verification micro-deposit' },
  { pattern: /tcgplayer\s+inc(?!.*acctverify)/i, action: 'platform_payout' },
  { pattern: /ebay\s+commerce/i,                action: 'platform_payout' },
  { pattern: /manapool|mana\s+pool/i,           action: 'platform_payout' },
  { pattern: /paypal.*ebay/i,                   action: 'platform_payout' },
  { pattern: /cdtfa|sales\s*tax|ca\s*dept\s*of\s*tax|board\s*of\s*equalization/i, action: 'sales_tax_remittance', note: 'CDTFA payment detected' },
  { pattern: /citi\s*cards?|chase\s*card/i, action: 'card_payment' },
  { pattern: /transfer\s+(from|to)/i, action: 'transfer' },
  { pattern: /owner\s+draw|distribution/i, action: 'owner_draw' },
  { pattern: /capital\s+contribution/i, action: 'owner_contribution' },
]

export function suggestActionType(desc: string, amount: number): { action: ActionType; note?: string } {
  const lowerDesc = desc.toLowerCase()
  for (const rule of PATTERN_RULES) {
    if (rule.pattern.test(desc)) {
      return { action: rule.action, note: rule.note }
    }
  }
  return { action: 'categorize' }
}
