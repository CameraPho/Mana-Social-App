import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use Service Role Key for backend write access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    const response = await fetch('https://api.manapool.com/v1/seller/orders', {
      headers: {
        'Authorization': `Bearer ${process.env.MANAPOOL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) throw new Error('ManaPool Connection Failed')

    const data = await response.json()
    const orders = data.orders || []
    let newItemsCount = 0

    for (const order of orders) {
      // 1. Check if order already exists to prevent duplicates
      const { data: existing } = await supabase
        .from('sales')
        .select('id')
        .eq('external_id', order.id)
        .single()

      if (!existing) {
        // 2. Log the Gross Sale
        const grossAmount = parseFloat(order.total_price)
        const orderDate = order.created_at || new Date().toISOString()
        
        await supabase.from('sales').insert([{
          platform: 'ManaPool',
          amount: grossAmount,
          sale_date: orderDate,
          external_id: order.id,
          notes: `Order #${order.order_number}`
        }])

        // 3. Log the ManaPool Fee as an Expense (Option B)
        // Adjust the 0.00 fee logic if ManaPool provides the exact fee in the JSON
        const feeAmount = order.commission_fee ? parseFloat(order.commission_fee) : grossAmount * 0.03 
        
        await supabase.from('expenses').insert([{
          item_name: `ManaPool Fee (Order #${order.order_number})`,
          cost: feeAmount,
          category: 'Fees',
          purchase_date: orderDate
        }])

        newItemsCount++
      }
    }

    return NextResponse.json({ message: 'Sync Complete', count: newItemsCount })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
