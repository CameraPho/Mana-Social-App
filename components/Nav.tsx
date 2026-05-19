'use client'
import React from 'react'
import { FONT, type Palette } from '@/lib/constants'

export const TABS = [
  { id: 'home',    label: 'Home'    },
  { id: 'in',      label: 'Money In' },
  { id: 'out',     label: 'Money Out' },
  { id: 'bank',    label: 'Bank'    },
  { id: 'reports', label: 'Reports' },
]

export default function Nav({ activeTab, setActiveTab, C, isDark }: {
  activeTab: string
  setActiveTab: (id: string) => void
  C: Palette
  isDark: boolean
}) {
  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: isDark ? '#111D33' : '#FFFFFF', borderTop: `2px solid ${C.border}`, display: 'flex', zIndex: 400, height: '76px' }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flex: 1, border: 'none', background: 'none', fontSize: '13px', fontWeight: 900, color: activeTab === t.id ? C.teal : C.muted, padding: '8px 2px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, borderTop: activeTab === t.id ? `3px solid ${C.teal}` : '3px solid transparent', minWidth: 0 }}>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
