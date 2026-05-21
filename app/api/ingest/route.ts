import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { parsePDF } from '@/lib/parsePDF';
import { reconcileTransactions } from '@/lib/ledger/reconciliation';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { rawText, accountName } = await req.json();

  const records = parsePDF(rawText, accountName);

  const { data: inserted, error: dbError } = await supabase
    .from('bank_statement_transactions')
    .upsert(records, { onConflict: 'account_name,transaction_date,description,amount' })
    .select('id');

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  await reconcileTransactions();

  return NextResponse.json({ success: true, ingested: inserted?.length });
}