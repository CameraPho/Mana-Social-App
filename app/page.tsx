  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Processing...');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      
      // Step 1: Find the actual header row (skipping eBay's notes)
      const headerIndex = lines.findIndex(line => line.includes('Transaction creation date'));
      const csvData = lines.slice(headerIndex).join('\n');

      // Step 2: Parse the cleaned CSV data
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          let totalGross = 0;
          results.data.forEach(row => {
            // Only count "Order" types as Revenue
            if (row['Type'] === 'Order') {
              const amountValue = row['Gross transaction amount'];
              if (amountValue) {
                const cleanAmount = parseFloat(amountValue.toString().replace(/[$,]/g, ''));
                if (!isNaN(cleanAmount)) {
                  totalGross += cleanAmount;
                }
              }
            }
          });
          
          setEbaySales(totalGross);
          setUploadStatus(`Success! Found $${totalGross.toLocaleString(undefined, {minimumFractionDigits: 2})} in eBay Sales.`);
        },
        error: function() {
          setUploadStatus('Error reading CSV format.');
        }
      });
    };
    reader.readAsText(file);
  };
