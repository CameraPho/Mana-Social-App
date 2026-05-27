import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const EXPENSE_CATEGORIES = [
  'Shipping & Postage', 'Selling Fees & Commissions', 'Software & Subscriptions',
  'Supplies & Packaging', 'Advertising & Marketing', 'Professional Services',
  'Banking & Finance Charges', 'Taxes & Licenses', 'Equipment', 'Furniture & Fixtures',
  'Travel & Conventions', 'Trade Shows & Conventions', 'Meals & Entertainment',
  'Internet & Phone', 'Education & Training', 'Home Office', 'Inventory Purchase', 'Other'
]

const ASSET_CATEGORIES = ['Equipment', 'Furniture & Fixtures', 'Vehicle']

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Server config error: ANTHROPIC_API_KEY not set in Vercel' }, { status: 500 })
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'Server config error: SUPABASE_URL not set' }, { status: 500 })

    const body = await req.json()
    const { content, fileName, fileHash, fileSize, uploadedBy } = body

    const { data: existingDoc, error: dupErr } = await supabase
      .from('canonical_documents').select('*').eq('file_hash', fileHash).maybeSingle()
    if (dupErr) return NextResponse.json({ error: 'DB error checking duplicates: ' + dupErr.message }, { status: 500 })
    if (existingDoc && !body.override) {
      return NextResponse.json({ duplicate: true, existingDoc, message: 'This file was previously uploaded on ' + new Date(existingDoc.created_at).toLocaleDateString() })
    }

    const { data: vendors } = await supabase.from('vendor_mappings').select('*')
    const vendorContext = (vendors || []).map((v: any) =>
      `- ${v.vendor_name} (${v.platform || 'general'}): keywords=[${(v.vendor_keywords || []).join(', ')}] → category="${v.default_category}", table="${v.default_table}"`
    ).join('\n')

    const systemPrompt = `You are an AI accounting assistant for Mana Social LLC, a California TCG resale business.

BUSINESS CONTEXT:
- Mana Social LLC (multi-member LLC, members: Cam Pho and Kenny Diep)
- Previously operated as Camera Pho sole proprietorship (anything before March 18, 2026 = sole_prop entity, on/after = llc)
- Products sold: Magic the Gathering, Pokemon, Yu-Gi-Oh, One Piece, Funko Pop, TCG supplies
- Platforms used: TCGplayer, eBay, ManaPool, Amazon (for purchases)

YOUR JOB: Analyze the uploaded document and extract structured accounting data.

EXPENSE CATEGORIES: ${EXPENSE_CATEGORIES.join(', ')}
ASSET CATEGORIES: ${ASSET_CATEGORIES.join(', ')}

KNOWN VENDOR MAPPINGS:
${vendorContext}

OUTPUT FORMAT (return ONLY this JSON, no markdown):
{
  "documentType": "sales_report" | "expense_receipt" | "expense_invoice" | "amazon_orders" | "mixed",
  "platform": "tcgplayer" | "ebay" | "manapool" | "amazon" | "bcw" | "costco" | "other" | null,
  "vendor": "vendor name if applicable",
  "overallConfidence": 0.0-1.0,
  "periodStart": "YYYY-MM-DD" or null,
  "periodEnd": "YYYY-MM-DD" or null,
  "items": [
    {
      "type": "sale" | "expense" | "inventory" | "asset" | "mileage",
      "confidence": 0.0-1.0,
      "vendor": "vendor name",
      "category": "one of the expense categories above",
      "description": "what was sold/purchased",
      "amount": 0.00,
      "fees": 0.00,
      "shipping": 0.00,
      "ca_sales_tax": 0.00,
      "other_domestic_sales_tax": 0.00,
      "international_sales_tax": 0.00,
      "quantity": 1,
      "date": "YYYY-MM-DD",
      "platform": "platform name if applicable",
      "userName": "Cam" | "Kenny",
      "entity": "sole_prop" | "llc",
      "isInventory": true,
      "isAsset": false,
      "rawTitle": "original product title for learning",
      "notes": "additional context"
    }
  ]
}

FIELD DEFINITIONS FOR SALES:
- amount = item revenue ONLY (the price of products sold, excluding shipping and tax)
- shipping = shipping CHARGED to the customer (income to Mana Social — NOT what Mana Social paid for postage)
- fees = platform commission/selling fees deducted from payout
- ca_sales_tax = sales tax collected on California buyers
- other_domestic_sales_tax = sales tax collected on US buyers outside California
- international_sales_tax = VAT/GST/tax collected on non-US buyers

SALES TAX BUCKETING RULES:
- If the report lists tax by buyer state/country, split accordingly:
  - California buyer → ca_sales_tax
  - Other US state → other_domestic_sales_tax
  - Non-US country → international_sales_tax
- If the report shows only a single tax total with no breakdown, default the entire amount to other_domestic_sales_tax (TCGplayer/eBay/ManaPool are marketplace facilitators and most of their collected tax is for out-of-state buyers under economic nexus rules)
- These tax amounts are tracked for reporting — marketplace platforms typically remit directly to states, so they do not affect Mana Social's cash deposit
- Do NOT estimate tax from amount × percentage. Only extract values explicitly shown on the report.

SHIPPING RULES:
- shipping is ALWAYS what the customer paid (income side)
- Do NOT estimate or infer shipping costs from quantities, line items, or shipping cost tables
- The user enters all shipping COSTS (postage paid) manually as expenses — never auto-populate them

CONFIDENCE SCORING:
- 0.95+: Clear vendor match, all fields confidently extracted
- 0.80-0.94: Most fields clear, minor ambiguity
- below 0.80: Significant uncertainty, flag for manual review

VALIDATION:
- Dates must be valid and not in the future
- Amounts must be positive numbers
- Entity must be 'sole_prop' if date < 2026-03-18, else 'llc'
- For Equipment/Furniture with cost > $200, set isAsset=true
- For TCG products, set isInventory=true and category="Inventory Purchase"`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content }]
      })
    })

    const data = await response.json()
    if (data.error) return NextResponse.json({ error: data.error.message || JSON.stringify(data.error) }, { status: 500 })
    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      return NextResponse.json({ error: 'No content from AI: ' + JSON.stringify(data).slice(0, 300) }, { status: 500 })
    }

    const raw = data.content?.[0]?.text || '{}'
    const clean = raw.replace(/```json|```/g, '').trim()
    let parsed
    try { parsed = JSON.parse(clean) }
    catch { return NextResponse.json({ error: 'Failed to parse AI response', raw: clean }, { status: 500 }) }

    const { data: doc, error: docErr } = await supabase
      .from('canonical_documents').insert({
        file_name: fileName, file_hash: fileHash, file_size: fileSize || 0,
        document_type: parsed.documentType || 'unknown', platform: parsed.platform,
        period_start: parsed.periodStart, period_end: parsed.periodEnd,
        uploaded_by: uploadedBy || 'Cam', override: body.override || false
      }).select().single()

    if (docErr && !docErr.message?.includes('duplicate key')) {
      return NextResponse.json({ error: docErr.message, parsed }, { status: 500 })
    }

    const validated = (parsed.items || []).map((item: any) => validateItem(item))

    const queueRows = validated.map((item: any) => ({
      document_id: doc?.id,
      import_type: item.type === 'sale' ? 'sale' : item.type === 'asset' ? 'asset' : item.type === 'inventory' ? 'inventory' : item.type === 'mileage' ? 'mileage' : 'expense',
      status: item.confidenceTier === 'auto' && item.validationPassed ? 'pending_auto' : 'pending',
      confidence: item.confidence,
      confidence_tier: item.confidenceTier,
      raw_extraction: item,
      canonical_data: item.canonical,
      validation_errors: item.validationErrors,
      validation_passed: item.validationPassed,
      target_table: item.targetTable
    }))

    if (queueRows.length > 0) await supabase.from('import_queue').insert(queueRows)

    return NextResponse.json({
      success: true,
      documentId: doc?.id,
      documentType: parsed.documentType,
      platform: parsed.platform,
      overallConfidence: parsed.overallConfidence,
      itemCount: validated.length,
      autoCount: validated.filter((i: any) => i.confidenceTier === 'auto').length,
      reviewCount: validated.filter((i: any) => i.confidenceTier === 'review').length,
      manualCount: validated.filter((i: any) => i.confidenceTier === 'manual').length,
      items: validated
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function validateItem(item: any) {
  const errors: string[] = []
  const today = new Date().toISOString().split('T')[0]
  const LLC_START = '2026-03-18'

  if (!item.date || isNaN(new Date(item.date).getTime())) errors.push('Invalid or missing date')
  else if (item.date > today) errors.push('Date is in the future')
  if (item.amount == null || isNaN(Number(item.amount)) || Number(item.amount) < 0) errors.push('Invalid or missing amount')
  if (item.type === 'sale' && Number(item.fees || 0) > Number(item.amount || 0)) errors.push('Fees exceed gross sales')

  if (item.date) {
    const correctEntity = item.date < LLC_START ? 'sole_prop' : 'llc'
    if (item.entity !== correctEntity) item.entity = correctEntity
  }

  let confidenceTier = 'manual'
  if (item.confidence >= 0.95 && errors.length === 0) confidenceTier = 'auto'
  else if (item.confidence >= 0.80 && errors.length === 0) confidenceTier = 'review'

  let targetTable = 'expenses'
  if (item.type === 'sale') targetTable = 'sales'
  else if (item.type === 'inventory' || item.isInventory) targetTable = 'cogs_inventory'
  else if (item.type === 'asset' || item.isAsset) targetTable = 'assets'
  else if (item.type === 'mileage') targetTable = 'mileage_log'

  const canonical = buildCanonical(item, targetTable)
  return { ...item, confidenceTier, validationErrors: errors, validationPassed: errors.length === 0, targetTable, canonical }
}

function buildCanonical(item: any, targetTable: string): any {
  const entity = item.date < '2026-03-18' ? 'sole_prop' : 'llc'

  if (targetTable === 'sales') {
    const amount = Number(item.amount || 0)
    const shipping = Number(item.shipping || 0)
    const fees = Number(item.fees || 0)
    return {
      platform: item.platform || 'other',
      amount,
      fees,
      shipping,
      ca_sales_tax: Number(item.ca_sales_tax || 0),
      other_domestic_sales_tax: Number(item.other_domestic_sales_tax || 0),
      international_sales_tax: Number(item.international_sales_tax || 0),
      sale_date: item.date,
      period_start: item.date,
      period_end: item.date,
      entity,
      // Net to seller (matches bank deposit): item revenue + shipping income - fees
      net_sales: amount + shipping - fees,
      num_orders: Number(item.quantity || 1),
      confidence: item.confidence
    }
  }

  if (targetTable === 'cogs_inventory') {
    const qty = Number(item.quantity || 1)
    const totalCost = Number(item.amount || 0)
    return {
      date: item.date, inventory_type: 'sealed',
      description: item.description?.slice(0, 100), set_name: null,
      purchase_price: totalCost / qty, quantity: qty, card_count: 0, cards_per_box: 0,
      total_cost: totalCost, cost_per_unit: totalCost / qty,
      total_units: qty, sold_units: 0, est_sell_value: 0, entity
    }
  }

  if (targetTable === 'assets') {
    return {
      purchase_date: item.date, description: item.description,
      category: item.category === 'Equipment' || item.category === 'Furniture & Fixtures' ? item.category : 'Equipment',
      cost: Number(item.amount || 0), tax_paid: 0,
      useful_life_yrs: item.category === 'Furniture & Fixtures' ? 7 : 5,
      depreciation_method: 'both', entity, user_name: item.userName || 'Cam', is_auto_created: true
    }
  }

  if (targetTable === 'mileage_log') {
    return {
      date: item.date, purpose: item.description || 'Business trip',
      from_location: 'Home', to_location: item.vendor || 'Destination',
      miles: Number(item.amount || 0), user_name: item.userName || 'Cam'
    }
  }

  return {
    category: item.category || 'Other', cost: Number(item.amount || 0),
    purchase_date: item.date, notes: item.description?.slice(0, 200),
    entity, user_name: item.userName || 'Cam', paid_by_company: true,
    vendor: item.vendor, confidence: item.confidence
  }
}
