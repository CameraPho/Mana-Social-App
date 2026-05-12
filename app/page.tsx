  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || typeof window === 'undefined') return; // Guard for server-side error
    
    setUploadStatus('Processing...');
    
    const reader = new window.FileReader(); // Explicitly use window.FileReader
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      
      // Find the header row (Transaction creation date)
      const headerIndex = lines.findIndex(line => line.includes('Transaction creation date'));
      if (headerIndex === -1) {
        setUploadStatus('Error: Could not find eBay header row.');
        return;
      }
      
      const csvData = lines.slice(headerIndex).join('\n');

      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          let totalGross = 0;
          results.data.forEach(row => {
            // Check for 'Order' type
            if (row['Type'] === 'Order' || row['Type'] === '"Order"') {
              const amountValue = row['Gross transaction amount'];
              if (amountValue) {
                // Remove quotes, commas, and dollar signs
                const cleanAmount = parseFloat(amountValue.toString().replace(/[$,"]/g, ''));
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
