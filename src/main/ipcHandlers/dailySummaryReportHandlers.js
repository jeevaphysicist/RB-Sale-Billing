import { ipcMain } from 'electron';

let globalDb = null;

export function initializeDailySummaryReportHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for daily summary report handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Daily Summary Report handlers initialized');

  // Helper to run query
  const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
      globalDb.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  // Helper to get single row
  const getRow = (query, params = []) => {
    return new Promise((resolve, reject) => {
      globalDb.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  // Get Daily Summary (Sales, Payments, Expenses)
  ipcMain.handle('daily-report:get-summary', async (event, date) => {
    try {
      console.log('📥 Getting daily summary for:', date);
      const targetDate = date || new Date().toLocaleDateString('en-CA');
      
      // 1. Sales Summary
      const salesQuery = `
        SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(grand_total), 0) as total_revenue,
          COALESCE(SUM(discount_total), 0) as total_discount
        FROM sales_orders
        WHERE date(order_date, 'localtime') = ? AND status != 'Cancelled'
      `;

      // 2. Payment Collections (Reconciliation)
      // We look at payment receipts created TODAY
      const paymentsQuery = `
        SELECT 
          payment_method,
          COALESCE(SUM(payment_amount), 0) as total
        FROM payment_records
        WHERE date(payment_date, 'localtime') = ? AND record_type = 'sales'
        GROUP BY payment_method
      `;

      // 3. Expenses
      const expenseQuery = `
        SELECT COALESCE(SUM(amount), 0) as total_expenses
        FROM expense_records
        WHERE date(expense_date, 'localtime') = ? AND status != 'Cancelled'
      `;

      // 4. Products Sold Info (Count)
      const productsQuery = `
        SELECT COALESCE(SUM(soi.quantity), 0) as total_items
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.order_id = so.id
        WHERE date(so.order_date, 'localtime') = ? AND so.status != 'Cancelled'
      `;

      const [salesRes, paymentsRes, expenseRes, productsRes] = await Promise.all([
        getRow(salesQuery, [targetDate]),
        runQuery(paymentsQuery, [targetDate]),
        getRow(expenseQuery, [targetDate]),
        getRow(productsQuery, [targetDate])
      ]);

      // Process payment methods into a clean object
      const collections = {
        Cash: 0,
        Card: 0,
        UPI: 0,
        Total: 0
      };

      paymentsRes.forEach(p => {
        const method = p.payment_method || 'Other';
        if (collections[method] !== undefined) {
          collections[method] += p.total;
        } else {
          collections[method] = p.total;
        }
        collections.Total += p.total;
      });

      return {
        success: true,
        data: {
          date: targetDate,
          sales: {
            orders: salesRes.total_orders,
            revenue: salesRes.total_revenue,
            discount: salesRes.total_discount,
            itemsSold: productsRes.total_items
          },
          collections,
          expenses: expenseRes.total_expenses,
          netCash: requestCashCalculation(collections.Cash, expenseRes.total_expenses)
        }
      };
    } catch (error) {
      console.error('❌ Get daily summary error:', error);
      return { success: false, message: 'Failed to fetch daily summary' };
    }
  });

  // Calculate Net Cash (Cash In - Cash Expenses)
  const requestCashCalculation = (cashIn, cashOut) => {
    return cashIn - cashOut;
  };

  // Get Hourly Sales Trend
  ipcMain.handle('daily-report:get-hourly-trend', async (event, date) => {
    try {
      const targetDate = date || new Date().toLocaleDateString('en-CA');

      // SQLite doesn't have a simple HOUR() function, so we use strftime
      // Extract hour from order_date (which contains timestamp) or order_time as fallback
      
      const query = `
        SELECT 
          CAST(strftime('%H', order_date, 'localtime') AS INTEGER) as hour,
          COUNT(*) as orders,
          SUM(grand_total) as revenue
        FROM sales_orders
        WHERE date(order_date, 'localtime') = ? AND status != 'Cancelled'
        GROUP BY hour
        ORDER BY hour ASC
      `;

      const rows = await runQuery(query, [targetDate]);
      
      // Fill in missing hours for a complete 24h or business hour view?
      // Let's just return the data we have, frontend can fill gaps if needed.
      
      return { success: true, data: rows };
    } catch (error) {
      console.error('❌ Get hourly trend error:', error);
      return { success: false, message: 'Failed to fetch hourly trend' };
    }
  });

  console.log('✅ Daily Report IPC handlers registered');
}
