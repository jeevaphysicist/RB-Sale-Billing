import { ipcMain } from 'electron';

export function initializeStockReportHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for stock report handlers');
    return;
  }

  // Get Stock Summary (Total Items, Value, Low/Out Stock)
  ipcMain.handle('stock-report:get-summary', async (event, filters = {}) => {
    try {
      const { categoryId } = filters;
      let query = `
        SELECT 
          COUNT(*) as total_items,
          SUM(current_stock * purchase_price) as total_value_cost,
          SUM(current_stock * selling_price) as total_value_sales,
          SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as out_of_stock,
          SUM(CASE WHEN current_stock > 0 AND current_stock <= reorder_level THEN 1 ELSE 0 END) as low_stock
        FROM products
        WHERE status = 'Active'
      `;

      const params = [];
      if (categoryId && categoryId !== 'all') {
        query += ` AND category_id = ?`;
        params.push(categoryId);
      }

      return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
          if (err) {
            console.error('Error fetching stock summary:', err);
            reject(err);
          } else {
            resolve({
              success: true,
              data: {
                totalItems: row.total_items || 0,
                totalValueCost: row.total_value_cost || 0,
                totalValueSales: row.total_value_sales || 0,
                outOfStock: row.out_of_stock || 0,
                lowStock: row.low_stock || 0
              }
            });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get stock summary error:', error);
      return { success: false, message: 'Failed to fetch stock summary' };
    }
  });

  // Get Category Breakdown
  ipcMain.handle('stock-report:get-category-breakdown', async (event, filters = {}) => {
    try {
      const query = `
        SELECT 
          c.name as category_name,
          COUNT(p.id) as product_count,
          SUM(p.current_stock) as total_stock,
          SUM(p.current_stock * p.purchase_price) as stock_value
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'Active'
        GROUP BY p.category_id
        ORDER BY stock_value DESC
      `;

      return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) {
            console.error('Error fetching category breakdown:', err);
            reject(err);
          } else {
            resolve({ success: true, data: rows || [] });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get category breakdown error:', error);
      return { success: false, message: 'Failed to fetch category breakdown' };
    }
  });

  // Get Stock List with Pagination and Filters
  ipcMain.handle('stock-report:get-stock-list', async (event, filters = {}) => {
    try {
      const { page = 1, limit = 20, searchTerm, status, categoryId, stockStatus, sortBy = 'product_name', sortOrder = 'ASC' } = filters;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          p.id, p.product_name, p.product_code, p.category_id, p.unit,
          p.current_stock, p.reorder_level, p.purchase_price, p.selling_price,
          (p.current_stock * p.purchase_price) as total_value,
          c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'Active'
      `;

      const params = [];

      if (searchTerm) {
        query += ` AND (p.product_name LIKE ? OR p.product_code LIKE ?)`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      if (categoryId && categoryId !== 'all') {
        query += ` AND p.category_id = ?`;
        params.push(categoryId);
      }

      if (stockStatus === 'low') {
        query += ` AND p.current_stock > 0 AND p.current_stock <= p.reorder_level`;
      } else if (stockStatus === 'out') {
        query += ` AND p.current_stock <= 0`;
      } else if (stockStatus === 'available') {
        query += ` AND p.current_stock > p.reorder_level`;
      }

      // Sorting
      const allowedSorts = ['product_name', 'current_stock', 'total_value'];
      const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : 'product_name';
      const safeSortOrder = sortOrder === 'DESC' ? 'DESC' : 'ASC';
      
      query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;
      
      // Pagination
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      // Total count query for pagination
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM products p 
        WHERE p.status = 'Active'
      `;
      const countParams = [];

      if (searchTerm) {
        countQuery += ` AND (p.product_name LIKE ? OR p.product_code LIKE ?)`;
        countParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }
      if (categoryId && categoryId !== 'all') {
        countQuery += ` AND p.category_id = ?`;
        countParams.push(categoryId);
      }
      if (stockStatus === 'low') {
        countQuery += ` AND p.current_stock > 0 AND p.current_stock <= p.reorder_level`;
      } else if (stockStatus === 'out') {
        countQuery += ` AND p.current_stock <= 0`;
      } else if (stockStatus === 'available') {
        countQuery += ` AND p.current_stock > p.reorder_level`;
      }

      const [products, countResult] = await Promise.all([
        new Promise((resolve, reject) => {
          db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        }),
        new Promise((resolve, reject) => {
          db.get(countQuery, countParams, (err, row) => {
            if (err) reject(err);
            else resolve(row?.total || 0);
          });
        })
      ]);

      return {
        success: true,
        data: products,
        pagination: {
          total: countResult,
          page,
          limit,
          totalPages: Math.ceil(countResult / limit)
        }
      };

    } catch (error) {
      console.error('❌ Get stock list error:', error);
      return { success: false, message: 'Failed to fetch stock list' };
    }
  });

  console.log('✅ Stock Report handlers initialized');
}
