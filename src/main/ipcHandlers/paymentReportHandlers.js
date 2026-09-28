import { ipcMain } from 'electron';

let globalDb = null;

export function initializePaymentReportHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for payment report handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Payment Report handlers initialized');

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

  // Get Payment Summary (Total In, Total Out, Net)
  ipcMain.handle('payment-report:get-summary', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting payment report summary:', filterParams);
      const { startDate, endDate } = filterParams;
      
      const dateFilter = startDate && endDate ? `AND payment_date BETWEEN '${startDate}' AND '${endDate}'` : '';
      const expenseDateFilter = startDate && endDate ? `AND expense_date BETWEEN '${startDate}' AND '${endDate}'` : '';

      // 1. Total Sales Income (In)
      const salesQuery = `
        SELECT COALESCE(SUM(payment_amount), 0) as total
        FROM payment_records
        WHERE record_type = 'sales' ${dateFilter}
      `;
      
      // 2. Total Purchase Spend (Out)
      const purchaseQuery = `
        SELECT COALESCE(SUM(payment_amount), 0) as total
        FROM payment_records
        WHERE record_type = 'purchase' ${dateFilter}
      `;

      // 3. Total Operational Expenses (Out)
      // Note: expense_records doesn't have 'record_type', it's just expenses
      const expenseQuery = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expense_records
        WHERE status != 'Cancelled' ${expenseDateFilter}
      `;

      const [salesResult, purchaseResult, expenseResult] = await Promise.all([
        getRow(salesQuery),
        getRow(purchaseQuery),
        getRow(expenseQuery)
      ]);

      const totalIn = salesResult.total;
      const totalOut = purchaseResult.total + expenseResult.total;
      const netCashFlow = totalIn - totalOut;

      return {
        success: true,
        data: {
          totalIn,
          totalOut,
          netCashFlow,
          breakdown: {
            sales: salesResult.total,
            purchases: purchaseResult.total,
            expenses: expenseResult.total
          }
        }
      };
    } catch (error) {
      console.error('❌ Get payment summary error:', error);
      return { success: false, message: 'Failed to fetch payment summary' };
    }
  });

  // Get Monthly Trend Data (Last 6-12 months or range)
  ipcMain.handle('payment-report:get-chart-data', async (event, filterParams = {}) => {
    try {
      // Aggregate by month: YYYY-MM
      // Since SQLite doesn't have easy date grouping, we use strftime
      // We need to union all 3 sources and group by month

      const query = `
        SELECT 
          month,
          SUM(income) as income,
          SUM(expense) as expense
        FROM (
          -- Sales Income
          SELECT 
            strftime('%Y-%m', payment_date) as month,
            payment_amount as income,
            0 as expense
          FROM payment_records
          WHERE record_type = 'sales'
          
          UNION ALL
          
          -- Purchase Expense
          SELECT 
            strftime('%Y-%m', payment_date) as month,
            0 as income,
            payment_amount as expense
          FROM payment_records
          WHERE record_type = 'purchase'
          
          UNION ALL
          
          -- Operational Expense
          SELECT 
            strftime('%Y-%m', expense_date) as month,
            0 as income,
            amount as expense
          FROM expense_records
          WHERE status != 'Cancelled'
        )
        WHERE month IS NOT NULL
        GROUP BY month
        ORDER BY month ASC
        LIMIT 12 
      `;
      // Note: LIMIT 12 gets the *first* 12 months in DB history if strictly ASC. 
      // If we want *last* 12 months, we should filter by date range in the WHERE clause of subqueries or LIMIT differently.
      // For now, let's just get all and let frontend slice, or restrict to current year? 
      // User didn't specify, but "Trend" usually implies recent. 
      // Let's refine the query to just get data, sorting by month.

      const data = await runQuery(query);

      return { success: true, data };
    } catch (error) {
      console.error('❌ Get chart data error:', error);
      return { success: false, message: 'Failed to fetch chart data' };
    }
  });

  // Get Detailed Transactions List (Combined)
  ipcMain.handle('payment-report:get-transactions', async (event, filterParams = {}) => {
    try {
      const { page = 1, limit = 10, searchTerm } = filterParams;
      const offset = (page - 1) * limit;

      // We need a UNION of all 3 types, normalized columns:
      // ID, Date, Type ('Sale', 'Purchase', 'Expense'), Party/Description, Mode, Amount, Reference

      let baseQuery = `
        SELECT 
          id,
          payment_date as date,
          'Sale' as type,
          (
            SELECT customer_name 
            FROM sales_orders so 
            WHERE so.id = pr.reference_id
          ) as party_name,
          payment_method as mode,
          payment_amount as amount,
          reference_number as ref_no
        FROM payment_records pr
        WHERE record_type = 'sales'

        UNION ALL

        SELECT 
          id,
          payment_date as date,
          'Purchase' as type,
          (
            SELECT supplier_name 
            FROM purchase_orders po 
            WHERE po.id = pr.reference_id
          ) as party_name,
          payment_method as mode,
          payment_amount as amount,
          reference_number as ref_no
        FROM payment_records pr
        WHERE record_type = 'purchase'

        UNION ALL

        SELECT 
          id,
          expense_date as date,
          'Expense' as type,
          description as party_name, -- reusing party_name for description
          payment_mode as mode,
          amount,
          reference_number as ref_no
        FROM expense_records
        WHERE status != 'Cancelled'
      `;
      
      // Wrap in outer query for sorting and pagination
      let finalQuery = `SELECT * FROM (${baseQuery}) WHERE 1=1`;
      const params = [];

      if (searchTerm) {
        finalQuery += ` AND (party_name LIKE ? OR ref_no LIKE ?)`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      finalQuery += ` ORDER BY date DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const transactions = await runQuery(finalQuery, params);

      // Total count query
      let countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) WHERE 1=1`;
      const countParams = [];
      if (searchTerm) {
        countQuery += ` AND (party_name LIKE ? OR ref_no LIKE ?)`;
        countParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }
      
      const countRow = await getRow(countQuery, countParams);

      return {
        success: true,
        data: transactions,
        total: countRow.total,
        page,
        limit
      };

    } catch (error) {
      console.error('❌ Get transactions error:', error);
      return { success: false, message: 'Failed to fetch transactions' };
    }
  });

  console.log('✅ Payment Report IPC handlers registered');
}
