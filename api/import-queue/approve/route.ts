import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POST /api/import-queue/approve
// Body: { ids: string[], reviewedBy: string, corrections?: { id: string, canonical_data: any }[] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { ids, reviewedBy, corrections } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    // Apply corrections if any
    if (corrections && corrections.length > 0) {
      for (const c of corrections) {
        await supabase
          .from('import_queue')
          .update({ canonical_data: c.canonical_data })
          .eq('id', c.id)
      }
    }

    // Fetch the queue items
    const { data: items, error: fetchErr } = await supabase
      .from('import_queue')
      .select('*')
      .in('id', ids)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const results: any[] = []
    const errors: any[] = []

    for (const item of items || []) {
      try {
        const targetTable = item.target_table
        const canonical = item.canonical_data

        if (!targetTable || !canonical) {
          errors.push({ id: item.id, error: 'Missing target table or canonical data' })
          continue
        }

        // Insert into target table
        const { data: inserted, error: insErr } = await supabase
          .from(targetTable)
          .insert(canonical)
          .select()
          .single()

        if (insErr) {
          errors.push({ id: item.id, error: insErr.message })
          continue
        }

        // Auto-create asset if expense is Equipment/Furniture with cost > $200
        if (targetTable === 'expenses' && inserted) {
          const cat = canonical.category
          const cost = Number(canonical.cost || 0)
          if ((cat === 'Equipment' || cat === 'Furniture & Fixtures') && cost > 200) {
            await supabase.from('assets').insert({
              purchase_date: canonical.purchase_date,
              description: canonical.notes || 'Auto-created from expense',
              category: cat,
              cost,
              tax_paid: 0,
              useful_life_yrs: cat === 'Furniture & Fixtures' ? 7 : 5,
              depreciation_method: 'both',
              entity: canonical.entity,
              user_name: canonical.user_name,
              source_expense_id: inserted.id,
              source_import_id: item.id,
              is_auto_created: true
            })
            await supabase
              .from('expenses')
              .update({ asset_created: true })
              .eq('id', inserted.id)
          }
        }

        // Mark queue item as imported
        await supabase
          .from('import_queue')
          .update({
            status: 'approved',
            reviewed_by: reviewedBy || 'Cam',
            reviewed_at: new Date().toISOString(),
            imported_at: new Date().toISOString(),
            target_record_id: inserted.id
          })
          .eq('id', item.id)

        // Save vendor mapping if AI used a new vendor
        if (canonical.vendor && canonical.category) {
          const { data: existing } = await supabase
            .from('vendor_mappings')
            .select('id, correction_count')
            .eq('vendor_name', canonical.vendor)
            .maybeSingle()

          if (existing) {
            await supabase
              .from('vendor_mappings')
              .update({ correction_count: (existing.correction_count || 0) + 1 })
              .eq('id', existing.id)
          } else {
            await supabase.from('vendor_mappings').insert({
              vendor_name: canonical.vendor,
              vendor_keywords: [canonical.vendor.toLowerCase()],
              default_category: canonical.category,
              default_table: targetTable,
              is_inventory: targetTable === 'cogs_inventory',
              is_asset: targetTable === 'assets',
              correction_count: 1,
              created_by: reviewedBy || 'Cam'
            })
          }
        }

        results.push({ id: item.id, insertedId: inserted.id, table: targetTable })
      } catch (err: any) {
        errors.push({ id: item.id, error: err.message })
      }
    }

    return NextResponse.json({ success: true, imported: results.length, errors, results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/import-queue/approve?id=xxx (reject)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'No ID' }, { status: 400 })

    await supabase
      .from('import_queue')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
