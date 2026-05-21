import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { records } = await req.json();

  if (!records || !Array.isArray(records)) {
    return NextResponse.json({ error: 'records array required' }, { status: 400 });
  }

  const { data: inserted, error: dbError } = await supabase
    .from('bank_statement_transactions')
    .upsert(records, { onConflict: 'account_name,transaction_date,description,amount' })
    .select('id');

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ success: true, ingested: inserted?.length });
}
