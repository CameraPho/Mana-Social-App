export const FONT = "var(--font-space-grotesk), 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif"

export const LIGHT_COLORS = {
  navy: '#1B2A4A', navyDark: '#111D33', teal: '#2DBFB8',
  pink: '#E8407A', purple: '#6B3FA0', gold: '#F0C040',
  bg: '#F0F2F8', white: '#FFFFFF', muted: '#8A96B0',
  text: '#1B2A4A', border: 'rgba(27,42,74,0.12)', green: '#10b981',
  cardBg: '#FFFFFF', inputBg: '#F5F6FA', navBg: '#FFFFFF',
}
export const DARK_COLORS = {
  navy: '#E2E8F4', navyDark: '#0A0F1E', teal: '#2DBFB8',
  pink: '#E8407A', purple: '#9B6FD0', gold: '#F0C040',
  bg: '#232D42', white: '#1E2A3E', muted: '#6B7A9A',
  text: '#E2E8F4', border: 'rgba(255,255,255,0.08)', green: '#34D399',
  cardBg: '#1E2A3E', inputBg: '#232D42', navBg: '#111D33',
}
export type Palette = typeof LIGHT_COLORS

export const DEDUCTIBILITY: Record<string, { pct: number | null, label: string, line: string }> = {
  'Shipping & Postage':         { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Selling Fees & Commissions': { pct: 100,  label: '100% deductible',             line: 'Sch C Line 10'  },
  'Software & Subscriptions':   { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Supplies & Packaging':       { pct: 100,  label: '100% deductible',             line: 'Sch C Line 22'  },
  'Advertising & Marketing':    { pct: 100,  label: '100% deductible',             line: 'Sch C Line 8'   },
  'Professional Services':      { pct: 100,  label: '100% deductible',             line: 'Sch C Line 17'  },
  'Banking & Finance Charges':  { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Taxes & Licenses':           { pct: 100,  label: '100% deductible',             line: 'Sch C Line 23'  },
  'Equipment':                  { pct: 100,  label: 'Sec 179 or depreciate',       line: 'Sch C Line 13'  },
  'Furniture & Fixtures':       { pct: 100,  label: 'Sec 179 or depreciate',       line: 'Sch C Line 13'  },
  'Travel':                     { pct: 100,  label: '100% deductible',             line: 'Sch C Line 24a' },
  'Meals & Entertainment':      { pct: 50,   label: '50% deductible',              line: 'Sch C Line 24b' },
  'Internet & Phone':           { pct: null, label: 'Partial — business use %',    line: 'Sch C Line 25'  },
  'Education & Training':       { pct: 100,  label: '100% deductible',             line: 'Sch C Line 27a' },
  'Home Office':                { pct: null, label: 'Partial — set % in settings', line: 'Sch C Line 30'  },
  'Inventory Purchase':         { pct: 100,  label: '100% — COGS when sold',       line: 'Sch C Line 38'  },
  'Other':                      { pct: null, label: 'Needs review',                line: 'Sch C Line 27a' },
}
export const EXPENSE_CATEGORIES = Object.keys(DEDUCTIBILITY)

export const MILEAGE_RATE = 0.67
export const ASSET_CATEGORIES = ['Equipment', 'Furniture & Fixtures', 'Vehicle']
export const USEFUL_LIFE: Record<string, number> = { Equipment: 5, 'Furniture & Fixtures': 7, Vehicle: 5 }

// Checking accounts. Naming scheme: "Owner | Bank Type"
// Mana Social = LLC account · Cam/Kenny = personal account
export const CHECKING_ACCOUNTS = [
  'Mana Social | WF Business Checking',   // LLC operating account
  'Cam | Chase Business Checking',        // legacy sole prop (winding down)
  'Cam | WF Personal Checking',           // personal
  'Kenny | WF Personal Checking',         // personal
]

// Credit cards. Mana Social Signify = LLC card · all others personal (Cam)
export const CREDIT_CARD_ACCOUNTS = [
  'Mana Social | WF Signify Mastercard',  // LLC business card
  'Cam | Barclays View Mastercard',
  'Cam | Amazon Chase Prime Visa',
  'Cam | Costco Citi Visa',
  'Cam | Citi Diamond Preferred',
  'Cam | Chase Sapphire Preferred',
]

// All accounts — used wherever a flat list is needed (e.g., the +Add Transaction form)
export const BANK_ACCOUNTS = [
  ...CHECKING_ACCOUNTS,
  ...CREDIT_CARD_ACCOUNTS,
]

// Maps OLD account names → NEW uniform names (for parser/import backward-compat)
export const ACCOUNT_NAME_ALIASES: Record<string, string> = {
  'Wells Fargo Business Checking': 'Mana Social | WF Business Checking',
  'Chase Business Checking': 'Cam | Chase Personal Checking',
  'Cam | Chase Business Checking': 'Cam | Chase Personal Checking',
  'Barclays View Mastercard': 'Cam | Barclays View Mastercard',
  'Amazon Chase Prime Visa': 'Cam | Amazon Chase Prime Visa',
  'Costco Citi Visa': 'Cam | Costco Citi Visa',
  'Citi Diamond Preferred': 'Cam | Citi Diamond Preferred',
  'Chase Sapphire Preferred': 'Cam | Chase Sapphire Preferred',
  'Chase Sapphire': 'Cam | Chase Sapphire Preferred',
}

export const AI_LEARN_KEY = 'mana_social_ai_corrections'
