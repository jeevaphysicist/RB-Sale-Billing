import { ipcMain } from 'electron';

let globalDb = null;

export function initializeProfitLossReportHandlers(db) {
  globalDb = db;

  // Helper to convert DD-MM-YYYY to YYYY-MM-DD for database querying
  const formatDateForDb = (dateStr) => {
    if (!dateStr) return dateStr;
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  // Get Profit & Loss Summary
  ipcMain.handle('profit-loss-report:get-summary', async (event, { startDate, endDate }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);

      // 1. Calculate Net Revenue (Sales - Tax)
      // Standard P&L uses Net Sales. Tax collected is a liability, not income.
      const revenue = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT SUM(grand_total - COALESCE(tax_total, 0)) as totalRevenue 
           FROM sales_orders 
            WHERE order_date BETWEEN ? AND ? 
            AND status NOT IN ('cancelled', 'returned')`,
          [dbStartDate, dbEndDate],
          (err, row) => {
            if (err) reject(err);
            else resolve(row?.totalRevenue || 0);
          }
        );
      });

      // 2. Calculate COGS (Estimation: Qty Sold * Current Purchase Price)
      const cogs = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT SUM(soi.quantity * p.purchase_price) as totalCOGS
           FROM sales_order_items soi
           JOIN sales_orders so ON soi.order_id = so.id
           JOIN products p ON soi.product_id = p.id
            WHERE so.order_date BETWEEN ? AND ?
            AND so.status NOT IN ('cancelled', 'returned')`,
          [dbStartDate, dbEndDate],
          (err, row) => {
            if (err) reject(err);
            else resolve(row?.totalCOGS || 0);
          }
        );
      });

      // 3. Calculate Total Expenses
      const expenses = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT SUM(amount) as totalExpenses
           FROM expense_records
           WHERE expense_date BETWEEN ? AND ?
           AND status != 'cancelled'`, 
          [dbStartDate, dbEndDate],
          (err, row) => {
            if (err) reject(err);
            else resolve(row?.totalExpenses || 0);
          }
        );
      });

      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - expenses;

      return {
        success: true,
        data: {
          revenue,
          cogs,
          expenses,
          grossProfit,
          netProfit
        }
      };

    } catch (error) {
      console.error('❌ Get P&L summary error:', error);
      return { success: false, message: 'Failed to fetch P&L summary' };
    }
  });

  // Get Daily Profit Trend
  ipcMain.handle('profit-loss-report:get-daily', async (event, { startDate, endDate }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);

      // We need to aggregate daily stats from 3 sources and merge them
      // Strategy: Get all unique dates from all 3 tables in range, then left join data
      // OR simpler: Fetch 3 separate daily lists and merge in JS

      const dailyRevenue = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT order_date as date, SUM(grand_total - COALESCE(tax_total, 0)) as revenue
           FROM sales_orders
            WHERE order_date BETWEEN ? AND ? AND status NOT IN ('cancelled', 'returned')
            GROUP BY order_date`,
          [dbStartDate, dbEndDate],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      const dailyCOGS = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT so.order_date as date, SUM(soi.quantity * p.purchase_price) as cogs
           FROM sales_order_items soi
           JOIN sales_orders so ON soi.order_id = so.id
           JOIN products p ON soi.product_id = p.id
            WHERE so.order_date BETWEEN ? AND ? AND so.status NOT IN ('cancelled', 'returned')
            GROUP BY so.order_date`,
          [dbStartDate, dbEndDate],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      const dailyExpenses = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT expense_date as date, SUM(amount) as expenses
           FROM expense_records
           WHERE expense_date BETWEEN ? AND ? AND status != 'cancelled'
           GROUP BY expense_date`,
          [dbStartDate, dbEndDate],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      // Merge data
      const dateMap = new Map();

      // Helper to init date entry
      const getEntry = (date) => {
        if (!dateMap.has(date)) {
          dateMap.set(date, { date, revenue: 0, cogs: 0, expenses: 0 });
        }
        return dateMap.get(date);
      };

      dailyRevenue.forEach(item => getEntry(item.date).revenue = item.revenue);
      dailyCOGS.forEach(item => getEntry(item.date).cogs = item.cogs);
      dailyExpenses.forEach(item => getEntry(item.date).expenses = item.expenses);

      // Convert to array and calculate profits
      const result = Array.from(dateMap.values())
        .map(item => ({
          ...item,
          grossProfit: item.revenue - item.cogs,
          netProfit: (item.revenue - item.cogs) - item.expenses
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { success: true, data: result };

    } catch (error) {
      console.error('❌ Get daily P&L error:', error);
      return { success: false, message: 'Failed to fetch daily P&L' };
    }
  });

  console.log('✅ Profit & Loss Report IPC handlers registered');
}
