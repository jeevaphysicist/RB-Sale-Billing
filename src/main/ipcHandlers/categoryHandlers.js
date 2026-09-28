import { ipcMain } from 'electron';

let globalDb = null;

export function initializeCategoryHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for category handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Category handlers initialized with database:', !!db);

  // Log all registered handlers
  const handlers = [
    'category:create',
    'category:get-all',
    'category:get-by-id',
    'category:update',
    'category:delete'
  ];
  
  console.log('📋 Registered category handlers:', handlers);

  // Categories CRUD Operations
  ipcMain.handle('category:create', async (event, categoryData) => {
    try {
      console.log('📥 Creating category with data:', categoryData);
      const { name, icon, description, status } = categoryData;
      const finalStatus = status || 'active';

      if (!name) {
        return { success: false, message: 'Category name is required' };
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `INSERT INTO categories (name, icon, description, status) VALUES (?, ?, ?, ?)`,
          [name, icon, description, finalStatus],
          function(err) {
            if (err) {
              console.error('❌ Create category error:', err.message);
              reject(err);
            } else {
              console.log('✅ Category created with ID:', this.lastID);
              resolve({ id: this.lastID });
            }
          }
        );
      });

      return { 
        success: true, 
        message: 'Category created successfully',
        categoryId: result.id 
      };
    } catch (error) {
      console.error('❌ Create category error:', error);
      return { success: false, message: 'Failed to create category' };
    }
  });

  ipcMain.handle('category:get-all', async (event, filterParams = {}) => {
  try {
    console.log('📥 Getting categories with filter params:', filterParams);
    const { searchTerm, sortKey = 'name', sortDirection = 'ASC', page = 1, limit = 10 } = filterParams;
    const offset = (page - 1) * limit;
    
    // Validate sortKey to prevent SQL injection
    const validSortKeys = ['id', 'name', 'status', 'created_at', 'updated_at'];
    const safeSortKey = validSortKeys.includes(sortKey) ? sortKey : 'name';
    const safeSortDirection = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    let query = `SELECT * FROM categories`;
    let countQuery = `SELECT COUNT(*) as total FROM categories`;
    const params = [];
    const countParams = [];
    
    // Add search filter
    if (searchTerm) {
      const searchCondition = ` WHERE name LIKE ? OR description LIKE ?`;
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
    const categories = await new Promise((resolve, reject) => {
      globalDb.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error fetching categories:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });

    return {
      success: true,
      data: categories,
      total: countResult,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    };
  } catch (error) {
    console.error('❌ Get categories error:', error);
    return { success: false, message: 'Failed to fetch categories', error: error.message };
  }
});

  ipcMain.handle('category:get-by-id', async (event, categoryId) => {
    try {
      if (!categoryId) {
        return { success: false, message: 'Category ID is required' };
      }

      const category = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT * FROM categories WHERE id = ?`,
          [categoryId],
          (err, row) => {
            if (err) {
              console.error('❌ Get category error:', err.message);
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (!category) {
        return { success: false, message: 'Category not found' };
      }

      return { success: true, category };
    } catch (error) {
      console.error('❌ Get category error:', error);
      return { success: false, message: 'Failed to fetch category' };
    }
  });

  ipcMain.handle('category:update', async (event, categoryData) => {
    try {
      const { id, name, icon, description, status } = categoryData;

      if (!id) {
        return { success: false, message: 'Category ID is required' };
      }

      if (!name) {
        return { success: false, message: 'Category name is required' };
      }
      if (!status) {
        return { success: false, message: 'Category status is required' };
      }

      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE categories SET name = ?, icon = ?, description = ?, status = ?, updated_at = datetime('now', '+5 hours', '30 minutes') WHERE id = ?`,
          [name, icon, description, status, id],
          (err) => {
            if (err) {
              console.error('❌ Update category error:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      return { success: true, message: 'Category updated successfully' };
    } catch (error) {
      console.error('❌ Update category error:', error);
      return { success: false, message: 'Failed to update category' };
    }
  });

  ipcMain.handle('category:delete', async (event, categoryId) => {
    try {
      if (!categoryId) {
        return { success: false, message: 'Category ID is required' };
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `DELETE FROM categories WHERE id = ?`,
          [categoryId],
          function(err) {
            if (err) {
              console.error('❌ Delete category error:', err.message);
              reject(err);
            } else {
              if (this.changes === 0) {
                resolve({ success: false, message: 'Category not found' });
              } else {
                console.log(`✅ Category ${categoryId} deleted successfully`);
                resolve({ success: true, message: 'Category deleted successfully' });
              }
            }
          }
        );
      });

      return result;
    } catch (error) {
      console.error('❌ Delete category error:', error);
      return { 
        success: false, 
        message: error.message.includes('FOREIGN KEY') 
          ? 'Cannot delete category as it is being used by other records' 
          : 'Failed to delete category' 
      };
    }
  });

 
  console.log('✅ Category IPC handlers registered');
}