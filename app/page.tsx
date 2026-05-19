'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { LIGHT_COLORS } from '@/lib/constants'
import LoginScreen from '@/components/LoginScreen'
import Dashboard from '@/components/Dashboard'

export default function Page() {
  const [authed, setAuthed] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
      setCheckingAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (checkingAuth) return (
    <div style={{ minHeight: '100vh', background: LIGHT_COLORS.navyDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid rgba(45,191,184,0.2)', borderTopColor: LIGHT_COLORS.teal, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  return <Dashboard />
}
