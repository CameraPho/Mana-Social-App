import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This initializes Supabase using your secret keys
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role to bypass security for the sync
)

export async function POST() {
  try {
    // 1. We "ping" ManaPool and ask for your orders
    const response = await fetch('https://api.manapool.com/v1/seller/orders', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.MANAPOOL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) throw new Error('ManaPool connection failed')

    const data = await response.json()
    const orders = data.orders || []

    // 2. We loop through every order ManaPool sent us
    const syncResults = await Promise.all(orders.map(async (order: any) => {
      
      // 3. We check Supabase: "Do we already have this Order ID?"
      const { data: existing } = await supabase
        .from('sales')
        .select('id')
        .eq('external_id', order.id)
        .single()

      // 4. If it's NOT in Supabase, we insert it
      if (!existing) {
        return await supabase.from('sales').insert([{
          platform: 'ManaPool',
          amount: parseFloat(order.total_price),
          sale_date: order.created_at, // Logs the actual date of sale
          external_id: order.id,       // The "Safety Net" ID
          notes: `ManaPool Order #${order.order_number}`
        }])
      }
      return null; // Skip if it already exists
    }))

    return NextResponse.json({ 
      success: true, 
      count: orders.length, 
      message: "Sync completed successfully" 
    })

  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
