'use client'

// ============================================================
// ACCOUNT OWNERSHIP MAP
// Only LLC accounts: Wells Fargo Business Checking (1020) +
// Wells Fargo Signify Mastercard (2160).
// Everything else (sole-prop, personal) routes through Due to
// Cam (2610) or Due to Kenny (2620).
// ============================================================

type AccountOwner =
  | { type: 'llc_bank' | 'llc_card'; gl: string }
  | { type: 'personal_cam' | 'personal_kenny' }
  | { type: 'personal_cam_card' | 'personal_kenny_card'; subGl: string }

const ACCOUNT_OWNERSHIP: Record<string, AccountOwner> = {
  // ===== NEW uniform names (Owner | Bank Type) =====
  // LLC accounts
  'Mana Social | WF Business Checking': { type: 'llc_bank', gl: '1020' },
  'Mana Social | WF Signify Mastercard': { type: 'llc_card', gl: '2160' },
  // Personal — Cam
  // Chase Personal is treated as an LLC asset (de facto business account per CPA)
  'Cam | Chase Personal Checking': { type: 'llc_bank', gl: '1030' },
  // WF Personal stays as personal — still Cam's personal account
  'Cam | WF Personal Checking': { type: 'personal_cam' },
  // Personal credit cards route to specific sub-accounts of 2610
  'Cam | Costco Citi Visa': { type: 'personal_cam_card', subGl: '2610.01' },
  'Cam | Citi Diamond Preferred': { type: 'personal_cam_card', subGl: '2610.02' },
  'Cam | Amazon Chase Prime Visa': { type: 'personal_cam_card', subGl: '2610.03' },
  'Cam | Chase Sapphire Preferred': { type: 'personal_cam_card', subGl: '2610.04' },
  'Cam | Barclays View Mastercard': { type: 'personal_cam_card', subGl: '2610.05' },
  'Cam | Apple Card': { type: 'personal_cam_card', subGl: '2610.06' },
  // Personal — Kenny
  'Kenny | WF Personal Checking': { type: 'personal_kenny' },

  // ===== LEGACY names (pre-rename, kept for backward-compat) =====
  'Wells Fargo Business Checking': { type: 'llc_bank', gl: '1020' },
  'Wells Fargo': { type: 'llc_bank', gl: '1020' },
  'Wells Fargo Signify Mastercard': { type: 'llc_card', gl: '2160' },
  'WF Signify': { type: 'llc_card', gl: '2160' },
  // Legacy Chase Business/Checking aliases — now route as LLC bank (Chase Personal is business per CPA)
  'Chase Business Checking': { type: 'llc_bank', gl: '1030' },
  'Chase Checking': { type: 'llc_bank', gl: '1030' },
  // Chase Ink legacy: route to parent 2610 since we don't have a sub-GL for it
  'Chase Ink': { type: 'personal_cam' },
  'Costco Citi Visa': { type: 'personal_cam_card', subGl: '2610.01' },
  'Citi Diamond Preferred': { type: 'personal_cam_card', subGl: '2610.02' },
  'Amazon Chase Prime Visa': { type: 'personal_cam_card', subGl: '2610.03' },
  'Chase Sapphire Preferred': { type: 'personal_cam_card', subGl: '2610.04' },
  'Barclays View Mastercard': { type: 'personal_cam_card', subGl: '2610.05' },
  'Wells Fargo Preferred Checking': { type: 'personal_cam' },
  'Wells Fargo Preferred': { type: 'personal_cam' },
}

const DEFAULT_LLC_BANK_GL = '1020'
const DUE_TO_CAM_GL = '2610'
const DUE_TO_KENNY_GL = '2620'

const PLATFORM_TO_REVENUE_GL: Record<string, string> = {
  'tcgplayer': '4010', 'ebay': '4020', 'manapool': '4030',
  'in-person': '4040', 'inperson': '4040', 'in_person': '4040',
}

const PLATFORM_TO_AR_GL: Record<string, string> = {
  'tcgplayer': '1110', 'ebay': '1120', 'manapool': '1130',
}

const PLATFORM_TO_FEES_GL: Record<string, string> = {
  'tcgplayer': '7210', 'ebay': '7220', 'manapool': '7230',
}

const EXPENSE_CATEGORY_TO_GL: Record<string, string> = {
  'Supplies & Packaging': '6010', 'Supplies': '6010',
  'Office Supplies': '6020',
  'Marketing': '6030', 'Marketing & Advertising': '6030', 'Advertising': '6030',
  'Software': '6040', 'Software & Subscriptions': '6040', 'Subscriptions': '6040',
  'Travel': '6050',
  'Meals': '6060', 'Meals & Entertainment': '6060',
  'Vehicle': '6070', 'Mileage': '6070',
  'Insurance': '6080',
  'Professional Services': '6090', 'Legal': '6090', 'Accounting': '6090',
  'Rent': '6100', 'Utilities': '6110', 'Bank Fees': '6120',
  'Shipping': '7300', 'Postage': '7300', 'Shipping & Postage': '7300',
  'Interest': '7400', 'Other': '6130',
  'Inventory Purchase': '1200', 'Inventory': '1200',
}

// ============================================================
// HELPERS
// ============================================================

export function getAccountIdByNumber(accounts: any[], accountNumber: string): string | null {
  const acc = accounts.find(a => a.account_number === accountNumber)
  return acc?.id || null
}

function resolveBankOrCardId(accounts: any[], paymentMethod: string | null | undefined): string | null {
  if (!paymentMethod) return getAccountIdByNumber(accounts, DEFAULT_LLC_BANK_GL)
  const owner = ACCOUNT_OWNERSHIP[paymentMethod.trim()]
  if (!owner) return getAccountIdByNumber(accounts, DEFAULT_LLC_BANK_GL)
  if (owner.type === 'llc_bank' || owner.type === 'llc_card') return getAccountIdByNumber(accounts, owner.gl)
  if (owner.type === 'personal_cam') return getAccountIdByNumber(accounts, DUE_TO_CAM_GL)
  if (owner.type === 'personal_kenny') return getAccountIdByNumber(accounts, DUE_TO_KENNY_GL)
  if (owner.type === 'personal_cam_card' || owner.type === 'personal_kenny_card') return getAccountIdByNumber(accounts, owner.subGl)
  return getAccountIdByNumber(accounts, DEFAULT_LLC_BANK_GL)
}

function describePaymentSide(paymentMethod: string | null | undefined): string {
  if (!paymentMethod) return 'Paid from LLC bank'
  const owner = ACCOUNT_OWNERSHIP[paymentMethod.trim()]
  if (!owner) return `Paid via ${paymentMethod} (default LLC bank)`
  if (owner.type === 'llc_bank') return `Paid via ${paymentMethod} (LLC bank)`
  if (owner.type === 'llc_card') return `Paid via ${paymentMethod} (LLC card)`
  if (owner.type === 'personal_cam') return `Paid via ${paymentMethod} — owed to Cam`
  if (owner.type === 'personal_kenny') return `Paid via ${paymentMethod} — owed to Kenny`
  if (owner.type === 'personal_cam_card') return `Paid via ${paymentMethod} — sub-acct ${owner.subGl}`
  if (owner.type === 'personal_kenny_card') return `Paid via ${paymentMethod} — sub-acct ${owner.subGl}`
  return `Paid via ${paymentMethod}`
}

function memberAccountId(accounts: any[], memberName: string, type: 'contribution' | 'draw' | 'loan'): string | null {
  const map: Record<string, Record<string, string>> = {
    'cam':   { contribution: '3010', draw: '3030', loan: '2510' },
    'kenny': { contribution: '3020', draw: '3040', loan: '2520' },
  }
  const key = (memberName || '').toLowerCase().trim()
  const number = map[key]?.[type]
  return number ? getAccountIdByNumber(accounts, number) : null
}

let BUILD_STAGED = false
export function setBuildMode(staged: boolean) { BUILD_STAGED = staged }

function buildJE(headerProps: any, lines: any[]): any | null {
  const round = (n: number) => Math.round(n * 100) / 100
  const totalDebit = round(lines.reduce((s, l) => s + Number(l.debit || 0), 0))
  const totalCredit = round(lines.reduce((s, l) => s + Number(l.credit || 0), 0))
  if (Math.abs(totalDebit - totalCredit) > 0.01) return null
  if (totalDebit === 0) return null
  return {
    header: { ...headerProps, total_debit: totalDebit, total_credit: totalCredit, is_posted: !BUILD_STAGED, posted_by: BUILD_STAGED ? 'staged-pending' : 'auto-generated', entity: 'Mana Social LLC' },
    lines: lines.map((l, idx) => ({ ...l, line_order: idx, debit: round(Number(l.debit) || 0), credit: round(Number(l.credit) || 0) })),
  }
}

// ============================================================
// GENERATORS
// ============================================================

export function generateSaleJE(sale: any, accounts: any[]): any | null {
  const platform = (sale.platform || '').toLowerCase().trim()
  const revenueId = getAccountIdByNumber(accounts, PLATFORM_TO_REVENUE_GL[platform] || '4050')
  if (!revenueId) return null

  const arAccountNum = PLATFORM_TO_AR_GL[platform]
  const cashOrArId = arAccountNum
    ? getAccountIdByNumber(accounts, arAccountNum)
    : getAccountIdByNumber(accounts, DEFAULT_LLC_BANK_GL)
  if (!cashOrArId) return null

  const salesTaxId = getAccountIdByNumber(accounts, '2200')
  const feesId = PLATFORM_TO_FEES_GL[platform] ? getAccountIdByNumber(accounts, PLATFORM_TO_FEES_GL[platform]) : null

  const grossAmount = Number(sale.amount) || 0
  // Sum the 3 sales-tax columns; fall back to legacy single column if present.
  const tax = (Number(sale.ca_sales_tax || 0) + Number(sale.other_domestic_sales_tax || 0) + Number(sale.international_sales_tax || 0)) || Number(sale.sales_tax_collected || 0)
  // Defensive: fees should always be positive (a deduction). Some legacy imports stored fees as negative.
  const fees = Math.abs(Number(sale.fees) || 0)
  if (grossAmount <= 0) return null

  const netRevenue = grossAmount - tax
  const cashReceived = grossAmount - fees

  const lines: any[] = []
  lines.push({ account_id: cashOrArId, debit: cashReceived, credit: 0, description: arAccountNum ? `${platform} payout pending` : `${platform || 'sale'} cash received` })
  if (fees > 0 && feesId) lines.push({ account_id: feesId, debit: fees, credit: 0, description: `${platform} commission/fees` })
  lines.push({ account_id: revenueId, debit: 0, credit: netRevenue, description: `${platform || 'sale'} revenue` })
  if (tax > 0 && salesTaxId) lines.push({ account_id: salesTaxId, debit: 0, credit: tax, description: 'Sales tax collected' })

  return buildJE({
    entry_date: sale.sale_date,
    description: `Sale via ${platform || 'other'}: $${grossAmount.toFixed(2)}`,
    source_type: 'sale', source_id: sale.id, notes: sale.notes || null,
  }, lines)
}

export function generateExpenseJE(expense: any, accounts: any[]): any | null {
  const category = expense.category || 'Other'
  const expenseId = getAccountIdByNumber(accounts, EXPENSE_CATEGORY_TO_GL[category] || '6130')
  if (!expenseId) return null

  const cost = Number(expense.cost) || 0
  if (cost === 0) return null

  const paymentMethod = expense.payment_method || expense.account_paid || null
  const sourceAccountId = resolveBankOrCardId(accounts, paymentMethod)
  if (!sourceAccountId) return null

  // REFUND (negative cost): reverse the original purchase.
  // DR the card/source (refund money came back to it) · CR the expense/asset category.
  if (cost < 0 || expense.is_refund) {
    const refundAmt = Math.abs(cost)
    return buildJE({
      entry_date: expense.purchase_date,
      description: `Refund — ${category}: $${refundAmt.toFixed(2)}`,
      source_type: 'expense', source_id: expense.id, notes: expense.notes || null,
    }, [
      { account_id: sourceAccountId, debit: refundAmt, credit: 0, description: describePaymentSide(paymentMethod) + ' (refund received)' },
      { account_id: expenseId, debit: 0, credit: refundAmt, description: `Reverse ${category}` },
    ])
  }

  const creditAccountId = sourceAccountId
  return buildJE({
    entry_date: expense.purchase_date,
    description: `${category}: $${cost.toFixed(2)}`,
    source_type: 'expense', source_id: expense.id, notes: expense.notes || null,
  }, [
    { account_id: expenseId, debit: cost, credit: 0, description: expense.notes || category },
    { account_id: creditAccountId, debit: 0, credit: cost, description: describePaymentSide(paymentMethod) },
  ])
}

export function generateEquityJE(eq: any, accounts: any[]): any | null {
  const amount = Number(eq.amount) || 0
  if (amount <= 0) return null
  const type = (eq.transaction_type || eq.type || 'contribution').toLowerCase()
  const memberName = eq.member_name || 'Cam'
  const bankId = getAccountIdByNumber(accounts, DEFAULT_LLC_BANK_GL)
  if (!bankId) return null

  // Sole-prop era (before 2026-03-18): no inter-entity Due-to/from tracking.
  // The owner and the business were the same tax entity, so member-clearing
  // entries don't apply. Skip generating a JE for member-clearing types.
  // EXCEPTION: platform payouts (TCGplayer/eBay/ManaPool) deposit 1-4 weeks
  // after the sale, so deposits in the first 8 days of LLC era (through 2026-03-25)
  // still represent sole-prop receivables being collected — gate them too.
  const txnDate = eq.transaction_date ? new Date(eq.transaction_date) : null
  const LLC_START = new Date('2026-03-18')
  const PLATFORM_PAYOUT_CUTOVER = new Date('2026-03-26')
  const effectiveCutoff = type === 'platform_payout_to_personal' ? PLATFORM_PAYOUT_CUTOVER : LLC_START
  const isSoleProp = txnDate ? txnDate < effectiveCutoff : false
  const memberClearingTypes = ['owner_payable', 'non_business', 'platform_payout_to_personal']
  if (isSoleProp && memberClearingTypes.includes(type)) return null

  // Platform payout deposited to a member's personal account.
  // The member collected LLC cash → reduce "Due to Member" against platform AR.
  // DR Due to/from Member · CR AR-Platform (1110/1120/1130)
  if (type === 'platform_payout_to_personal') {
    const dueToId = getAccountIdByNumber(accounts, memberName.toLowerCase().trim() === 'kenny' ? DUE_TO_KENNY_GL : DUE_TO_CAM_GL)
    if (!dueToId) return null
    const platform = (eq.paid_from || '').toLowerCase()
    const arGL = PLATFORM_TO_AR_GL[platform]
    if (!arGL) return null
    const arId = getAccountIdByNumber(accounts, arGL)
    if (!arId) return null
    return buildJE({
      entry_date: eq.transaction_date,
      description: `${platform.toUpperCase()} payout to ${memberName} (personal): $${amount.toFixed(2)}`,
      source_type: 'equity_transaction', source_id: eq.id, notes: eq.notes || null,
    }, [
      { account_id: dueToId, debit: amount, credit: 0, description: `${memberName} collected LLC platform cash personally` },
      { account_id: arId, debit: 0, credit: amount, description: `Clear ${platform} AR` },
    ])
  }

  // Non-business charge on a business account: member owes the LLC back.
  // DR Due to/from Member · CR the business account that wrongly paid.
  if (type === 'non_business') {
    const dueToId = getAccountIdByNumber(accounts, memberName.toLowerCase().trim() === 'kenny' ? DUE_TO_KENNY_GL : DUE_TO_CAM_GL)
    if (!dueToId) return null
    const businessAcctId = resolveBankOrCardId(accounts, eq.paid_from)
    if (!businessAcctId) return null
    return buildJE({
      entry_date: eq.transaction_date,
      description: `Non-business charge — ${memberName} owes LLC: $${amount.toFixed(2)}`,
      source_type: 'equity_transaction', source_id: eq.id, notes: eq.notes || null,
    }, [
      { account_id: dueToId, debit: amount, credit: 0, description: `${memberName} owes LLC (non-business charge)` },
      { account_id: businessAcctId, debit: 0, credit: amount, description: describePaymentSide(eq.paid_from) },
    ])
  }

  if (type === 'contribution') {
    const equityId = memberAccountId(accounts, memberName, 'contribution')
    if (!equityId) return null
    return buildJE({
      entry_date: eq.transaction_date,
      description: `Capital contribution from ${memberName}: $${amount.toFixed(2)}`,
      source_type: 'equity_transaction', source_id: eq.id, notes: eq.notes || null,
    }, [
      { account_id: bankId, debit: amount, credit: 0, description: 'Cash received' },
      { account_id: equityId, debit: 0, credit: amount, description: `${memberName} capital contribution` },
    ])
  }

  if (type === 'draw' || type === 'distribution') {
    const drawId = memberAccountId(accounts, memberName, 'draw')
    if (!drawId) return null
    return buildJE({
      entry_date: eq.transaction_date,
      description: `Owner draw to ${memberName}: $${amount.toFixed(2)}`,
      source_type: 'equity_transaction', source_id: eq.id, notes: eq.notes || null,
    }, [
      { account_id: drawId, debit: amount, credit: 0, description: `${memberName} draw` },
      { account_id: bankId, debit: 0, credit: amount, description: 'Cash paid out' },
    ])
  }

  if (type === 'owner_payable') {
    const dueToId = getAccountIdByNumber(accounts, memberName.toLowerCase().trim() === 'kenny' ? DUE_TO_KENNY_GL : DUE_TO_CAM_GL)
    if (!dueToId) return null
    const paidFrom = eq.paid_from || 'Mana Social | WF Business Checking'
    const owner = ACCOUNT_OWNERSHIP[paidFrom.trim()]
    const isLLCBank = owner && owner.type === 'llc_bank'
    // Only the LLC reimbursing you from LLC cash hits the books.
    // Personal-account-pays-personal-card is your own money movement → no JE (return null).
    if (!isLLCBank) return null
    const payFromId = resolveBankOrCardId(accounts, paidFrom)
    if (!payFromId) return null
    return buildJE({
      entry_date: eq.transaction_date,
      description: `Owner payable reimbursed (LLC cash) — ${memberName}: $${amount.toFixed(2)}`,
      source_type: 'equity_transaction', source_id: eq.id, notes: eq.notes || null,
    }, [
      { account_id: dueToId, debit: amount, credit: 0, description: `Reduce Due to ${memberName}` },
      { account_id: payFromId, debit: 0, credit: amount, description: `Cash paid from ${paidFrom}` },
    ])
  }
return null
}

export function generateInventoryPurchaseJE(inv: any, accounts: any[]): any | null {
  const totalCost = Number(inv.total_cost) || 0
  if (totalCost <= 0) return null
  const inventoryId = getAccountIdByNumber(accounts, '1200') // single Inventory asset
  if (!inventoryId) return null
  const paymentMethod = inv.payment_method || inv.account_paid || null
  const creditAccountId = resolveBankOrCardId(accounts, paymentMethod)
  if (!creditAccountId) return null

  return buildJE({
    entry_date: inv.date,
    description: `Inventory purchase: ${inv.description || inv.inventory_type || 'inventory'} — $${totalCost.toFixed(2)}`,
    source_type: 'cogs_inventory', source_id: inv.id, notes: inv.set_name || null,
  }, [
    { account_id: inventoryId, debit: totalCost, credit: 0, description: `Inventory: ${inv.description || inv.inventory_type || ''}`.trim() },
    { account_id: creditAccountId, debit: 0, credit: totalCost, description: describePaymentSide(paymentMethod) },
  ])
}

// Periodic COGS adjustment: move cost of sold inventory from Inventory(1200) to COGS(5000).
// amount = Beginning + Purchases − Ending (computed by the caller).
export function generatePeriodicCOGSJE(adj: any, accounts: any[]): any | null {
  const amount = Number(adj.cogs_amount) || 0
  if (amount === 0) return null
  const inventoryId = getAccountIdByNumber(accounts, '1200')
  const cogsId = getAccountIdByNumber(accounts, '5000')
  if (!inventoryId || !cogsId) return null

  // Positive COGS = inventory consumed (DR COGS / CR Inventory).
  // Negative (rare, inventory grew beyond purchases) reverses.
  const amt = Math.abs(amount)
  const drId = amount > 0 ? cogsId : inventoryId
  const crId = amount > 0 ? inventoryId : cogsId
  return buildJE({
    entry_date: adj.period_end,
    description: `Periodic COGS adjustment (${adj.period_label || adj.period_end}): $${amount.toFixed(2)}`,
    source_type: 'cogs_adjustment', source_id: adj.id, notes: adj.notes || null,
  }, [
    { account_id: drId, debit: amt, credit: 0, description: amount > 0 ? 'Cost of goods sold' : 'Inventory increase adj' },
    { account_id: crId, debit: 0, credit: amt, description: amount > 0 ? 'Relieve inventory' : 'COGS reversal' },
  ])
}

export function generateDisbursementJE(disb: any, accounts: any[]): any | null {
  const amount = Number(disb.amount) || 0
  if (amount <= 0) return null
  const recipient = disb.recipient || 'Cam'
  const drawId = memberAccountId(accounts, recipient, 'draw')
  const bankId = getAccountIdByNumber(accounts, DEFAULT_LLC_BANK_GL)
  if (!drawId || !bankId) return null

  return buildJE({
    entry_date: disb.disbursement_date,
    description: `Disbursement to ${recipient}: $${amount.toFixed(2)}`,
    source_type: 'disbursement', source_id: disb.id, notes: disb.notes || null,
  }, [
    { account_id: drawId, debit: amount, credit: 0, description: `Draw to ${recipient}` },
    { account_id: bankId, debit: 0, credit: amount, description: 'Cash paid out' },
  ])
}

export function generateMemberLoanJE(loan: any, accounts: any[]): any | null {
  const principal = Number(loan.principal) || 0
  if (principal <= 0) return null
  const memberName = loan.member_name || 'Cam'
  const loanLiabilityId = memberAccountId(accounts, memberName, 'loan')
  const bankId = getAccountIdByNumber(accounts, DEFAULT_LLC_BANK_GL)
  if (!loanLiabilityId || !bankId) return null

  return buildJE({
    entry_date: loan.loan_date,
    description: `Loan from ${memberName}: $${principal.toFixed(2)}`,
    source_type: 'member_loan', source_id: loan.id, notes: loan.notes || null,
  }, [
    { account_id: bankId, debit: principal, credit: 0, description: 'Loan proceeds received' },
    { account_id: loanLiabilityId, debit: 0, credit: principal, description: `Loan from ${memberName}` },
  ])
}

export function generateLoanPaymentJE(payment: any, accounts: any[], memberLoans: any[]): any | null {
  const principalPaid = Number(payment.principal_paid) || 0
  const interestPaid = Number(payment.interest_paid) || 0
  const totalPaid = principalPaid + interestPaid
  if (totalPaid <= 0) return null
  const loan = memberLoans.find(l => l.id === payment.loan_id)
  if (!loan) return null
  const memberName = loan.member_name || 'Cam'
  const loanLiabilityId = memberAccountId(accounts, memberName, 'loan')
  const interestExpenseId = getAccountIdByNumber(accounts, '7400')
  const bankId = getAccountIdByNumber(accounts, DEFAULT_LLC_BANK_GL)
  if (!loanLiabilityId || !bankId) return null
  if (interestPaid > 0 && !interestExpenseId) return null

  const lines: any[] = []
  if (principalPaid > 0) lines.push({ account_id: loanLiabilityId, debit: principalPaid, credit: 0, description: `Loan principal payment to ${memberName}` })
  if (interestPaid > 0 && interestExpenseId) lines.push({ account_id: interestExpenseId, debit: interestPaid, credit: 0, description: `Loan interest paid to ${memberName}` })
  lines.push({ account_id: bankId, debit: 0, credit: totalPaid, description: 'Payment from bank' })

  return buildJE({
    entry_date: payment.payment_date,
    description: `Loan repayment to ${memberName}: $${totalPaid.toFixed(2)}`,
    source_type: 'member_loan_payment', source_id: payment.id, notes: payment.notes || null,
  }, lines)
}

export function generateSalesTaxRemittanceJE(remit: any, accounts: any[]): any | null {
  const amount = Number(remit.amount) || 0
  if (amount <= 0) return null
  const salesTaxId = getAccountIdByNumber(accounts, '2200')
  const bankId = getAccountIdByNumber(accounts, DEFAULT_LLC_BANK_GL)
  if (!salesTaxId || !bankId) return null

  return buildJE({
    entry_date: remit.remittance_date || remit.payment_date,
    description: `Sales tax remittance to CDTFA: $${amount.toFixed(2)}`,
    source_type: 'sales_tax_remittance', source_id: remit.id, notes: remit.notes || null,
  }, [
    { account_id: salesTaxId, debit: amount, credit: 0, description: 'CDTFA payment' },
    { account_id: bankId, debit: 0, credit: amount, description: 'Paid from bank' },
  ])
}

export function generateTaxPaymentJE(payment: any, accounts: any[]): any | null {
  const amount = Number(payment.amount_paid) || 0
  if (amount <= 0) return null
  if (!payment.payment_date) return null

  const taxType = (payment.tax_type || '').toLowerCase()
  let glNumber = '6160'
  let drDescription = 'Tax payment'
  if (taxType.includes('pte')) { glNumber = '6160'; drDescription = 'PTE Tax - California' }
  else if (taxType.includes('franchise')) { glNumber = '6170'; drDescription = 'CA LLC Franchise Tax' }
  else if (taxType.includes('payroll')) { glNumber = '6180'; drDescription = 'Payroll Tax Expense' }
  else if (taxType.includes('sales tax')) { glNumber = '2200'; drDescription = 'Sales tax liability cleared' }

  const drAccountId = getAccountIdByNumber(accounts, glNumber)
  if (!drAccountId) return null

  const paymentMethod = payment.payment_method || ''
  const crAccountId = resolveBankOrCardId(accounts, paymentMethod) || getAccountIdByNumber(accounts, DEFAULT_LLC_BANK_GL)
  if (!crAccountId) return null

  return buildJE({
    entry_date: payment.payment_date,
    description: `${payment.tax_type} payment to ${payment.tax_authority || 'tax authority'}: $${amount.toFixed(2)}`,
    source_type: 'tax_payment', source_id: payment.id, notes: payment.notes || null,
  }, [
    { account_id: drAccountId, debit: amount, credit: 0, description: drDescription },
    { account_id: crAccountId, debit: 0, credit: amount, description: describePaymentSide(paymentMethod) || 'Paid from LLC checking' },
  ])
}

export function generateBillPaymentJE(payment: any, accounts: any[], accountsPayable: any[]): any | null {
  // bill_payments uses 'amount' (not 'amount_paid'); fall back to amount_paid for any legacy callers.
  const amount = Number(payment.amount ?? payment.amount_paid) || 0
  if (amount <= 0) return null
  const bill = accountsPayable.find(ap => ap.id === payment.bill_id)
  if (!bill) return null
  const apId = getAccountIdByNumber(accounts, '2010')
  if (!apId) return null
  const paymentMethod = payment.payment_method || 'Wells Fargo Business Checking'
  const sourceId = resolveBankOrCardId(accounts, paymentMethod)
  if (!sourceId) return null

  return buildJE({
    entry_date: payment.payment_date,
    description: `Bill payment to ${bill.vendor_name}: $${amount.toFixed(2)}`,
    source_type: 'bill_payment', source_id: payment.id, notes: payment.notes || null,
  }, [
    { account_id: apId, debit: amount, credit: 0, description: `Payment on AP - ${bill.vendor_name}` },
    { account_id: sourceId, debit: 0, credit: amount, description: describePaymentSide(paymentMethod) },
  ])
}

// ============================================================
// INSERTION HELPERS
// ============================================================

// Map a source/table name to its generator. Some generators need extra context (loans, AP).
async function runGenerator(sourceType: string, record: any, accounts: any[], supabase: any): Promise<any | null> {
  switch (sourceType) {
    case 'sale': return generateSaleJE(record, accounts)
    case 'expense': return generateExpenseJE(record, accounts)
    case 'equity_transaction': return generateEquityJE(record, accounts)
    case 'disbursement': return generateDisbursementJE(record, accounts)
    case 'member_loan': return generateMemberLoanJE(record, accounts)
    case 'sales_tax_remittance': return generateSalesTaxRemittanceJE(record, accounts)
    case 'tax_payment': return generateTaxPaymentJE(record, accounts)
    case 'cogs_inventory': return generateInventoryPurchaseJE(record, accounts)
    case 'cogs_adjustment': return generatePeriodicCOGSJE(record, accounts)
    case 'member_loan_payment': {
      const { data: loans } = await supabase.from('member_loans').select('*')
      return generateLoanPaymentJE(record, accounts, loans || [])
    }
    case 'bill_payment': {
      const { data: ap } = await supabase.from('accounts_payable').select('*')
      return generateBillPaymentJE(record, accounts, ap || [])
    }
    default: return null
  }
}

// Stage a JE for a single source record (is_posted=false). Self-fetches accounts. Idempotent.
export async function stageJEForRecord(
  sourceType: string,
  record: any,
  supabase: any
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    if (!record || !record.id) return { success: false, error: 'No record id' }
    const { data: existing } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('source_type', sourceType)
      .eq('source_id', record.id)
      .limit(1)
    if (existing && existing.length > 0) return { success: true, skipped: true }
    const { data: accounts } = await supabase.from('chart_of_accounts').select('*')
    if (!accounts || accounts.length === 0) return { success: false, error: 'No chart of accounts' }
    const payload = await runGenerator(sourceType, record, accounts, supabase)
    if (!payload) return { success: false, error: `No JE generated for ${sourceType} (unbalanced or unmapped)` }
    // Force staged status directly on the payload (no reliance on module flag)
    payload.header.is_posted = false
    payload.header.posted_by = 'staged-pending'
    const result = await insertJE(payload, supabase)
    return { success: result.success, error: result.error }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function approveJEs(entryIds: string[], supabase: any): Promise<{ success: boolean; error?: string }> {
  if (entryIds.length === 0) return { success: true }
  const { error } = await supabase
    .from('journal_entries')
    .update({ is_posted: true, posted_by: 'approved' })
    .in('id', entryIds)
  return { success: !error, error: error?.message }
}

export async function rejectJEs(entryIds: string[], supabase: any): Promise<{ success: boolean; error?: string }> {
  if (entryIds.length === 0) return { success: true }
  await supabase.from('journal_entry_lines').delete().in('entry_id', entryIds)
  const { error } = await supabase.from('journal_entries').delete().in('id', entryIds)
  return { success: !error, error: error?.message }
}

export async function insertJE(payload: any, supabase: any): Promise<{ success: boolean; error?: string; entryId?: string }> {
  try {
    const { data: je, error: jeErr } = await supabase.from('journal_entries').insert(payload.header).select().single()
    if (jeErr) return { success: false, error: jeErr.message }
    const linesPayload = payload.lines.map((l: any) => ({ ...l, entry_id: je.id }))
    const { error: linesErr } = await supabase.from('journal_entry_lines').insert(linesPayload)
    if (linesErr) {
      await supabase.from('journal_entries').delete().eq('id', je.id)
      return { success: false, error: linesErr.message }
    }
    return { success: true, entryId: je.id }
  } catch (err: any) {
    return { success: false, error: err.message || String(err) }
  }
}

export async function deleteJEsBySource(supabase: any, sourceType: string): Promise<{ deleted: number; error?: string }> {
  try {
    const { data, error } = await supabase.from('journal_entries').delete().eq('source_type', sourceType).select()
    if (error) return { deleted: 0, error: error.message }
    return { deleted: data?.length || 0 }
  } catch (err: any) {
    return { deleted: 0, error: err.message || String(err) }
  }
}
