import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const token = process.env.MANAPOOL_API_TOKEN
  const email = process.env.MANAPOOL_EMAIL

  if (!token || !email) {
    return NextResponse.json({ error: 'ManaPool credentials not configured' }, { status: 500 })
  }

  try {
    // Fetch recent orders from ManaPool API
    const res = await fetch('https://manapool.com/api/v1/seller/orders?status=completed&limit=100', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Seller-Email': email,
        'Content-Type': 'application/json',
      }
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `ManaPool API error: ${err}` }, { status: res.status })
    }

    const data = await res.json()
    const orders = data.orders || data.data || data || []

    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No orders returned' })
    }

    // Check existing sale_date + platform combos to avoid duplicates
    const { data: existing } = await supabase
      .from('sales')
      .select('sale_date, amount')
      .eq('platform', 'manapool')

    let synced = 0
    const toInsert = []

    for (const order of orders) {
      const saleDate = order.completed_at || order.created_at || order.date
      if (!saleDate) continue
      const dateStr = new Date(saleDate).toISOString().split('T')[0]
      const amount = parseFloat(order.subtotal || order.total || order.amount || 0)
      const fees = parseFloat(order.fees || order.platform_fee || 0)
      const shipping = parseFloat(order.shipping_cost || order.shipping || 0)

      // Skip if already exists (same date + amount)
      const alreadyExists = (existing || []).some(e =>
        e.sale_date === dateStr && Math.abs(Number(e.amount) - amount) < 0.01
      )
      if (alreadyExists) continue

      const entity = new Date(dateStr) < new Date('2026-03-18') ? 'sole_prop' : 'llc'

      toInsert.push({
        platform: 'manapool',
        amount,
        fees,
        shipping,
        sale_date: dateStr,
        entity,
      })
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('sales').insert(toInsert)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      synced = toInsert.length
    }

    return NextResponse.json({ synced, total: orders.length, message: `Synced ${synced} new orders` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
