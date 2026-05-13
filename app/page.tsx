  const fetchData = useCallback(async () => {
    // Fetch user for role management
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email === 'your-email@example.com') {
      setUserRole('owner')
    }

    // Add error handling to the fetches
    const [
      { data: s, error: sErr },
      { data: e, error: eErr },
      { data: p, error: pErr },
      { data: b, error: bErr }
    ] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('personal_payroll').select('*'),
      supabase.from('buyouts').select('*')
    ])

    // Log errors to the console for easy debugging later, but don't crash the app
    if (sErr || eErr || pErr || bErr) {
      console.error("Database Sync Warnings:", { sErr, eErr, pErr, bErr })
    }

    const filter = (arr, dateKey) => {
      if (!arr || arr.length === 0) return [] // Handshake safety check
      const year = 2026
      if (selectedMonth === 13) return arr.filter(i => i[dateKey]?.includes(`${year}`))
      const m = selectedMonth < 10 ? `0${selectedMonth}` : selectedMonth
      return arr.filter(i => i[dateKey]?.includes(`${year}-${m}`))
    }

    setSales(filter(s, 'sale_date'))
    setExpenses(filter(e, 'purchase_date'))
    setPersonalPayroll(filter(p, 'pay_date'))
    setBuyouts(filter(b, 'created_at'))
  }, [selectedMonth])
