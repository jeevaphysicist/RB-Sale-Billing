import { ipcMain } from 'electron';

let globalDb = null;

export function initializeExpenseHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for expense handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Expense handlers initialized with database:', !!db);

  // Log all registered handlers
  const handlers = [
    'expense:create',
    'expense:get-all',
    'expense:get-by-id',
    'expense:update',
    'expense:delete'
  ];
  
  console.log('📋 Registered expense handlers:', handlers);

  // Expenses CRUD Operations
  ipcMain.handle('expense:create', async (event, expenseData) => {
    try {
      console.log('📥 Creating expense with data:', expenseData);
      const { name, description, status = 'active' } = expenseData;

      if (!name) {
        return { success: false, message: 'Expense name is required' };
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `INSERT INTO expenses (name, type, description, status) VALUES (?, 'expense', ?, ?)`,
          [name, description || null, status],
          function(err) {
            if (err) {
              console.error('❌ Create expense error:', err.message);
              reject(err);
            } else {
              console.log('✅ Expense created with ID:', this.lastID);
              resolve({ id: this.lastID });
            }
          }
        );
      });

      return { 
        success: true, 
        message: 'Expense created successfully',
        expenseId: result.id 
      };
    } catch (error) {
      console.error('❌ Create expense error:', error);
      return { success: false, message: 'Failed to create expense' };
    }
  });

  ipcMain.handle('expense:get-all', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting expenses with filter params:', filterParams);
      const { searchTerm, sortKey = 'name', sortDirection = 'ASC', page = 1, limit = 10 } = filterParams;
      const offset = (page - 1) * limit;
      
      // Validate sortKey to prevent SQL injection
      const validSortKeys = ['id', 'name', 'type', 'status', 'created_at', 'updated_at'];
      const safeSortKey = validSortKeys.includes(sortKey) ? sortKey : 'name';
      const safeSortDirection = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      
      let query = `SELECT * FROM expenses WHERE type = 'expense'`;
      let countQuery = `SELECT COUNT(*) as total FROM expenses WHERE type = 'expense'`;
      const params = [];
      const countParams = [];
      
      // Add search filter
      if (searchTerm) {
        const searchCondition = ` AND (name LIKE ? OR description LIKE ?)`;
        query += searchCondition;
        countQuery += searchCondition;
        const searchParam = `%${searchTerm}%`;
        params.push(searchParam, searchParam);
        countParams.push(searchParam, searchParam);
      }
      
      // Add sorting
      query += ` ORDER BY ${safeSortKey} ${safeSortDirection}`;
      
      // Add pagination
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      // Get total count
      const countResult = await new Promise((resolve, reject) => {
        globalDb.get(countQuery, countParams, (err, row) => {
          if (err) {
            console.error('Error getting total count:', err);
            reject(err);
          } else {
            resolve(row.total);
          }
        });
      });

      // Get paginated results
      const expenses = await new Promise((resolve, reject) => {
        globalDb.all(query, params, (err, rows) => {
          if (err) {
            console.error('Error fetching expenses:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });

      return {
        success: true,
        data: expenses,
        total: countResult,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      };
    } catch (error) {
      console.error('❌ Get expenses error:', error);
      return { success: false, message: 'Failed to fetch expenses', error: error.message };
    }
  });

  ipcMain.handle('expense:get-by-id', async (event, expenseId) => {
    try {
      if (!expenseId) {
        return { success: false, message: 'Expense ID is required' };
      }

      const expense = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT * FROM expenses WHERE id = ? AND type = 'expense'`,
          [expenseId],
          (err, row) => {
            if (err) {
              console.error('❌ Get expense error:', err.message);
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (!expense) {
        return { success: false, message: 'Expense not found' };
      }

      return { success: true, expense };
    } catch (error) {
      console.error('❌ Get expense error:', error);
      return { success: false, message: 'Failed to fetch expense' };
    }
  });

  ipcMain.handle('expense:update', async (event, expenseData) => {
    try {
      const { id, name, description, status } = expenseData;

      if (!id) {
        return { success: false, message: 'Expense ID is required' };
      }

      if (!name) {
        return { success: false, message: 'Expense name is required' };
      }
      if (!status) {
        return { success: false, message: 'Expense status is required' };
      }

      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE expenses SET name = ?, description = ?, status = ?, updated_at = datetime('now', '+5 hours', '30 minutes') WHERE id = ? AND type = 'expense'`,
          [name, description, status, id],
          (err) => {
            if (err) {
              console.error('❌ Update expense error:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      return { success: true, message: 'Expense updated successfully' };
    } catch (error) {
      console.error('❌ Update expense error:', error);
      return { success: false, message: 'Failed to update expense' };
    }
  });

  ipcMain.handle('expense:delete', async (event, expenseId) => {
    try {
      if (!expenseId) {
        return { success: false, message: 'Expense ID is required' };
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `DELETE FROM expenses WHERE id = ? AND type = 'expense'`,
          [expenseId],
          function(err) {
            if (err) {
              console.error('❌ Delete expense error:', err.message);
              reject(err);
            } else {
              if (this.changes === 0) {
                resolve({ success: false, message: 'Expense not found' });
              } else {
                console.log(`✅ Expense ${expenseId} deleted successfully`);
                resolve({ success: true, message: 'Expense deleted successfully' });
              }
            }
          }
        );
      });

      return result;
    } catch (error) {
      console.error('❌ Delete expense error:', error);
      return { 
        success: false, 
        message: error.message.includes('FOREIGN KEY') 
          ? 'Cannot delete expense as it is being used by other records' 
          : 'Failed to delete expense' 
      };
    }
  });

  console.log('✅ Expense IPC handlers registered');
}
