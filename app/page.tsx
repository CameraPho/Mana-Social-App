'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const C = {
  navy: '#1B2A4A', navyDark: '#111D33', teal: '#2DBFB8',
  pink: '#E8407A', purple: '#6B3FA0', gold: '#F0C040',
  bg: '#F0F2F8', white: '#FFFFFF', muted: '#8A96B0',
  text: '#1B2A4A', border: 'rgba(27,42,74,0.12)',
}

const fmt = (n: number) => {
  if (n < 0) return '-$' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})
  return '$' + n.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})
}
const fmtK = (n: number) => {
  if (Math.abs(n) >= 1000) return (n < 0 ? '-$' : '$') + (Math.abs(n)/1000).toFixed(1) + 'k'
  return fmt(n)
}

const DEDUCTIBILITY: Record<string, {pct: number|null, label: string, line: string}> = {
  'Shipping & Postage':       {pct:100,  label:'100% deductible', line:'Sch C Line 27a'},
  'Platform Fees':            {pct:100,  label:'100% deductible', line:'Sch C Line 10'},
  'Software & Subscriptions': {pct:100,  label:'100% deductible', line:'Sch C Line 27a'},
  'Supplies & Packaging':     {pct:100,  label:'100% deductible', line:'Sch C Line 22'},
  'Advertising':              {pct:100,  label:'100% deductible', line:'Sch C Line 8'},
  'Professional Services':    {pct:100,  label:'100% deductible', line:'Sch C Line 17'},
  'Bank & Finance Charges':   {pct:100,  label:'100% deductible', line:'Sch C Line 27a'},
  'Taxes & Licenses':         {pct:100,  label:'100% deductible', line:'Sch C Line 23'},
  'Home Office':              {pct:null, label:'Partial — set % in settings', line:'Sch C Line 30'},
  'Other':                    {pct:null, label:'Needs review', line:'Sch C Line 27a'},
}
const EXPENSE_CATEGORIES = Object.keys(DEDUCTIBILITY)
const MILEAGE_RATE = 0.67
const getEntity = (date: string) => new Date(date) < new Date('2026-03-18') ? 'sole_prop' : 'llc'

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else onLogin()
    setLoading(false)
  }
  return (
    <div style={{minHeight:'100vh',background:`linear-gradient(135deg,${C.navyDark},${C.navy})`,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:'Calibri,sans-serif'}}>
      <div style={{background:C.white,borderRadius:'20px',padding:'40px 32px',width:'100%',maxWidth:'360px',boxShadow:'0 24px 64px rgba(0,0,0,0.3)',textAlign:'center'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'22px',color:C.navy,marginBottom:'28px',fontWeight:700}}>Mana Social</h1>
        <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'10px',textAlign:'left'}}>
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required
            style={{padding:'12px 14px',border:`1px solid ${C.border}`,borderRadius:'10px',fontSize:'14px',background:'#F5F6FA',width:'100%'}} />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required
            style={{padding:'12px 14px',border:`1px solid ${C.border}`,borderRadius:'10px',fontSize:'14px',background:'#F5F6FA',width:'100%'}} />
          {error && <div style={{padding:'8px 12px',background:'#FEE8EF',color:'#C0254A',borderRadius:'8px',fontSize:'13px'}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{marginTop:'8px',padding:'14px',background:`linear-gradient(135deg,${C.teal},#1A7A75)`,color:'#fff',border:'none',borderRadius:'10px',fontSize:'15px',fontWeight:'bold',cursor:'pointer'}}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{marginTop:'24px',fontSize:'11px',color:'#C0C8D8',letterSpacing:'0.1em',textTransform:'uppercase'}}>Culture · Community · Games</p>
      </div>
    </div>
  )
}

export default function ManaSocialApp() {
  const [authed, setAuthed] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedYear, setSelectedYear] = useState(2026)
  const [selectedMonth, setSelectedMonth] = useState(0)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<{table:string}|null>(null)
  const [homeOfficePct, setHomeOfficePct] = useState(10)
  const [showSettings, setShowSettings] = useState(false)

  const [formData, setFormData] = useState({
    label:'', amount:'', date: new Date().toISOString().split('T')[0],
    fees:'', shipping:'', notes:'', itemCount:'', category:'Other',
    miles:'', mileFrom:'', mileTo:'', milePurpose:'',
    cogsType:'collection', cogsSet:'', cogsCost:'', cogsQty:'1',
    cogsCards:'', cogsCardsPerBox:'', cogsEstValue:'',
    amountPaid:'',
  })

  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [buyouts, setBuyouts] = useState<any[]>([])
  const [payroll, setPayroll] = useState<any[]>([])
  const [disbursements, setDisbursements] = useState<any[]>([])
  const [mileageLog, setMileageLog] = useState<any[]>([])
  const [cogsInventory, setCogsInventory] = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session); setCheckingAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session))
    return () => subscription.unsubscribe()
  }, [])

  const fetchData = useCallback(async () => {
    if (!authed) return
    const [s, e, b, p, d, ml, ci] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('buyouts').select('*'),
      supabase.from('payroll').select('*'),
      supabase.from('disbursements').select('*'),
      supabase.from('mileage_log').select('*').order('date', {ascending:false}),
      supabase.from('cogs_inventory').select('*').order('date', {ascending:false}),
    ])
    const fd = (data: any[], key: string) => (data||[]).filter(i => {
      const d = new Date(i[key])
      return d.getFullYear()===selectedYear && (selectedMonth===0||(d.getMonth()+1)===selectedMonth)
    })
    setSales(fd(s.data||[],'sale_date'))
    setExpenses(fd(e.data||[],'purchase_date'))
    setBuyouts(fd(b.data||[],'due_date'))
    setPayroll(fd(p.data||[],'pay_date'))
    setDisbursements(fd(d.data||[],'disbursement_date'))
    setMileageLog(ml.data||[])
    setCogsInventory(ci.data||[])
  }, [authed, selectedYear, selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  const totalMiles = mileageLog.reduce((a,r) => a+parseFloat(r.miles||0), 0)
  const mileageDeduction = totalMiles * MILEAGE_RATE

  const resetForm = () => setFormData({
    label:'', amount:'', date: new Date().toISOString().split('T')[0],
    fees:'', shipping:'', notes:'', itemCount:'', category:'Other',
    miles:'', mileFrom:'', mileTo:'', milePurpose:'',
    cogsType:'collection', cogsSet:'', cogsCost:'', cogsQty:'1',
    cogsCards:'', cogsCardsPerBox:'', cogsEstValue:'', amountPaid:'',
  })

  const handleSave = async () => {
    const t = editingItem?.table
    if (!t) return
    let payload: any = {}
    if (t==='sales') {
      if (!formData.amount||!formData.label) return alert('Missing fields')
      payload = { platform:formData.label, amount:Number(formData.amount), fees:Number(formData.fees||0), shipping:Number(formData.shipping||0), sale_date:formData.date, entity:getEntity(formData.date) }
    } else if (t==='buyouts') {
      if (!formData.amount||!formData.label) return alert('Missing fields')
      payload = { seller_name:formData.label, total_cost:Number(formData.amount), amount_paid:Number(formData.amountPaid||0), notes:`Qty: ${formData.itemCount} | ${formData.notes}`, due_date:formData.date, entity:getEntity(formData.date) }
    } else if (t==='expenses') {
      if (!formData.amount) return alert('Missing amount')
      payload = { category:formData.category, cost:Number(formData.amount), purchase_date:formData.date, notes:formData.label, entity:getEntity(formData.date) }
    } else if (t==='payroll') {
      if (!formData.amount||!formData.label) return alert('Missing fields')
      payload = { employee_name:formData.label, amount:Number(formData.amount), pay_date:formData.date }
    } else if (t==='disbursements') {
      if (!formData.amount||!formData.label) return alert('Missing fields')
      payload = { recipient:formData.label, amount:Number(formData.amount), notes:formData.notes, disbursement_date:formData.date }
    } else if (t==='mileage_log') {
      if (!formData.miles||!formData.milePurpose) return alert('Missing fields')
      payload = { date:formData.date, purpose:formData.milePurpose, from_location:formData.mileFrom, to_location:formData.mileTo, miles:parseFloat(formData.miles)||0 }
    } else if (t==='cogs_inventory') {
      if (!formData.cogsCost||!formData.label) return alert('Missing fields')
      const cost=parseFloat(formData.cogsCost)||0, qty=parseInt(formData.cogsQty)||1, totalCost=cost*qty
      let totalUnits = formData.cogsType==='collection' ? parseInt(formData.cogsCards)||0 : ['booster_box','precon'].includes(formData.cogsType) ? (parseInt(formData.cogsCardsPerBox)||0)*qty : qty
      payload = { date:formData.date, inventory_type:formData.cogsType, description:formData.label, set_name:formData.cogsSet||null, purchase_price:cost, quantity:qty, card_count:parseInt(formData.cogsCards)||0, cards_per_box:parseInt(formData.cogsCardsPerBox)||0, total_cost:totalCost, cost_per_unit:totalUnits>0?totalCost/totalUnits:0, total_units:totalUnits, sold_units:0, est_sell_value:parseFloat(formData.cogsEstValue)||0, entity:getEntity(formData.date) }
    }
    const { error } = await supabase.from(t).insert([payload])
    if (error) return alert(error.message)
    setEditingItem(null); resetForm(); fetchData()
  }

  const handleUpdatePaid = async (id: string, amount_paid: number) => {
    await supabase.from('buyouts').update({ amount_paid }).eq('id', id)
    fetchData()
  }

  const handleUpdateSold = async (id: string, sold_units: number) => {
    await supabase.from('cogs_inventory').update({ sold_units }).eq('id', id)
    fetchData()
  }

  const handleDelete = async (table: string, id: string) => {
    if (!confirm('Delete this entry?')) return
    await supabase.from(table).delete().eq('id', id)
    fetchData()
  }

  const signOut = async () => { await supabase.auth.signOut() }

  // Calculations
  const gross = sales.reduce((s,r)=>s+Number(r.amount),0)
  const totalFees = sales.reduce((s,r)=>s+Number(r.fees||0)+Number(r.shipping||0),0)
  const opExpenses = expenses.reduce((s,r)=>s+Number(r.cost),0)
  const inventoryCosts = buyouts.reduce((s,r)=>s+Number(r.total_cost),0)
  const totalPaid = buyouts.reduce((s,r)=>s+Number(r.amount_paid||0),0)
  const totalOwed = inventoryCosts - totalPaid
  const staffingCosts = payroll.reduce((s,r)=>s+Number(r.amount),0)
  const totalCosts = totalFees + opExpenses + inventoryCosts + staffingCosts
  const netRevenue = gross - totalCosts
  const cogsRecognized = cogsInventory.reduce((a,r)=>{
    const ratio = r.total_units>0?Math.min((r.sold_units||0)/r.total_units,1):0
    return a+(parseFloat(r.total_cost||0)*ratio)
  },0)
  const totalDeductibleExpenses = expenses.reduce((a,r)=>{
    const rule = DEDUCTIBILITY[r.category]||DEDUCTIBILITY['Other']
    if (rule.pct===100) return a+Number(r.cost)
    if (r.category==='Home Office') return a+Number(r.cost)*(homeOfficePct/100)
    return a
  },0)
  const totalDeductions = totalDeductibleExpenses + mileageDeduction
  const fedSavings = totalDeductions * 0.22
  const caSavings = totalDeductions * 0.093
  const quarters = [
    {label:'Q1',start:'2026-01-01',end:'2026-03-31',due941:'Apr 30',due1040:'Apr 15'},
    {label:'Q2',start:'2026-04-01',end:'2026-06-30',due941:'Jul 31',due1040:'Jun 16'},
    {label:'Q3',start:'2026-07-01',end:'2026-09-30',due941:'Oct 31',due1040:'Sep 15'},
    {label:'Q4',start:'2026-10-01',end:'2026-12-31',due941:'Jan 31',due1040:'Jan 15'},
  ].map(q=>{
    const inQ=(arr:any[],key:string)=>arr.filter(r=>r[key]>=q.start&&r[key]<=q.end)
    const qS=inQ(sales,'sale_date'),qE=inQ(expenses,'purchase_date'),qP=inQ(payroll,'pay_date')
    const netRev=qS.reduce((a,r)=>a+Number(r.amount),0)-qS.reduce((a,r)=>a+Number(r.fees||0)+Number(r.shipping||0),0)
    const exp=qE.reduce((a,r)=>a+Number(r.cost),0)
    const grossPay=qP.reduce((a,r)=>a+Number(r.amount),0)
    const taxable=Math.max(0,netRev-exp-grossPay)
    const fica=grossPay*0.153,futa=grossPay*0.006,caUI=grossPay*0.034
    const fedEst=taxable*0.22,caEst=taxable*0.093
    return {...q,netRev,exp,grossPay,taxable,fica,futa,caUI,fedEst,caEst,grand:fica+futa+caUI+fedEst+caEst}
  })
  const ytdTax = quarters.reduce((a,q)=>a+q.grand,0)

  const card: React.CSSProperties = {background:C.white,borderRadius:'16px',padding:'20px',border:`1px solid ${C.border}`,marginBottom:'12px'}
  const inp: React.CSSProperties = {padding:'13px 14px',borderRadius:'10px',border:`1px solid ${C.border}`,fontSize:'14px',width:'100%',background:'#F5F6FA',boxSizing:'border-box'}
  const lbl: React.CSSProperties = {fontSize:'11px',fontWeight:'bold',color:C.muted,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:'4px',display:'block'}

  const renderForm = () => {
    if (!editingItem) return null
    const t = editingItem.table
    const cogsPreview = () => {
      const cost=parseFloat(formData.cogsCost)||0,qty=parseInt(formData.cogsQty)||1,total=cost*qty
      const units = formData.cogsType==='collection'?parseInt(formData.cogsCards)||0:['booster_box','precon'].includes(formData.cogsType)?(parseInt(formData.cogsCardsPerBox)||0)*qty:qty
      return {total,units,cpu:units>0?total/units:0}
    }
    return (
      <div style={{...card,border:`1px solid ${C.teal}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
          <h2 style={{fontWeight:900,color:C.navy,fontSize:'16px'}}>ADD {t.replace(/_/g,' ').toUpperCase()}</h2>
          <button onClick={()=>{setEditingItem(null);resetForm()}} style={{background:'none',border:'none',color:C.muted,fontSize:'24px',cursor:'pointer'}}>×</button>
        </div>
        <div style={{display:'grid',gap:'10px'}}>
          <div><span style={lbl}>Date</span><input type="date" value={formData.date} onChange={e=>setFormData({...formData,date:e.target.value})} style={inp} /></div>
          <div style={{padding:'8px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:'bold',background:getEntity(formData.date)==='sole_prop'?'rgba(240,192,64,0.12)':'rgba(45,191,184,0.1)',color:getEntity(formData.date)==='sole_prop'?'#7A5A00':'#1A7A75'}}>
            {getEntity(formData.date)==='sole_prop'?'Camera Pho (Sole Prop)':'Mana Social LLC'}
          </div>

          {t==='mileage_log'&&<>
            <div><span style={lbl}>Business Purpose</span><input value={formData.milePurpose} onChange={e=>setFormData({...formData,milePurpose:e.target.value})} placeholder="e.g. USPS drop-off, card show" style={inp} /></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              <div><span style={lbl}>From</span><input value={formData.mileFrom} onChange={e=>setFormData({...formData,mileFrom:e.target.value})} placeholder="Home" style={inp} /></div>
              <div><span style={lbl}>To</span><input value={formData.mileTo} onChange={e=>setFormData({...formData,mileTo:e.target.value})} placeholder="USPS Moreno Valley" style={inp} /></div>
            </div>
            <div><span style={lbl}>Miles</span><input type="number" step="0.1" value={formData.miles} onChange={e=>setFormData({...formData,miles:e.target.value})} placeholder="0.0" style={inp} /></div>
            {formData.miles&&<div style={{padding:'10px',borderRadius:'8px',background:'rgba(45,191,184,0.08)',fontSize:'13px',color:'#1A7A75'}}>Deduction: <strong>{fmt(parseFloat(formData.miles)*MILEAGE_RATE)}</strong></div>}
          </>}

          {t==='cogs_inventory'&&<>
            <div><span style={lbl}>Inventory Type</span>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'6px'}}>
                {[['collection','Collection'],['booster_box','Box'],['precon','Precon'],['sealed','Sealed'],['singles','Singles']].map(([id,l])=>(
                  <button key={id} onClick={()=>setFormData({...formData,cogsType:id})} style={{padding:'8px',borderRadius:'8px',border:`1px solid ${formData.cogsType===id?C.teal:C.border}`,background:formData.cogsType===id?'rgba(45,191,184,0.1)':'#F5F6FA',fontSize:'11px',fontWeight:formData.cogsType===id?'bold':'normal',cursor:'pointer',color:formData.cogsType===id?'#1A7A75':C.text}}>{l}</button>
                ))}
              </div>
            </div>
            <div><span style={lbl}>Description</span><input value={formData.label} onChange={e=>setFormData({...formData,label:e.target.value})} placeholder="e.g. Renly's collection" style={inp} /></div>
            <div><span style={lbl}>Set / Product</span><input value={formData.cogsSet} onChange={e=>setFormData({...formData,cogsSet:e.target.value})} placeholder="e.g. Edge of Eternities" style={inp} /></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              <div><span style={lbl}>Purchase Price ($)</span><input type="number" step="0.01" value={formData.cogsCost} onChange={e=>setFormData({...formData,cogsCost:e.target.value})} placeholder="0.00" style={inp} /></div>
              <div><span style={lbl}>Quantity</span><input type="number" value={formData.cogsQty} onChange={e=>setFormData({...formData,cogsQty:e.target.value})} placeholder="1" style={inp} /></div>
            </div>
            {formData.cogsType==='collection'&&<div><span style={lbl}>Total Card Count</span><input type="number" value={formData.cogsCards} onChange={e=>setFormData({...formData,cogsCards:e.target.value})} placeholder="e.g. 200" style={inp} /></div>}
            {['booster_box','precon'].includes(formData.cogsType)&&<div><span style={lbl}>Cards Per Unit</span>
              <select value={formData.cogsCardsPerBox} onChange={e=>setFormData({...formData,cogsCardsPerBox:e.target.value})} style={inp}>
                <option value="">Select...</option>
                <option value="540">MTG Draft Box (540)</option>
                <option value="360">MTG Set/Play Box (360)</option>
                <option value="150">MTG Collector Box (150)</option>
                <option value="100">MTG Commander Precon (100)</option>
                <option value="360">Pokemon Box (360)</option>
                <option value="60">Pokemon Starter (60)</option>
                <option value="240">YGO Box (240)</option>
              </select>
            </div>}
            <div><span style={lbl}>Est. Sell Value ($)</span><input type="number" step="0.01" value={formData.cogsEstValue} onChange={e=>setFormData({...formData,cogsEstValue:e.target.value})} placeholder="0.00" style={inp} /></div>
            {formData.cogsCost&&(()=>{const p=cogsPreview();return(
              <div style={{padding:'10px',borderRadius:'8px',background:'rgba(45,191,184,0.08)',fontSize:'13px',color:'#1A7A75',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                <span>Total: <strong>{fmt(p.total)}</strong></span>
                <span>Units: <strong>{p.units.toLocaleString()}</strong></span>
                <span>Per unit: <strong>${p.cpu.toFixed(3)}</strong></span>
                {formData.cogsEstValue&&<span>Margin: <strong>{p.total>0?(((parseFloat(formData.cogsEstValue)-p.total)/p.total)*100).toFixed(1)+'%':'—'}</strong></span>}
              </div>
            )})()}
          </>}

          {!['mileage_log','cogs_inventory'].includes(t)&&<>
            {t==='expenses'?<>
              <div><span style={lbl}>Category</span>
                <select value={formData.category} onChange={e=>setFormData({...formData,category:e.target.value})} style={inp}>
                  {EXPENSE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><span style={lbl}>Description</span><input value={formData.label} onChange={e=>setFormData({...formData,label:e.target.value})} placeholder="What was purchased" style={inp} /></div>
            </>:<div><span style={lbl}>{t==='sales'?'Platform':t==='buyouts'?'Seller Name':t==='payroll'?'Employee':'Recipient'}</span><input value={formData.label} onChange={e=>setFormData({...formData,label:e.target.value})} placeholder="..." style={inp} /></div>}
            <div><span style={lbl}>Amount ($)</span><input type="number" step="0.01" value={formData.amount} onChange={e=>setFormData({...formData,amount:e.target.value})} placeholder="0.00" style={inp} /></div>
            {t==='buyouts'&&<div><span style={lbl}>Amount Paid So Far ($)</span><input type="number" step="0.01" value={formData.amountPaid} onChange={e=>setFormData({...formData,amountPaid:e.target.value})} placeholder="0.00" style={inp} /></div>}
            {t==='sales'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              <div><span style={lbl}>Fees ($)</span><input type="number" step="0.01" value={formData.fees} onChange={e=>setFormData({...formData,fees:e.target.value})} placeholder="0.00" style={inp} /></div>
              <div><span style={lbl}>Shipping Cost ($)</span><input type="number" step="0.01" value={formData.shipping} onChange={e=>setFormData({...formData,shipping:e.target.value})} placeholder="0.00" style={inp} /></div>
            </div>}
            {t==='buyouts'&&<div><span style={lbl}>Card Count</span><input type="number" value={formData.itemCount} onChange={e=>setFormData({...formData,itemCount:e.target.value})} placeholder="# of cards" style={inp} /></div>}
            {['buyouts','disbursements'].includes(t)&&<div><span style={lbl}>Notes</span><textarea value={formData.notes} onChange={e=>setFormData({...formData,notes:e.target.value})} placeholder="Internal notes" style={{...inp,height:'70px',resize:'vertical'}} /></div>}
          </>}

          <button onClick={handleSave} style={{background:`linear-gradient(135deg,${C.teal},#1A7A75)`,color:'#fff',padding:'16px',borderRadius:'12px',fontWeight:900,border:'none',fontSize:'15px',cursor:'pointer',marginTop:'4px'}}>SAVE RECORD</button>
        </div>
      </div>
    )
  }

  const renderTab = () => {
    switch(activeTab) {
      case 'summary': return (
        <div>
          <div style={{background:`linear-gradient(135deg,${C.navyDark},${C.navy})`,color:'#fff',padding:'28px',borderRadius:'20px',marginBottom:'12px'}}>
            <div style={{opacity:0.6,fontSize:'10px',fontWeight:'bold',letterSpacing:'1px',marginBottom:'4px'}}>GROSS REVENUE</div>
            <div style={{fontSize:'30px',fontWeight:900,marginBottom:'16px'}}>{fmtK(gross)}</div>
            <div style={{height:'1px',background:'rgba(255,255,255,0.1)',marginBottom:'16px'}} />
            <div style={{opacity:0.6,fontSize:'10px',fontWeight:'bold',letterSpacing:'1px',marginBottom:'4px'}}>TOTAL COSTS</div>
            <div style={{fontSize:'30px',fontWeight:900,color:'#fda4af',marginBottom:'16px'}}>{fmtK(-totalCosts)}</div>
            <div style={{height:'1px',background:'rgba(255,255,255,0.1)',marginBottom:'16px'}} />
            <div style={{opacity:0.6,fontSize:'10px',fontWeight:'bold',letterSpacing:'1px',marginBottom:'4px'}}>NET REVENUE</div>
            <div style={{fontSize:'44px',fontWeight:900,color:netRevenue>=0?'#4ade80':'#fda4af'}}>{fmtK(netRevenue)}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
            {[['Platform Fees',fmt(-totalFees)],['Op. Expenses',fmt(-opExpenses)],['Inventory COGS',fmt(-inventoryCosts)],['Payroll',fmt(-staffingCosts)]].map(([l,v])=>(
              <div key={String(l)} style={{...card,padding:'14px',marginBottom:0}}>
                <div style={{fontSize:'10px',color:C.muted,fontWeight:'bold',letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:'4px'}}>{l}</div>
                <div style={{fontSize:'18px',fontWeight:700,color:'#fda4af'}}>{v}</div>
              </div>
            ))}
          </div>
          {totalOwed > 0 && (
            <div style={{...card,background:'rgba(240,192,64,0.08)',border:'1px solid rgba(240,192,64,0.3)'}}>
              <div style={{fontSize:'10px',color:'#7A5A00',fontWeight:'bold',letterSpacing:'0.05em',marginBottom:'8px'}}>OUTSTANDING BUYOUT BALANCE</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px'}}>
                <div><div style={{fontSize:'11px',color:C.muted}}>Total owed</div><div style={{fontSize:'18px',fontWeight:700,color:C.text}}>{fmt(inventoryCosts)}</div></div>
                <div><div style={{fontSize:'11px',color:C.muted}}>Paid</div><div style={{fontSize:'18px',fontWeight:700,color:C.teal}}>{fmt(totalPaid)}</div></div>
                <div><div style={{fontSize:'11px',color:C.muted}}>Remaining</div><div style={{fontSize:'18px',fontWeight:700,color:C.pink}}>{fmt(totalOwed)}</div></div>
              </div>
            </div>
          )}
          <div style={{...card,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontSize:'10px',color:C.muted,fontWeight:'bold',marginBottom:'4px'}}>SOLE PROP</div><div style={{fontSize:'13px',fontWeight:700,color:C.gold}}>Jan 1 – Mar 17</div></div>
            <div style={{color:C.border,fontSize:'20px'}}>→</div>
            <div style={{textAlign:'right'}}><div style={{fontSize:'10px',color:C.muted,fontWeight:'bold',marginBottom:'4px'}}>MANA SOCIAL LLC</div><div style={{fontSize:'13px',fontWeight:700,color:C.teal}}>Mar 18 – Dec 31</div></div>
          </div>
          {cogsInventory.length>0&&(
            <div style={card}>
              <div style={{fontSize:'10px',color:C.muted,fontWeight:'bold',letterSpacing:'0.05em',marginBottom:'10px'}}>COGS TRACKER</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                <div><div style={{fontSize:'11px',color:C.muted}}>Total purchased</div><div style={{fontSize:'18px',fontWeight:700}}>{fmt(cogsInventory.reduce((a,r)=>a+parseFloat(r.total_cost||0),0))}</div></div>
                <div><div style={{fontSize:'11px',color:C.muted}}>COGS recognized</div><div style={{fontSize:'18px',fontWeight:700,color:C.pink}}>{fmt(cogsRecognized)}</div></div>
              </div>
            </div>
          )}
        </div>
      )

      case 'income': return (
        <div>
          <div style={{...card,background:C.navyDark,color:'#fff',padding:'16px 20px'}}>
            <div style={{fontSize:'10px',opacity:0.6,fontWeight:'bold',letterSpacing:'1px'}}>NET SALES</div>
            <div style={{fontSize:'28px',fontWeight:900,color:'#4ade80'}}>{fmt(gross-totalFees)}</div>
            <div style={{fontSize:'12px',opacity:0.5,marginTop:'2px'}}>Gross {fmt(gross)} · Fees {fmt(-totalFees)}</div>
          </div>
          {sales.map(s=>(
            <div key={s.id} style={{...card,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontWeight:700,marginBottom:'2px'}}>{s.platform}</div>
                <div style={{fontSize:'12px',color:C.muted}}>{s.sale_date} · Fees {fmt(Number(s.fees||0)+Number(s.shipping||0))}</div>
                <div style={{fontSize:'11px',color:s.entity==='llc'?C.teal:C.gold,marginTop:'2px'}}>{s.entity==='llc'?'LLC':'Sole Prop'}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontWeight:700,color:'#10b981',fontSize:'16px'}}>{fmt(Number(s.amount))}</span>
                <button onClick={()=>handleDelete('sales',s.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'18px'}}>×</button>
              </div>
            </div>
          ))}
          {sales.length===0&&<div style={{textAlign:'center',padding:'40px',color:C.muted}}>No sales this period</div>}
        </div>
      )

      case 'expense': return (
        <div>
          <div style={{...card,background:C.navyDark,color:'#fff',padding:'16px 20px'}}>
            <div style={{fontSize:'10px',opacity:0.6,fontWeight:'bold',letterSpacing:'1px'}}>TOTAL EXPENSES</div>
            <div style={{fontSize:'28px',fontWeight:900,color:'#fda4af'}}>{fmt(opExpenses+inventoryCosts)}</div>
          </div>
          {totalOwed>0&&(
            <div style={{...card,background:'rgba(240,192,64,0.08)',border:'1px solid rgba(240,192,64,0.3)',padding:'14px 16px'}}>
              <div style={{fontSize:'11px',color:'#7A5A00',fontWeight:'bold',marginBottom:'8px'}}>BUYOUT PAYMENT TRACKER</div>
              {buyouts.map(b=>{
                const paid = Number(b.amount_paid||0)
                const owed = Number(b.total_cost) - paid
                const pct = Number(b.total_cost)>0?(paid/Number(b.total_cost)*100):0
                return (
                  <div key={b.id} style={{marginBottom:'12px',paddingBottom:'12px',borderBottom:`1px solid rgba(240,192,64,0.2)`}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                      <span style={{fontWeight:700,fontSize:'14px'}}>{b.seller_name}</span>
                      <span style={{fontSize:'13px',color:owed>0?C.pink:C.teal,fontWeight:700}}>{owed>0?`${fmt(owed)} left`:'Paid off'}</span>
                    </div>
                    <div style={{height:'6px',background:'rgba(27,42,74,0.1)',borderRadius:'3px',marginBottom:'6px'}}>
                      <div style={{height:'100%',width:`${Math.min(pct,100)}%`,background:pct>=100?C.teal:C.gold,borderRadius:'3px',transition:'width 0.3s'}} />
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',color:C.muted}}>
                      <span>Paid: {fmt(paid)}</span>
                      <span>Total: {fmt(Number(b.total_cost))}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'8px'}}>
                      <span style={{fontSize:'12px',color:C.muted}}>Update paid:</span>
                      <input type="number" step="0.01" min="0" max={b.total_cost} value={paid}
                        onChange={e=>handleUpdatePaid(b.id,parseFloat(e.target.value)||0)}
                        style={{...inp,width:'100px',padding:'4px 8px',fontSize:'13px'}} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {expenses.map(e=>(
            <div key={e.id} style={{...card,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontWeight:700,marginBottom:'2px'}}>{e.category}</div>
                {e.notes&&<div style={{fontSize:'12px',color:C.muted}}>{e.notes}</div>}
                <div style={{fontSize:'12px',color:C.muted}}>{e.purchase_date}</div>
                {DEDUCTIBILITY[e.category]&&(
                  <div style={{fontSize:'11px',marginTop:'3px',padding:'2px 6px',borderRadius:'4px',display:'inline-block',background:DEDUCTIBILITY[e.category].pct===100?'#E1F5EE':'#FEF3E2',color:DEDUCTIBILITY[e.category].pct===100?'#085041':'#7A5A00'}}>
                    {DEDUCTIBILITY[e.category].label} · {DEDUCTIBILITY[e.category].line}
                  </div>
                )}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontWeight:700,color:'#ef4444',fontSize:'16px'}}>{fmt(-Number(e.cost))}</span>
                <button onClick={()=>handleDelete('expenses',e.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'18px'}}>×</button>
              </div>
            </div>
          ))}
          {buyouts.map(b=>(
            <div key={b.id} style={{...card,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontWeight:700,marginBottom:'2px'}}>{b.seller_name} <span style={{fontSize:'12px',color:C.muted}}>(Buyout)</span></div>
                {b.notes&&<div style={{fontSize:'12px',color:C.muted}}>{b.notes}</div>}
                <div style={{fontSize:'12px',color:C.muted}}>{b.due_date}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontWeight:700,color:'#ef4444',fontSize:'16px'}}>{fmt(-Number(b.total_cost))}</span>
                <button onClick={()=>handleDelete('buyouts',b.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'18px'}}>×</button>
              </div>
            </div>
          ))}
          {expenses.length===0&&buyouts.length===0&&<div style={{textAlign:'center',padding:'40px',color:C.muted}}>No expenses this period</div>}
        </div>
      )

      case 'cogs': return (
        <div>
          <div style={{...card,background:C.navyDark,color:'#fff',padding:'16px 20px'}}>
            <div style={{fontSize:'10px',opacity:0.6,fontWeight:'bold',letterSpacing:'1px'}}>INVENTORY PURCHASED</div>
            <div style={{fontSize:'28px',fontWeight:900}}>{fmt(cogsInventory.reduce((a,r)=>a+parseFloat(r.total_cost||0),0))}</div>
            <div style={{fontSize:'13px',color:'#fda4af',marginTop:'4px'}}>COGS recognized: {fmt(cogsRecognized)}</div>
          </div>
          {(()=>{
            const ci=cogsInventory.filter(r=>['collection','booster_box','precon','singles'].includes(r.inventory_type))
            const tC=ci.reduce((a,r)=>a+parseFloat(r.total_cost||0),0)
            const tU=ci.reduce((a,r)=>a+parseInt(r.total_units||0),0)
            return tU>0?(
              <div style={{...card,textAlign:'center',padding:'14px'}}>
                <div style={{fontSize:'11px',color:C.muted,marginBottom:'4px'}}>BLENDED AVG COST / CARD</div>
                <div style={{fontSize:'28px',fontWeight:900,color:C.purple}}>${(tC/tU).toFixed(3)}</div>
                <div style={{fontSize:'12px',color:C.muted}}>{tU.toLocaleString()} cards · {fmt(tC)}</div>
              </div>
            ):null
          })()}
          {cogsInventory.map(r=>{
            const sold=r.sold_units||0,ratio=r.total_units>0?Math.min(sold/r.total_units,1):0,recog=parseFloat(r.total_cost||0)*ratio
            return(
              <div key={r.id} style={card}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
                  <div><div style={{fontWeight:700}}>{r.description}</div>{r.set_name&&<div style={{fontSize:'12px',color:C.muted}}>{r.set_name}</div>}<div style={{fontSize:'11px',color:C.muted}}>{r.date} · {r.inventory_type}</div></div>
                  <div style={{textAlign:'right'}}><div style={{fontWeight:700,color:C.pink}}>{fmt(parseFloat(r.total_cost||0))}</div><div style={{fontSize:'11px',color:C.muted}}>${parseFloat(r.cost_per_unit||0).toFixed(3)}/unit</div></div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                  <span style={{fontSize:'12px',color:C.muted}}>Sold:</span>
                  <input type="number" min="0" max={r.total_units} value={sold} onChange={e=>handleUpdateSold(r.id,parseInt(e.target.value)||0)} style={{...inp,width:'80px',padding:'4px 8px',fontSize:'13px',textAlign:'center'}} />
                  <span style={{fontSize:'12px',color:C.muted}}>/ {r.total_units?.toLocaleString()}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px'}}>
                  <span style={{color:C.pink}}>Recognized: {fmt(recog)}</span>
                  <span style={{color:C.gold}}>Remaining: {fmt(parseFloat(r.total_cost||0)-recog)}</span>
                </div>
                <button onClick={()=>handleDelete('cogs_inventory',r.id)} style={{marginTop:'8px',background:'none',border:`1px solid ${C.border}`,borderRadius:'6px',padding:'4px 10px',fontSize:'11px',color:C.muted,cursor:'pointer'}}>Delete</button>
              </div>
            )
          })}
          {cogsInventory.length===0&&<div style={{textAlign:'center',padding:'40px',color:C.muted}}>No inventory entries yet</div>}
        </div>
      )

      case 'deductions': return (
        <div>
          <button onClick={()=>setShowSettings(!showSettings)} style={{...card,width:'100%',textAlign:'left',cursor:'pointer',display:'flex',justifyContent:'space-between',padding:'14px 16px',marginBottom:'10px',border:`1px solid ${C.border}`}}>
            <span style={{fontWeight:700,color:C.navy}}>Settings</span>
            <span style={{color:C.muted}}>{showSettings?'▲':'▼'}</span>
          </button>
          {showSettings&&(
            <div style={{...card,borderColor:C.teal}}>
              <div style={{marginBottom:'12px'}}>
                <span style={lbl}>Home Office % (your sq ft / total home sq ft)</span>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <input type="number" min="0" max="100" step="0.1" value={homeOfficePct} onChange={e=>setHomeOfficePct(parseFloat(e.target.value)||0)} style={{...inp,width:'80px'}} />
                  <span style={{color:C.muted,fontSize:'13px'}}>% — e.g. 150/1500 sqft = 10%</span>
                </div>
              </div>
              <div style={{fontSize:'13px',color:C.text}}>Mileage: {MILEAGE_RATE*100}c/mile · {totalMiles.toFixed(1)} miles · <strong style={{color:C.teal}}>{fmt(mileageDeduction)}</strong> deduction</div>
            </div>
          )}
          <div style={{...card,background:C.navyDark,color:'#fff',padding:'20px'}}>
            <div style={{fontSize:'10px',opacity:0.6,fontWeight:'bold',letterSpacing:'1px',marginBottom:'4px'}}>TOTAL DEDUCTIONS</div>
            <div style={{fontSize:'32px',fontWeight:900,color:C.teal}}>{fmtK(totalDeductions)}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'14px'}}>
              <div><div style={{fontSize:'10px',opacity:0.6}}>EST FED SAVINGS</div><div style={{fontSize:'18px',fontWeight:700,color:'#a78bfa'}}>{fmt(fedSavings)}</div></div>
              <div><div style={{fontSize:'10px',opacity:0.6}}>EST CA SAVINGS</div><div style={{fontSize:'18px',fontWeight:700,color:'#a78bfa'}}>{fmt(caSavings)}</div></div>
            </div>
          </div>
          <div style={card}>
            <div style={{fontSize:'11px',color:C.muted,fontWeight:'bold',letterSpacing:'0.05em',marginBottom:'10px'}}>EXPENSE DEDUCTIBILITY</div>
            {expenses.map(e=>{
              const rule=DEDUCTIBILITY[e.category]||DEDUCTIBILITY['Other']
              const amt=Number(e.cost),ded=rule.pct===100?amt:e.category==='Home Office'?amt*(homeOfficePct/100):0
              return(
                <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:500}}>{e.category}</div>
                    {e.notes&&<div style={{fontSize:'11px',color:C.muted}}>{e.notes}</div>}
                    <div style={{fontSize:'11px',padding:'2px 6px',borderRadius:'4px',display:'inline-block',marginTop:'2px',background:rule.pct===100?'#E1F5EE':rule.pct===null&&e.category==='Home Office'?'#FEF3E2':'#FEE8EF',color:rule.pct===100?'#085041':rule.pct===null&&e.category==='Home Office'?'#7A5A00':'#9B2A50'}}>{rule.label}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0,marginLeft:'12px'}}>
                    <div style={{fontSize:'13px',fontWeight:700,color:C.teal}}>{fmt(ded)}</div>
                    <div style={{fontSize:'11px',color:C.muted}}>saves {fmt(ded*0.313)}</div>
                  </div>
                </div>
              )
            })}
            {expenses.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.muted,fontSize:'13px'}}>No expenses logged yet</div>}
          </div>
          <div style={card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
              <div style={{fontSize:'11px',color:C.muted,fontWeight:'bold',letterSpacing:'0.05em'}}>MILEAGE LOG</div>
              <button onClick={()=>setEditingItem({table:'mileage_log'})} style={{background:`linear-gradient(135deg,${C.teal},#1A7A75)`,color:'#fff',border:'none',borderRadius:'8px',padding:'6px 12px',fontSize:'12px',fontWeight:'bold',cursor:'pointer'}}>+ Trip</button>
            </div>
            {mileageLog.map(r=>(
              <div key={r.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:500}}>{r.purpose}</div>
                  <div style={{fontSize:'11px',color:C.muted}}>{r.date} · {r.from_location} → {r.to_location}</div>
                  <div style={{fontSize:'11px',color:C.teal}}>{parseFloat(r.miles).toFixed(1)} mi · {fmt(parseFloat(r.miles)*MILEAGE_RATE)}</div>
                </div>
                <button onClick={()=>handleDelete('mileage_log',r.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'18px'}}>×</button>
              </div>
            ))}
            {mileageLog.length===0&&<div style={{textAlign:'center',padding:'20px',color:C.muted,fontSize:'13px'}}>No trips logged yet</div>}
            {mileageLog.length>0&&(
              <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:'13px',fontWeight:700}}>
                <span>{totalMiles.toFixed(1)} total miles</span>
                <span style={{color:C.teal}}>{fmt(mileageDeduction)} deduction</span>
              </div>
            )}
          </div>
        </div>
      )

      case 'tax': return (
        <div>
          <div style={{padding:'12px 14px',borderRadius:'10px',background:'rgba(240,192,64,0.1)',border:'1px solid rgba(240,192,64,0.3)',marginBottom:'12px',fontSize:'12px',color:'#7A5A00'}}>
            Estimates only — 22% federal, 9.3% CA. Confirm with Kannie before paying.
          </div>
          <div style={{...card,background:C.navyDark,color:'#fff',padding:'20px',marginBottom:'12px'}}>
            <div style={{fontSize:'10px',opacity:0.6,fontWeight:'bold',letterSpacing:'1px',marginBottom:'4px'}}>YTD EST. TOTAL TAX</div>
            <div style={{fontSize:'36px',fontWeight:900,color:'#fda4af'}}>{fmtK(ytdTax)}</div>
          </div>
          {quarters.map(q=>(
            <div key={q.label} style={card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                <div><div style={{fontWeight:900,fontSize:'16px',color:C.navy}}>{q.label} 2026</div><div style={{fontSize:'11px',color:C.muted}}>{q.start} – {q.end}</div></div>
                <div style={{textAlign:'right'}}><div style={{fontSize:'20px',fontWeight:900,color:C.pink}}>{fmt(q.grand)}</div><div style={{fontSize:'11px',color:C.muted}}>est. total</div></div>
              </div>
              {[['Form 941 — FICA',fmt(q.fica),`Due ${q.due941}`],['Form 940 — FUTA',fmt(q.futa),'Due Jan 31'],['CA UI/ETT',fmt(q.caUI),`Due ${q.due941}`],['1040-ES Federal',fmt(q.fedEst),`Due ${q.due1040}`],['100-ES California',fmt(q.caEst),`Due ${q.due1040}`]].map(([l,v,d])=>(
                <div key={String(l)} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${C.border}`,fontSize:'13px'}}>
                  <span>{l}</span>
                  <div style={{textAlign:'right'}}><span style={{fontWeight:700,color:C.pink,marginRight:'8px'}}>{v}</span><span style={{fontSize:'11px',color:C.muted}}>{d}</span></div>
                </div>
              ))}
              <div style={{marginTop:'10px',padding:'8px 10px',background:'#F5F6FA',borderRadius:'8px',fontSize:'11px',color:C.muted,display:'flex',flexWrap:'wrap',gap:'10px'}}>
                <span>Net rev: <strong style={{color:C.text}}>{fmt(q.netRev)}</strong></span>
                <span>Exp: <strong style={{color:C.text}}>{fmt(q.exp)}</strong></span>
                <span>Payroll: <strong style={{color:C.text}}>{fmt(q.grossPay)}</strong></span>
                <span>Taxable: <strong style={{color:C.text}}>{fmt(q.taxable)}</strong></span>
              </div>
            </div>
          ))}
          {disbursements.length>0&&(
            <div style={card}>
              <div style={{fontSize:'11px',color:C.muted,fontWeight:'bold',letterSpacing:'0.05em',marginBottom:'10px'}}>OWNER DRAWS</div>
              {disbursements.map(d=>(
                <div key={d.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div><div style={{fontWeight:500}}>{d.recipient}</div><div style={{fontSize:'11px',color:C.muted}}>{d.disbursement_date}</div></div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{fontWeight:700}}>{fmt(Number(d.amount))}</span>
                    <button onClick={()=>handleDelete('disbursements',d.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'18px'}}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )

      case 'payroll': return (
        <div>
          <div style={{...card,background:C.navyDark,color:'#fff',padding:'16px 20px'}}>
            <div style={{fontSize:'10px',opacity:0.6,fontWeight:'bold',letterSpacing:'1px'}}>TOTAL PAYROLL</div>
            <div style={{fontSize:'28px',fontWeight:900,color:'#fda4af'}}>{fmt(staffingCosts)}</div>
            <div style={{fontSize:'12px',opacity:0.5,marginTop:'2px'}}>FICA: {fmt(staffingCosts*0.153)} · FUTA: {fmt(staffingCosts*0.006)}</div>
          </div>
          {payroll.map(p=>(
            <div key={p.id} style={{...card,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontWeight:700,marginBottom:'2px'}}>{p.employee_name}</div>
                <div style={{fontSize:'12px',color:C.muted}}>{p.pay_date} · FICA: {fmt(Number(p.amount)*0.153)}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontWeight:700,fontSize:'16px'}}>{fmt(Number(p.amount))}</span>
                <button onClick={()=>handleDelete('payroll',p.id)} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'18px'}}>×</button>
              </div>
            </div>
          ))}
          {payroll.length===0&&<div style={{textAlign:'center',padding:'40px',color:C.muted}}>No payroll this period</div>}
        </div>
      )
      default: return null
    }
  }

  if (checkingAuth) return (
    <div style={{minHeight:'100vh',background:C.navyDark,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:'32px',height:'32px',border:'2px solid rgba(45,191,184,0.2)',borderTopColor:C.teal,borderRadius:'50%',animation:'spin 0.7s linear infinite'}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!authed) return <LoginScreen onLogin={()=>setAuthed(true)} />

  const TABS = [
    {id:'summary',label:'Summary'},
    {id:'income',label:'Sales'},
    {id:'expense',label:'Expenses'},
    {id:'cogs',label:'COGS'},
    {id:'deductions',label:'Deductions'},
    {id:'tax',label:'Tax'},
    {id:'payroll',label:'Payroll'},
  ]

  return (
    <div style={{fontFamily:'Calibri,sans-serif',background:C.bg,minHeight:'100vh',paddingBottom:'140px'}}>
      <div style={{maxWidth:'500px',margin:'0 auto',padding:'16px'}}>
        <header style={{marginBottom:'16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
            <div style={{fontWeight:900,color:C.navy,fontSize:'16px',letterSpacing:'-0.3px'}}>MANA SOCIAL LLC</div>
            <button onClick={signOut} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'6px 12px',fontSize:'12px',color:C.muted,cursor:'pointer'}}>Sign out</button>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <select value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))} style={{flex:1,padding:'10px',borderRadius:'10px',border:`2px solid ${C.border}`,fontWeight:'bold',background:C.white}}>
              <option value={2026}>2026</option>
            </select>
            <select value={selectedMonth} onChange={e=>setSelectedMonth(Number(e.target.value))} style={{flex:2,padding:'10px',borderRadius:'10px',border:`2px solid ${C.border}`,fontWeight:'bold',background:C.white}}>
              <option value={0}>Full Year</option>
              {Array.from({length:12},(_,i)=><option key={i} value={i+1}>{new Date(0,i).toLocaleString('default',{month:'long'})}</option>)}
            </select>
          </div>
        </header>
        {editingItem ? renderForm() : renderTab()}
        {!editingItem&&(
          <button onClick={()=>setIsQuickAddOpen(true)} style={{position:'fixed',bottom:'120px',right:'20px',width:'60px',height:'60px',borderRadius:'30px',background:`linear-gradient(135deg,${C.teal},#1A7A75)`,color:'#fff',fontSize:'28px',border:'3px solid #fff',boxShadow:'0 8px 16px rgba(0,0,0,0.2)',zIndex:500,cursor:'pointer'}}>+</button>
        )}
        {isQuickAddOpen&&(
          <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.9)',display:'flex',alignItems:'flex-end',padding:'20px',zIndex:1000}}>
            <div style={{background:C.white,width:'100%',borderRadius:'20px',padding:'24px'}}>
              <h2 style={{fontWeight:900,marginBottom:'16px',color:C.navy}}>ADD RECORD</h2>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                {[['sales','SALE','#10b981'],['buyouts','BUYOUT',C.text],['expenses','EXPENSE','#ef4444'],['payroll','PAYROLL',C.text],['cogs_inventory','COGS',C.purple],['mileage_log','MILEAGE',C.teal]].map(([table,l,color])=>(
                  <button key={String(table)} onClick={()=>{setEditingItem({table:String(table)});setIsQuickAddOpen(false)}} style={{padding:'16px',borderRadius:'12px',border:`1px solid ${C.border}`,fontWeight:'bold',fontSize:'14px',background:C.white,color:color as string,cursor:'pointer'}}>{l}</button>
                ))}
                <button onClick={()=>{setEditingItem({table:'disbursements'});setIsQuickAddOpen(false)}} style={{gridColumn:'span 2',padding:'16px',borderRadius:'12px',border:`2px solid ${C.teal}`,color:C.teal,fontWeight:900,background:C.white,cursor:'pointer'}}>OWNER DRAW</button>
              </div>
              <button onClick={()=>setIsQuickAddOpen(false)} style={{width:'100%',marginTop:'16px',border:'none',background:'none',color:C.muted,fontWeight:'bold',cursor:'pointer',padding:'8px'}}>CANCEL</button>
            </div>
          </div>
        )}
      </div>
      <nav style={{position:'fixed',bottom:0,left:0,right:0,background:C.white,borderTop:`2px solid ${C.border}`,display:'flex',zIndex:400,height:'80px'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{flex:1,border:'none',background:'none',fontSize:'10px',fontWeight:900,color:activeTab===t.id?C.teal:C.muted,padding:'8px 2px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'0',borderTop:activeTab===t.id?`3px solid ${C.teal}`:'3px solid transparent'}}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
