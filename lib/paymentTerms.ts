// lib/paymentTerms.ts
// Payment terms definitions, due-date calculations, and AP aging buckets.

export type PaymentTerm =
  | 'due_on_receipt'
  | 'net_7'
  | 'net_10'
  | 'net_15'
  | 'net_30'
  | 'net_45'
  | 'net_60'
  | 'net_90'
  | 'eom'              // End of month
  | '2_10_net_30'      // 2% discount if paid in 10 days, full due in 30

export const PAYMENT_TERM_LABELS: Record<PaymentTerm, string> = {
  due_on_receipt: 'Due on Receipt',
  net_7:          'Net 7',
  net_10:         'Net 10',
  net_15:         'Net 15',
  net_30:         'Net 30',
  net_45:         'Net 45',
  net_60:         'Net 60',
  net_90:         'Net 90',
  eom:            'End of Month',
  '2_10_net_30':  '2/10 Net 30',
}

// Days from invoice date to due date
const TERM_DAYS: Record<PaymentTerm, number | 'eom'> = {
  due_on_receipt: 0,
  net_7:          7,
  net_10:         10,
  net_15:         15,
  net_30:         30,
  net_45:         45,
  net_60:         60,
  net_90:         90,
  eom:            'eom',
  '2_10_net_30':  30,
}

// Calculate due_date from invoice_date + terms
export function calculateDueDate(invoiceDate: string, terms: PaymentTerm): string {
  const d = new Date(invoiceDate + 'T00:00:00')
  const days = TERM_DAYS[terms]
  if (days === 'eom') {
    // Last day of the invoice month
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return lastDay.toISOString().slice(0, 10)
  }
  d.setDate(d.getDate() + (days as number))
  return d.toISOString().slice(0, 10)
}

// Calculate days overdue (negative = days until due)
export function daysOverdue(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  const diffMs = today.getTime() - due.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export type AgingBucket = 'not_due' | '0_30' | '31_60' | '61_90' | '90_plus' | 'paid'

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  not_due:  'Not Due Yet',
  '0_30':   '0-30 Days Overdue',
  '31_60':  '31-60 Days Overdue',
  '61_90':  '61-90 Days Overdue',
  '90_plus':'90+ Days Overdue',
  paid:     'Paid',
}

export const AGING_BUCKET_COLORS: Record<AgingBucket, string> = {
  not_due:  '#2DD4BF',  // teal — fine
  '0_30':   '#FBBF24',  // amber — caution
  '31_60':  '#F59E0B',  // orange — warning
  '61_90':  '#EF4444',  // red — alert
  '90_plus':'#7F1D1D',  // dark red — critical
  paid:     '#10B981',  // green — done
}

// Determine which aging bucket a bill belongs to
export function getAgingBucket(bill: { 
  total_amount: number | string
  amount_paid?: number | string | null
  due_date: string 
}): AgingBucket {
  const total = Number(bill.total_amount) || 0
  const paid = Number(bill.amount_paid) || 0
  if (paid >= total) return 'paid'
  
  const days = daysOverdue(bill.due_date)
  if (days < 0) return 'not_due'
  if (days <= 30) return '0_30'
  if (days <= 60) return '31_60'
  if (days <= 90) return '61_90'
  return '90_plus'
}

// Status helper based on payment progress
export function getBillStatus(bill: {
  total_amount: number | string
  amount_paid?: number | string | null
  due_date: string
}): { label: string; color: string } {
  const total = Number(bill.total_amount) || 0
  const paid = Number(bill.amount_paid) || 0
  if (paid >= total) return { label: 'Paid', color: '#10B981' }
  if (paid > 0) {
    const days = daysOverdue(bill.due_date)
    if (days > 0) return { label: 'Partial · Overdue', color: '#EF4444' }
    return { label: 'Partial', color: '#FBBF24' }
  }
  const days = daysOverdue(bill.due_date)
  if (days > 0) return { label: 'Overdue', color: '#EF4444' }
  return { label: 'Open', color: '#2DD4BF' }
}
