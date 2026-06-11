export const fmt = (n: number | null | undefined) => {
  const num = Number(n)
  if (!Number.isFinite(num)) return '$0.00'
  if (num < 0) return '-$' + Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const fmtK = (n: number | null | undefined) => {
  const num = Number(n)
  if (!Number.isFinite(num)) return '$0.00'
  if (Math.abs(num) >= 1000) return (num < 0 ? '-$' : '$') + (Math.abs(num) / 1000).toFixed(1) + 'k'
  return fmt(num)
}

export const pctFmt = (n: number, d: number) => d === 0 ? '—' : (n / d * 100).toFixed(1) + '%'

export const LLC_START = new Date('2026-03-18')

export const getEntity = (date: string): 'sole_prop' | 'llc' =>
  new Date(date) < LLC_START ? 'sole_prop' : 'llc'

export const today = () => new Date().toISOString().split('T')[0]
