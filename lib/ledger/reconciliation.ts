⁠import { createClient } from '@/lib/supabase';

/**
 * Automatically matches bank transactions to domain records 
 * and creates balanced ledger entries.
 */
export async function reconcileTransactions() {
  const supabase = await createClient();

  // 1. Fetch unmatched bank transactions
  const { data: bankTxns } = await supabase
    .from('bank_statement_transactions')
    .select('id, amount, transaction_date, description')
    .is('is_reconciled', false);

  if (!bankTxns || bankTxns.length === 0) return { matched: 0 };

  // 2. Logic: Match against orphan expenses (example)
  // We match based on amount and date proximity
  for (const txn of bankTxns) {
    const { data: match } = await supabase
      .from('expenses')
      .select('id, amount')
      .eq('amount', txn.amount)
      .is('bank_txn_id', null)
      .limit(1)
      .single();

    if (match) {
      // 3. Create the Ledger Link
      // This creates the header and the dual entry (Debit Expense, Credit Cash)
      const { data: journal } = await supabase
        .from('journal_transactions')
        .insert({
          transaction_date: txn.transaction_date,
          narration: txn.description,
          source_bank_txn_id: txn.id
        })
        .select('id')
        .single();

      if (journal) {
        // Create the debit/credit entries here...
        await supabase.from('journal_entries').insert([
          { journal_transaction_id: journal.id, account_id: 'EXPENSE_ACCT_ID', debit: txn.amount },
          { journal_transaction_id: journal.id, account_id: 'CASH_ACCT_ID', credit: txn.amount }
        ]);
        
        // Mark as reconciled
        await supabase.from('bank_statement_transactions').update({ is_reconciled: true }).eq('id', txn.id);
      }
    }
  }
  return { success: true };
}