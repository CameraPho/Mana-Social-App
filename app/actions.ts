export const processSalesCSV = (data: any[]) => {
  return data.map(row => ({
    date: row['Date'] || row['Transaction Date'],
    gross: parseFloat(row['Gross Sales'] || row['Total Price'] || 0),
    fees: parseFloat(row['Fees'] || 0),
    isMarketplace: true // Most of your current files are marketplace
  }));
}

export const calculateTaxReturn = (sales: any[]) => {
  const gross = sales.reduce((sum, s) => sum + s.gross, 0);
  const deductions = sales.filter(s => s.isMarketplace).reduce((sum, s) => sum + s.gross, 0);
  return {
    line1GrossSales: gross,
    line12Deductions: deductions,
    netTaxable: gross - deductions
  };
}
