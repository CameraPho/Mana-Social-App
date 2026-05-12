'use client'
import React from 'react'

export default function Dashboard() {
  return (
    <div style={{ 
      fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif',
      backgroundColor: '#f9fafb',
      minHeight: '100-screen',
      padding: '20px'
    }}>
      
      {/* Branded Header Card */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '16px',
        textAlign: 'center',
        border: '1px solid #f3f4f6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '16px' }}>
           <img 
            src="/logo.png" 
            alt="Mana Social Logo" 
            style={{ 
              width: '120px', 
              height: '120px', 
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto'
            }}
          />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: '0' }}>Mana Social LLC</h1>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Culture • Community • Games
        </p>
      </div>

      {/* Main Stats Card */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        overflow: 'hidden',
        border: '1px solid #f3f4f6',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
      }}>
        <div style={{ backgroundColor: '#2563eb', padding: '16px' }}>
          <h2 style={{ color: 'white', fontWeight: '600', fontSize: '18px', margin: '0' }}>LLC Financial Hub</h2>
        </div>
        
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px', marginBottom: '20px' }}>
            <span style={{ color: '#6b7280', fontSize: '14px' }}>Operator</span>
            <span style={{ color: '#1f2937', fontWeight: 'bold' }}>Camera Pho</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px', marginBottom: '20px' }}>
            <span style={{ color: '#6b7280', fontSize: '14px' }}>Supabase Status</span>
            <span style={{ color: '#059669', fontWeight: 'bold' }}>● Connected</span>
          </div>

          <div style={{ backgroundColor: '#eff6ff', borderRadius: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#1d4ed8', fontSize: '14px', fontWeight: '600' }}>Moreno Valley Sales Tax</span>
              <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontSize: '12px', padding: '4px 8px', borderRadius: '99px', fontWeight: 'bold' }}>
                8.75%
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
          <p style={{ fontSize: '10px', textAlign: 'center', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', margin: '0' }}>
            Secure LLC Management Portal
          </p>
        </div>
      </div>
    </div>
  )
}
