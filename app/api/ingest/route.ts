import { NextResponse } from 'next/server';
⁠import { createClient } from '@/lib/supabase';
import { parsePDF } from '@/lib/parsePDF';
import { reconcileTransactions } from '@/lib/ledger/reconciliation';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { rawText, accountName } = await req.json();

  // 1. Transform raw text to Ledger-ready objects
  const records = parsePDF(rawText, accountName);

  // 2. Ingest into Bank Feed
  const { data: inserted, error: dbError } = await supabase
    .from('bank_statement_transactions')
    .upsert(records, { onConflict: 'account_name,transaction_date,description,amount' })
    .select('id');

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // 3. Trigger Automated Reconciliation
  await reconcileTransactions();

  return NextResponse.json({ success: true, ingested: inserted?.length });
}