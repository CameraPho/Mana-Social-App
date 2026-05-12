  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Processing...');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      
      // Step 1: Find the actual header row (ignoring everything above it)
      const headerIndex = lines.findIndex(line => line.includes('Transaction creation date'));
      
      if (headerIndex === -1) {
        setUploadStatus('Error: Could not find eBay header columns.');
        return;
      }

      const csvData = lines.slice(headerIndex).join('\n');

      // Step 2: Parse the cleaned CSV data
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          let totalGross = 0;
          results.data.forEach(row => {
            // Only sum rows where Type is 'Order'
            if (row['Type'] && row['Type'].trim() === 'Order') {
              const amountValue = row['Gross transaction amount'];
              if (amountValue) {
                // Clean the string (remove quotes and commas)
                const cleanAmount = parseFloat(amountValue.toString().replace(/[",]/g, ''));
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
          setUploadStatus('Error parsing CSV format.');
        }
      });
    };
    reader.readAsText(file);
  };
