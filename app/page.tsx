'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse' // You may need to run: npm install papaparse

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('summary');
  const [ebaySales, setEbaySales] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    setUploadStatus('Processing...');
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        // eBay Sales Report logic
        let totalGross = 0;
        results.data.forEach(row => {
          // eBay uses "Gross amount" for the total sale value
          if (row['Gross amount']) {
            totalGross += parseFloat(row['Gross amount'].replace('$', '').replace(',', ''));
          }
        });
        
        setEbaySales(totalGross);
        setUploadStatus(`Success! Found $${totalGross.toFixed(2)} in eBay Sales.`);
      }
    });
  };

  return (
    <div style={{ fontFamily: 'Calibri, sans-serif', padding: '16px', backgroundColor: '#f4f7f6' }}>
      {/* Existing Header... */}
      
      {activeTab === 'imports' ? (
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '20px' }}>
          <h3 style={{ fontWeight: 'bold' }}>eBay Sales Report Import</h3>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload}
            style={{ marginBottom: '15px', display: 'block' }} 
          />
          
          {uploadStatus && (
            <div style={{ 
              padding: '12px', 
              borderRadius: '12px', 
              backgroundColor: uploadStatus.includes('Success') ? '#f0fdf4' : '#fef2f2',
              color: uploadStatus.includes('Success') ? '#166534' : '#991b1b',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              {uploadStatus}
            </div>
          )}
          
          <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>
              Current Session eBay Total: <span style={{ fontWeight: 'bold', color: '#2563eb' }}>${ebaySales.toFixed(2)}</span>
            </p>
          </div>
        </div>
      ) : (
        /* Summary View with your existing $0.00 rows... */
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '20px' }}>
           <p>eBay: ${ebaySales.toFixed(2)}</p>
        </div>
      )}
    </div>
  )
}
