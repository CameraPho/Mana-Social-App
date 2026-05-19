export const fmt = (n: number) => {
  if (n < 0) return '-$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const fmtK = (n: number) => {
  if (Math.abs(n) >= 1000) return (n < 0 ? '-$' : '$') + (Math.abs(n) / 1000).toFixed(1) + 'k'
  return fmt(n)
}

export const pctFmt = (n: number, d: number) => d === 0 ? '—' : (n / d * 100).toFixed(1) + '%'

export const LLC_START = new Date('2026-03-18')

export const getEntity = (date: string): 'sole_prop' | 'llc' =>
  new Date(date) < LLC_START ? 'sole_prop' : 'llc'

export const today = () => new Date().toISOString().split('T')[0]
