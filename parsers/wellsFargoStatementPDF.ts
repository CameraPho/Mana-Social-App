// parsers/wellsFargoStatementPDF.ts
// Parses Wells Fargo business checking PDF statements
// Format: Date | Check# | Description | Deposits/Credits | Withdrawals/Debits | Ending balance

export async function parseWellsFargoStatementPDF(file: File): Promise<{ records: any[], meta: any }> {
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  // Dynamically import pdfjs
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map((item: any) => item.str).join(' ') + '\n'
  }

  // Extract year from header e.g. "April 30, 2026"
  const yearMatch = fullText.match(/\b(20\d{2})\b/)
  const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear())

  // Extract account name
  const acctMatch = fullText.match(/(Initiate Business Checking|Business Checking|Everyday Checking)/i)
  const accountName = 'Wells Fargo Business Checking'

  // Find transaction section — look for lines after "Transaction history"
  const txnSectionMatch = fullText.match(/Transaction history([\s\S]*?)Totals/)
  if (!txnSectionMatch) return { records: [], meta: { year, accountName } }

  const txnText = txnSectionMatch[1]

  // WF date pattern: M/D or MM/DD at start of a transaction
  // Each transaction line: date [check#] description [deposit] [withdrawal] [balance]
  // We'll use a regex to find date-anchored lines
  const linePattern = /(\d{1,2}\/\d{1,2})\s+(?:\d+\s+)?([A-Za-z][\s\S]*?)\s+([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?(?:\s+([\d,]+\.\d{2}))?/g

  // Better approach: split by date tokens
  // Find all date positions in the transaction section
  const dateRegex = /\b(\d{1,2}\/\d{1,2})\b/g
  const lines: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  // Split txnText into chunks starting at each date
  const datePositions: number[] = []
  while ((match = dateRegex.exec(txnText)) !== null) {
    datePositions.push(match.index)
  }

  const records: any[] = []

  // Parse line by line from the raw text
  // WF format in PDF: date and amounts are well-separated
  // Strategy: find lines that start with a date M/D pattern
  const rawLines = fullText.split('\n')
  
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim()
    
    // Match lines starting with a date like "4/24" or "4/28"
    const dateMatch = line.match(/^(\d{1,2})\/(\d{1,2})\s+(.+)/)
    if (!dateMatch) continue
    
    const month = dateMatch[1].padStart(2, '0')
    const day = dateMatch[2].padStart(2, '0')
    const rest = dateMatch[3]
    
    const date = `${year}-${month}-${day}`
    
    // Extract all dollar amounts from the rest of the line
    const amounts = [...rest.matchAll(/[\d,]+\.\d{2}/g)].map(m => parseFloat(m[0].replace(/,/g, '')))
    
    if (amounts.length === 0) continue
    
    // Remove amounts from description
    let description = rest
      .replace(/[\d,]+\.\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    // Skip header rows and summary rows
    if (!description || /^(date|check|number|description|deposits|withdrawals|ending|totals|balance)/i.test(description)) continue
    if (description.length < 3) continue
    
    // WF columns: Description | [Deposit] | [Withdrawal] | [Ending balance]
    // If 3 amounts: deposit/withdrawal, then ending balance — but which is which?
    // If 2 amounts: one transaction amount + ending balance
    // If 1 amount: just ending balance or just transaction (ambiguous)
    
    // Key insight: deposits and withdrawals are SEPARATE columns in WF
    // In the raw PDF text they appear as separate tokens
    // We need to determine sign from position/context
    
    // Heuristic: check if description contains debit keywords
    const isLikelyDebit = /debit|withdraw|payment|transfer to|charge|fee|stamps/i.test(description)
    const isLikelyCredit = /deposit|credit|transfer from|instant pmt|paypal/i.test(description)
    
    let amount: number
    
    if (amounts.length >= 2) {
      // Last amount is usually ending daily balance
      // Second-to-last is the transaction amount
      const txnAmt = amounts[amounts.length - 2]
      
      if (isLikelyDebit) {
        amount = -txnAmt
      } else if (isLikelyCredit) {
        amount = txnAmt
      } else {
        // Use ending balance delta if we have previous balance
        // Default to positive (credit) for ambiguous cases
        amount = txnAmt
      }
    } else if (amounts.length === 1) {
      // Only one amount — likely just ending balance, skip
      continue
    } else {
      continue
    }
    
    // Skip tiny verification amounts (ACH verify micro-deposits) < $1 unless you want them
    // Keeping them — they're real transactions
    
    records.push({
      account_name: accountName,
      transaction_date: date,
      description,
      amount,
    })
  }

  return { records, meta: { year, accountName } }
}
