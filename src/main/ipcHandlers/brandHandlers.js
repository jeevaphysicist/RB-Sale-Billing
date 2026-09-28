import { ipcMain } from 'electron';

let globalDb = null;

export function initializeBrandHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for brand handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Brand handlers initialized with database');

  // Create a new brand
  ipcMain.handle('brand:create', async (event, brandData) => {
    try {
      const { name, description, website, status = 'active' } = brandData;

      if (!name) {
        return { success: false, message: 'Brand name is required' };
      }

      const existingBrand = await new Promise((resolve, reject) => {
        globalDb.get('SELECT * FROM brands WHERE name = ?', [name], (err, row) => {
          if (err) reject(err);
          resolve(row);
        });
      });

      if (existingBrand) {
        return { success: false, message: 'Brand name already exists' };
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `INSERT INTO brands (name, description, website, status) 
           VALUES (?, ?, ?, ?)`, 
          [name, description || null, website || null, status],
          function(err) {
            if (err) {
              console.error('❌ Create brand error:', err.message);
              reject(err);
            } else {
              resolve({ id: this.lastID });
            }
          }
        );
      });

      return { 
        success: true, 
        message: 'Brand created successfully',
        brandId: result.id 
      };
    } catch (error) {
      console.error('❌ Create brand error:', error);
      return { success: false, message: 'Failed to create brand' };
    }
  });

  // Get all brands with pagination and search
  ipcMain.handle('brand:get-all', async (event, filterParams = {}) => {
    try {
      const { searchTerm, sortKey = 'name', sortDirection = 'ASC', page = 1, limit = 10 } = filterParams;
      const offset = (page - 1) * limit;
      
      // Validate sortKey to prevent SQL injection
      const validSortKeys = ['id', 'name', 'website', 'status', 'created_at', 'updated_at'];
      const safeSortKey = validSortKeys.includes(sortKey) ? sortKey : 'name';
      const safeSortDirection = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      
      let query = `SELECT * FROM brands`;
      const params = [];
      
      // Add search filter
      if (searchTerm) {
        query += ` WHERE name LIKE ? OR description LIKE ? OR website LIKE ?`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }
      
      // Add sorting
      query += ` ORDER BY ${safeSortKey} ${safeSortDirection}`;
      
      // Add pagination
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      const brands = await new Promise((resolve, reject) => {
        globalDb.all(query, params, (err, rows) => {
          if (err) {
            console.error('❌ Get brands error:', err.message);
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
      
      // Get total count for pagination
      let countQuery = `SELECT COUNT(*) as count FROM brands`;
      const countParams = [];
      
      if (searchTerm) {
        countQuery += ` WHERE name LIKE ? OR description LIKE ? OR website LIKE ?`;
        countParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }
      
      const totalCount = await new Promise((resolve, reject) => {
        globalDb.get(countQuery, countParams, (err, row) => {
          if (err) {
            console.error('❌ Get brands count error:', err.message);
            reject(err);
          } else {
            resolve(row.count);
          }
        });
      });

      return { success: true, brands, totalCount, page, limit };
    } catch (error) {
      console.error('❌ Get brands error:', error);
      return { success: false, message: 'Failed to fetch brands' };
    }
  });

  // Get brand by ID
  ipcMain.handle('brand:get-by-id', async (event, brandId) => {
    try {
      if (!brandId) {
        return { success: false, message: 'Brand ID is required' };
      }

      const brand = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT * FROM brands WHERE id = ?`,
          [brandId],
          (err, row) => {
            if (err) {
              console.error('❌ Get brand error:', err.message);
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (!brand) {
        return { success: false, message: 'Brand not found' };
      }

      return { success: true, brand };
    } catch (error) {
      console.error('❌ Get brand error:', error);
      return { success: false, message: 'Failed to fetch brand' };
    }
  });

  // Update brand
  ipcMain.handle('brand:update', async (event, brandData) => {
    try {
      const { id, name, description, website, status } = brandData;

      if (!id) {
        return { success: false, message: 'Brand ID is required' };
      }

      if (name) {
        const existingBrand = await new Promise((resolve, reject) => {
          globalDb.get('SELECT * FROM brands WHERE name = ? AND id != ?', [name, id], (err, row) => {
            if (err) reject(err);
            resolve(row);
          });
        });

        if (existingBrand) {
          return { success: false, message: 'Brand name already exists' };
        }
      }

      const setClauses = [];
      const params = [];

      if (name) {
        setClauses.push('name = ?');
        params.push(name);
      }
      if (description) {
        setClauses.push('description = ?');
        params.push(description);
      }
      if (website) {
        setClauses.push('website = ?');
        params.push(website);
      }
      if (status) {
        setClauses.push('status = ?');
        params.push(status);
      }

      if (setClauses.length === 0) {
        return { success: false, message: 'No fields to update' };
      }

      setClauses.push("updated_at = datetime('now', '+5 hours', '30 minutes')");

      const query = `UPDATE brands SET ${setClauses.join(', ')} WHERE id = ?`;
      params.push(id);

      await new Promise((resolve, reject) => {
        globalDb.run(query, params, function(err) {
          if (err) {
            console.error('❌ Update brand error:', err.message);
            reject(err);
          } else {
            resolve();
          }
        });
      });

      return { success: true, message: 'Brand updated successfully' };
    } catch (error) {
      console.error('❌ Update brand error:', error);
      return { success: false, message: 'Failed to update brand' };
    }
  });

  // Delete brand
  ipcMain.handle('brand:delete', async (event, brandId) => {
    try {
      if (!brandId) {
        return { success: false, message: 'Brand ID is required' };
      }

      await new Promise((resolve, reject) => {
        globalDb.run(
          `DELETE FROM brands WHERE id = ?`,
          [brandId],
          (err) => {
            if (err) {
              console.error('❌ Delete brand error:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      return { success: true, message: 'Brand deleted successfully' };
    } catch (error) {
      console.error('❌ Delete brand error:', error);
      return { success: false, message: 'Failed to delete brand' };
    }
  });

  console.log('✅ Brand IPC handlers registered');
}
