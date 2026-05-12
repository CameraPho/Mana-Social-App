  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Processing...');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      
      // Split by any newline character (handles \r\n or \n)
      const lines = text.split(/\r?\n/);
      
      // Step 1: Find the header row by searching for the date column title
      const headerIndex = lines.findIndex(line => line.includes('Transaction creation date'));
      
      if (headerIndex === -1) {
        setUploadStatus('Error: Could not find eBay header row.');
        return;
      }

      const csvData = lines.slice(headerIndex).join('\n');

      // Step 2: Parse the cleaned CSV data
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          let totalGross = 0;
          let orderCount = 0;

          results.data.forEach(row => {
            // Check if it's an 'Order' and get the amount
            if (row['Type'] === 'Order') {
              const amountValue = row['Gross transaction amount'];
              if (amountValue) {
                const cleanAmount = parseFloat(amountValue.toString().replace(/[$,]/g, ''));
                if (!isNaN(cleanAmount)) {
                  totalGross += cleanAmount;
                  orderCount++;
                }
              }
            }
          });
          
          if (orderCount === 0) {
            setUploadStatus('Warning: No "Order" transactions found in this file.');
          } else {
            setEbaySales(totalGross);
            setUploadStatus(`Success! Found ${orderCount} orders totaling $${totalGross.toLocaleString(undefined, {minimumFractionDigits: 2})}.`);
          }
        },
        error: function() {
          setUploadStatus('Error parsing CSV format.');
        }
      });
    };
    reader.readAsText(file);
  };
