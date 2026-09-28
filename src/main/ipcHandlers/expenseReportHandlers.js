import { ipcMain } from 'electron';

let globalDb = null;

export function initializeExpenseReportHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for expense report handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Expense Report handlers initialized');

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

  // Get Expense Summary
  ipcMain.handle('expense-report:get-summary', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting expense report summary:', filterParams);
      const { startDate, endDate } = filterParams;
      
      const dateFilter = startDate && endDate ? `AND er.expense_date BETWEEN '${startDate}' AND '${endDate}'` : '';
      
      // 1. Total Expenses
      const totalQuery = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expense_records er
        WHERE er.status != 'Cancelled' ${dateFilter}
      `;
      
      // 2. Average Expense (per transaction)
      const avgQuery = `
        SELECT COALESCE(AVG(amount), 0) as avg_amount
        FROM expense_records er
        WHERE er.status != 'Cancelled' ${dateFilter}
      `;

      // 3. Top Spending Category
      const topCategoryQuery = `
        SELECT e.name as category_name, SUM(er.amount) as total
        FROM expense_records er
        JOIN expenses e ON er.category_id = e.id
        WHERE er.status != 'Cancelled' ${dateFilter}
        GROUP BY er.category_id
        ORDER BY total DESC
        LIMIT 1
      `;
      
      const [totalRes, avgRes, topCatRes] = await Promise.all([
        getRow(totalQuery),
        getRow(avgQuery),
        getRow(topCategoryQuery)
      ]);

      return {
        success: true,
        data: {
          totalExpenses: totalRes.total,
          avgExpense: avgRes.avg_amount,
          topCategory: topCatRes || { category_name: 'N/A', total: 0 }
        }
      };
    } catch (error) {
      console.error('❌ Get expense summary error:', error);
      return { success: false, message: 'Failed to fetch expense summary' };
    }
  });

  // Get Category Breakdown (for Pie Chart)
  ipcMain.handle('expense-report:get-category-breakdown', async (event, filterParams = {}) => {
    try {
      const { startDate, endDate } = filterParams;
      const dateFilter = startDate && endDate ? `AND er.expense_date BETWEEN '${startDate}' AND '${endDate}'` : '';

      const query = `
        SELECT e.name, SUM(er.amount) as value
        FROM expense_records er
        JOIN expenses e ON er.category_id = e.id
        WHERE er.status != 'Cancelled' ${dateFilter}
        GROUP BY er.category_id
        ORDER BY value DESC
      `;

      const data = await runQuery(query);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Get expense category breakdown error:', error);
      return { success: false, message: 'Failed to fetch category breakdown' };
    }
  });

  // Get Monthly Trend (for Bar/Area Chart)
  ipcMain.handle('expense-report:get-trend', async (event, filterParams = {}) => {
    try {
      // Group by YYYY-MM
      const query = `
        SELECT 
          strftime('%Y-%m', expense_date) as month,
          SUM(amount) as total
        FROM expense_records
        WHERE status != 'Cancelled'
        GROUP BY month
        ORDER BY month ASC
        LIMIT 12
      `;

      const data = await runQuery(query);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Get expense trend error:', error);
      return { success: false, message: 'Failed to fetch expense trend' };
    }
  });

  // Get Detailed Expense List
  ipcMain.handle('expense-report:get-list', async (event, filterParams = {}) => {
    try {
      const { page = 1, limit = 10, searchTerm, startDate, endDate, categoryId } = filterParams;
      const offset = (page - 1) * limit;

      let baseQuery = `
        SELECT 
          er.id,
          er.expense_date,
          er.expense_number,
          e.name as category_name,
          er.description,
          er.paid_by,
          er.payment_mode,
          er.amount
        FROM expense_records er
        JOIN expenses e ON er.category_id = e.id
        WHERE er.status != 'Cancelled'
      `;
      
      const params = [];

      if (searchTerm) {
        baseQuery += ` AND (er.expense_number LIKE ? OR er.description LIKE ? OR e.name LIKE ?)`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }

      if (startDate && endDate) {
        baseQuery += ` AND er.expense_date BETWEEN ? AND ?`;
        params.push(startDate, endDate);
      }

      if (categoryId) {
        baseQuery += ` AND er.category_id = ?`;
        params.push(categoryId);
      }

      const listQuery = baseQuery + ` ORDER BY er.expense_date DESC LIMIT ? OFFSET ?`;
      const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery})`;

      // Params for list query need limit/offset at the end
      const listParams = [...params, limit, offset];
      
      const [list, countRes] = await Promise.all([
        runQuery(listQuery, listParams),
        getRow(countQuery, params) // Re-use params without limit/offset
      ]);

      return {
        success: true,
        data: list,
        total: countRes.total,
        page,
        limit
      };

    } catch (error) {
      console.error('❌ Get expense list error:', error);
      return { success: false, message: 'Failed to fetch expense list' };
    }
  });

  console.log('✅ Expense Report IPC handlers registered');
}
