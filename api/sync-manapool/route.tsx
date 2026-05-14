import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const token = process.env.MANAPOOL_API_TOKEN
  const email = process.env.MANAPOOL_EMAIL

  if (!token || !email) {
    return NextResponse.json({ error: 'ManaPool credentials not configured in Vercel env vars' }, { status: 500 })
  }

  try {
    const res = await fetch('https://manapool.com/api/v1/seller/orders?limit=100', {
      headers: {
        'X-Email': email,
        'X-Access-Token': token,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `ManaPool API ${res.status}: ${err}` }, { status: res.status })
    }

    const data = await res.json()
    const orders: any[] = data.orders || []

    if (!orders.length) {
      return NextResponse.json({ synced: 0, message: 'No orders returned from ManaPool' })
    }

    const { data: existing } = await supabase
      .from('sales')
      .select('sale_date, amount')
      .eq('platform', 'manapool')

    const toInsert: any[] = []

    for (const order of orders) {
      const dateStr = new Date(order.created_at).toISOString().split('T')[0]
      const amount = (order.subtotal_cents || 0) / 100
      const shipping = (order.shipping_cents || 0) / 100
      const dupe = (existing || []).some(e =>
        e.sale_date === dateStr && Math.abs(Number(e.amount) - amount) < 0.02
      )
      if (dupe) continue
      toInsert.push({
        platform: 'manapool',
        amount,
        fees: 0,
        shipping,
        sale_date: dateStr,
        entity: new Date(dateStr) < new Date('2026-03-18') ? 'sole_prop' : 'llc',
      })
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('sales').insert(toInsert)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      synced: toInsert.length,
      total: orders.length,
      skipped: orders.length - toInsert.length,
      message: `Synced ${toInsert.length} new ManaPool orders (${orders.length - toInsert.length} already existed)`,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
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
    }

    return NextResponse.json({
      synced: toInsert.length,
      total: orders.length,
      skipped: orders.length - toInsert.length,
      message: `Synced ${toInsert.length} new orders (${orders.length - toInsert.length} already existed)`,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
