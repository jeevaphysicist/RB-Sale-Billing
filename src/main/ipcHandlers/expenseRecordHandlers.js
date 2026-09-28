import { ipcMain } from 'electron';

let globalDb = null;

export function initializeExpenseRecordHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for expense record handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Expense record handlers initialized');

  // Log all registered handlers
  const handlers = [
    'expense-record:create',
    'expense-record:get-all',
    'expense-record:get-by-id',
    'expense-record:update',
    'expense-record:delete',
    'expense-record:get-next-number'
  ];
  
  console.log('📋 Registered expense record handlers:', handlers);

  // Helper to generate next expense number
  const generateExpenseNumber = async () => {
    return new Promise((resolve, reject) => {
      const currentYear = new Date().getFullYear();
      globalDb.get(
        `SELECT expense_number FROM expense_records WHERE expense_number LIKE ? ORDER BY id DESC LIMIT 1`,
        [`EXP-${currentYear}-%`],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            let nextNum = 1;
            if (row && row.expense_number) {
              const parts = row.expense_number.split('-');
              const lastNum = parseInt(parts[2], 10);
              if (!isNaN(lastNum)) {
                nextNum = lastNum + 1;
              }
            }
            resolve(`EXP-${currentYear}-${String(nextNum).padStart(3, '0')}`);
          }
        }
      );
    });
  };

  // Get Next Expense Number
  ipcMain.handle('expense-record:get-next-number', async () => {
    try {
      const nextNumber = await generateExpenseNumber();
      return { success: true, data: nextNumber };
    } catch (error) {
      console.error('❌ Get next expense number error:', error);
      return { success: false, message: 'Failed to generate expense number' };
    }
  });

  // Create Expense Record
  ipcMain.handle('expense-record:create', async (event, expenseData) => {
    try {
      console.log('📥 Creating expense record with data:', expenseData);
      const { 
        expense_date, 
        category_id, 
        amount, 
        payment_mode, 
        reference_number, 
        paid_by, 
        description,
        status = 'Active'
      } = expenseData;

      if (!expense_date || !category_id || !amount) {
        return { success: false, message: 'Date, Category, and Amount are required' };
      }

      const expense_number = await generateExpenseNumber();

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `INSERT INTO expense_records (
            expense_number, expense_date, category_id, amount, 
            payment_mode, reference_number, paid_by, description, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            expense_number, expense_date, category_id, amount,
            payment_mode, reference_number, paid_by, description, status
          ],
          function(err) {
            if (err) {
              console.error('❌ Create expense record error:', err.message);
              reject(err);
            } else {
              console.log('✅ Expense record created with ID:', this.lastID);
              resolve({ id: this.lastID });
            }
          }
        );
      });

      return { 
        success: true, 
        message: 'Expense record created successfully',
        data: { id: result.id, expense_number }
      };
    } catch (error) {
      console.error('❌ Create expense record error:', error);
      return { success: false, message: 'Failed to create expense record' };
    }
  });

  // Get All Expense Records
  ipcMain.handle('expense-record:get-all', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting expense records with filter params:', filterParams);
      const { 
        searchTerm, 
        startDate,
        endDate,
        categoryId,
        sortKey = 'expense_date', 
        sortDirection = 'DESC', 
        page = 1, 
        limit = 10 
      } = filterParams;
      
      const offset = (page - 1) * limit;
      
      // Validate sortKey
      const validSortKeys = ['id', 'expense_number', 'expense_date', 'amount', 'created_at'];
      const safeSortKey = validSortKeys.includes(sortKey) ? `er.${sortKey}` : 'er.expense_date';
      const safeSortDirection = sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      let query = `
        SELECT er.*, e.name as category_name 
        FROM expense_records er
        LEFT JOIN expenses e ON er.category_id = e.id
        WHERE 1=1
      `;
      
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM expense_records er
        LEFT JOIN expenses e ON er.category_id = e.id
        WHERE 1=1
      `;
      
      const params = [];
      const countParams = [];
      
      // Add search filter
      if (searchTerm) {
        const searchCondition = ` AND (er.expense_number LIKE ? OR er.description LIKE ? OR er.paid_by LIKE ? OR e.name LIKE ?)`;
        query += searchCondition;
        countQuery += searchCondition;
        const searchParam = `%${searchTerm}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
        countParams.push(searchParam, searchParam, searchParam, searchParam);
      }

      // Date Range Filter
      if (startDate && endDate) {
        const dateCondition = ` AND er.expense_date BETWEEN ? AND ?`;
        query += dateCondition;
        countQuery += dateCondition;
        params.push(startDate, endDate);
        countParams.push(startDate, endDate);
      }

      // Category Filter
      if (categoryId) {
        const catCondition = ` AND er.category_id = ?`;
        query += catCondition;
        countQuery += catCondition;
        params.push(categoryId);
        countParams.push(categoryId);
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
      console.error('❌ Get expense records error:', error);
      return { success: false, message: 'Failed to fetch expense records', error: error.message };
    }
  });

  // Get Expense Record by ID
  ipcMain.handle('expense-record:get-by-id', async (event, id) => {
    try {
      if (!id) {
        return { success: false, message: 'ID is required' };
      }

      const expense = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT er.*, e.name as category_name 
           FROM expense_records er
           LEFT JOIN expenses e ON er.category_id = e.id
           WHERE er.id = ?`,
          [id],
          (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (!expense) {
        return { success: false, message: 'Expense record not found' };
      }

      return { success: true, data: expense };
    } catch (error) {
      console.error('❌ Get expense record error:', error);
      return { success: false, message: 'Failed to fetch expense record' };
    }
  });

  // Update Expense Record
  ipcMain.handle('expense-record:update', async (event, expenseData) => {
    try {
      const { 
        id, 
        expense_date, 
        category_id, 
        amount, 
        payment_mode, 
        reference_number, 
        paid_by, 
        description,
        status
      } = expenseData;

      if (!id) {
        return { success: false, message: 'ID is required' };
      }

      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE expense_records SET 
            expense_date = ?, category_id = ?, amount = ?, 
            payment_mode = ?, reference_number = ?, paid_by = ?, 
            description = ?, status = ?, updated_at = datetime('now', '+5 hours', '30 minutes')
           WHERE id = ?`,
          [
            expense_date, category_id, amount, 
            payment_mode, reference_number, paid_by, 
            description, status, id
          ],
          (err) => {
            if (err) {
              console.error('❌ Update expense record error:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      return { success: true, message: 'Expense record updated successfully' };
    } catch (error) {
      console.error('❌ Update expense record error:', error);
      return { success: false, message: 'Failed to update expense record' };
    }
  });

  // Delete Expense Record
  ipcMain.handle('expense-record:delete', async (event, id) => {
    try {
      if (!id) {
        return { success: false, message: 'ID is required' };
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `DELETE FROM expense_records WHERE id = ?`,
          [id],
          function(err) {
            if (err) {
              console.error('❌ Delete expense record error:', err.message);
              reject(err);
            } else {
              if (this.changes === 0) {
                resolve({ success: false, message: 'Expense record not found' });
              } else {
                console.log(`✅ Expense record ${id} deleted successfully`);
                resolve({ success: true, message: 'Expense record deleted successfully' });
              }
            }
          }
        );
      });

      return result;
    } catch (error) {
      console.error('❌ Delete expense record error:', error);
      return { success: false, message: 'Failed to delete expense record' };
    }
  });
}
