// lib/paymentTerms.ts
// Payment terms, due-date calculations, AP aging buckets, and payment plan logic.

export type PaymentTerm =
  | 'due_on_receipt'
  | 'net_7'
  | 'net_10'
  | 'net_15'
  | 'net_30'
  | 'net_45'
  | 'net_60'
  | 'net_90'
  | 'eom'
  | '2_10_net_30'

export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly'

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

export const PAYMENT_FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  weekly:   'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly:  'Monthly',
}

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

export function calculateDueDate(invoiceDate: string, terms: PaymentTerm): string {
  const d = new Date(invoiceDate + 'T00:00:00')
  const days = TERM_DAYS[terms]
  if (days === 'eom') {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return lastDay.toISOString().slice(0, 10)
  }
  d.setDate(d.getDate() + (days as number))
  return d.toISOString().slice(0, 10)
}

// Calculate the next due date for a payment plan based on payments made
export function calculatePlanNextDue(
  startDate: string,
  frequency: PaymentFrequency,
  paymentAmount: number,
  amountPaid: number,
  totalAmount: number
): string {
  if (amountPaid >= totalAmount) return startDate  // fully paid — doesn't matter
  const paymentsMade = Math.floor(amountPaid / paymentAmount)
  const d = new Date(startDate + 'T00:00:00')
  if (frequency === 'weekly') d.setDate(d.getDate() + paymentsMade * 7)
  else if (frequency === 'biweekly') d.setDate(d.getDate() + paymentsMade * 14)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + paymentsMade)
  return d.toISOString().slice(0, 10)
}

// Generate all scheduled payment dates for a plan
export function generatePaymentSchedule(
  startDate: string,
  frequency: PaymentFrequency,
  paymentAmount: number,
  totalAmount: number
): { dueDate: string; amount: number; paymentNumber: number }[] {
  const schedule: { dueDate: string; amount: number; paymentNumber: number }[] = []
  const totalPayments = Math.ceil(totalAmount / paymentAmount)
  let remaining = totalAmount
  for (let i = 0; i < totalPayments; i++) {
    const d = new Date(startDate + 'T00:00:00')
    if (frequency === 'weekly') d.setDate(d.getDate() + i * 7)
    else if (frequency === 'biweekly') d.setDate(d.getDate() + i * 14)
    else if (frequency === 'monthly') d.setMonth(d.getMonth() + i)
    const thisPayment = Math.min(paymentAmount, remaining)
    schedule.push({
      dueDate: d.toISOString().slice(0, 10),
      amount: thisPayment,
      paymentNumber: i + 1,
    })
    remaining -= thisPayment
  }
  return schedule
}

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
  not_due:  '#2DD4BF',
  '0_30':   '#FBBF24',
  '31_60':  '#F59E0B',
  '61_90':  '#EF4444',
  '90_plus':'#7F1D1D',
  paid:     '#10B981',
}

// For payment plan bills, use plan_next_due instead of due_date
export function getRelevantDueDate(bill: any): string {
  if (bill.payment_plan && bill.plan_start_date && bill.plan_payment_amount && bill.plan_frequency) {
    return calculatePlanNextDue(
      bill.plan_start_date,
      bill.plan_frequency,
      Number(bill.plan_payment_amount),
      Number(bill.amount_paid || 0),
      Number(bill.total_amount || 0)
    )
  }
  return bill.due_date
}

export function getAgingBucket(bill: any): AgingBucket {
  const total = Number(bill.total_amount) || 0
  const paid = Number(bill.amount_paid) || 0
  if (paid >= total) return 'paid'
  
  const relevantDueDate = getRelevantDueDate(bill)
  if (!relevantDueDate) return 'not_due'
  
  const days = daysOverdue(relevantDueDate)
  if (days < 0) return 'not_due'
  if (days <= 30) return '0_30'
  if (days <= 60) return '31_60'
  if (days <= 90) return '61_90'
  return '90_plus'
}

export function getBillStatus(bill: any): { label: string; color: string } {
  const total = Number(bill.total_amount) || 0
  const paid = Number(bill.amount_paid) || 0
  if (paid >= total) return { label: 'Paid', color: '#10B981' }
  
  const relevantDueDate = getRelevantDueDate(bill)
  const days = relevantDueDate ? daysOverdue(relevantDueDate) : 0
  
  if (paid > 0) {
    if (days > 0) return { label: 'Partial · Overdue', color: '#EF4444' }
    return { label: 'Partial', color: '#FBBF24' }
  }
  if (days > 0) return { label: 'Overdue', color: '#EF4444' }
  return { label: 'Open', color: '#2DD4BF' }
}

// Payment plan progress calculations
export function getPlanProgress(bill: any): { 
  paymentsMade: number
  totalPayments: number
  percentPaid: number
  nextDue: string | null
} {
  const total = Number(bill.total_amount) || 0
  const paid = Number(bill.amount_paid) || 0
  const planAmount = Number(bill.plan_payment_amount) || 0
  
  if (!bill.payment_plan || planAmount === 0 || total === 0) {
    return { paymentsMade: 0, totalPayments: 0, percentPaid: 0, nextDue: null }
  }
  
  const paymentsMade = Math.floor(paid / planAmount)
  const totalPayments = Math.ceil(total / planAmount)
  const percentPaid = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  const nextDue = paid >= total ? null : getRelevantDueDate(bill)
  
  return { paymentsMade, totalPayments, percentPaid, nextDue }
}
