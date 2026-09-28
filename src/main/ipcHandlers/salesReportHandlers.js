import { ipcMain } from 'electron';

let globalDb = null;

export function initializeSalesReportHandlers(db) {
  globalDb = db;

  // Helper to convert DD-MM-YYYY to YYYY-MM-DD for database querying
  const formatDateForDb = (dateStr) => {
    if (!dateStr) return dateStr;
    // Check if already in YYYY-MM-DD format
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
    
    // Convert DD-MM-YYYY to YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  // Get sales summary statistics
  ipcMain.handle('sales-report:get-summary', async (event, { startDate, endDate }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);
      
      const summary = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT 
            COUNT(*) as totalOrders,
            SUM(grand_total) as totalRevenue,
            AVG(grand_total) as averageOrderValue,
            SUM(
              (SELECT SUM(quantity) FROM sales_order_items WHERE order_id = sales_orders.id)
            ) as totalItems
          FROM sales_orders
          WHERE date(order_date) BETWEEN ? AND ?
          AND status NOT IN ('cancelled', 'returned')`,
          [dbStartDate, dbEndDate],
          (err, row) => {
            if (err) {
              console.error('❌ Get summary error:', err.message);
              reject(err);
            } else {
              resolve({
                totalOrders: row.totalOrders || 0,
                totalRevenue: row.totalRevenue || 0,
                averageOrderValue: row.averageOrderValue || 0,
                totalItems: row.totalItems || 0
              });
            }
          }
        );
      });

      return { success: true, data: summary };
    } catch (error) {
      console.error('❌ Get summary error:', error);
      return { success: false, message: 'Failed to fetch summary' };
    }
  });

  // Get daily sales trend
  ipcMain.handle('sales-report:get-daily-sales', async (event, { startDate, endDate }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);

      const dailySales = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT 
            date(order_date) as date,
            COUNT(*) as orders,
            SUM(grand_total) as revenue
          FROM sales_orders
          WHERE date(order_date) BETWEEN ? AND ?
          AND status NOT IN ('cancelled', 'returned')
          GROUP BY date(order_date)
          ORDER BY date(order_date) ASC`,
          [dbStartDate, dbEndDate],
          (err, rows) => {
            if (err) {
              console.error('❌ Get daily sales error:', err.message);
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      return { success: true, data: dailySales };
    } catch (error) {
      console.error('❌ Get daily sales error:', error);
      return { success: false, message: 'Failed to fetch daily sales' };
    }
  });

  // Get top products
  ipcMain.handle('sales-report:get-top-products', async (event, { startDate, endDate, limit = 10 }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);

      const topProducts = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT 
            soi.product_name as name,
            SUM(soi.quantity) as quantity,
            SUM(soi.final_amount) as revenue
          FROM sales_order_items soi
          JOIN sales_orders so ON soi.order_id = so.id
          WHERE date(so.order_date) BETWEEN ? AND ?
          AND so.status NOT IN ('cancelled', 'returned')
          GROUP BY soi.product_id, soi.product_name
          ORDER BY revenue DESC
          LIMIT ?`,
          [dbStartDate, dbEndDate, limit],
          (err, rows) => {
            if (err) {
              console.error('❌ Get top products error:', err.message);
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      return { success: true, data: topProducts };
    } catch (error) {
      console.error('❌ Get top products error:', error);
      return { success: false, message: 'Failed to fetch top products' };
    }
  });

  // Get category breakdown
  ipcMain.handle('sales-report:get-category-breakdown', async (event, { startDate, endDate }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);

      const categoryBreakdown = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT 
            soi.category as name,
            SUM(soi.final_amount) as value,
            COUNT(DISTINCT soi.order_id) as orders
          FROM sales_order_items soi
          JOIN sales_orders so ON soi.order_id = so.id
          WHERE date(so.order_date) BETWEEN ? AND ?
          AND so.status NOT IN ('cancelled', 'returned')
          AND soi.category IS NOT NULL AND soi.category != ''
          GROUP BY soi.category
          ORDER BY value DESC`,
          [dbStartDate, dbEndDate],
          (err, rows) => {
            if (err) {
              console.error('❌ Get category breakdown error:', err.message);
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      return { success: true, data: categoryBreakdown };
    } catch (error) {
      console.error('❌ Get category breakdown error:', error);
      return { success: false, message: 'Failed to fetch category breakdown' };
    }
  });

  // Get payment method breakdown
  ipcMain.handle('sales-report:get-payment-breakdown', async (event, { startDate, endDate }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);

      const paymentBreakdown = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT 
            payment_method as name,
            COUNT(*) as count,
            SUM(grand_total) as value
          FROM sales_orders
          WHERE date(order_date) BETWEEN ? AND ?
          AND status NOT IN ('cancelled', 'returned')
          GROUP BY payment_method
          ORDER BY value DESC`,
          [dbStartDate, dbEndDate],
          (err, rows) => {
            if (err) {
              console.error('❌ Get payment breakdown error:', err.message);
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      return { success: true, data: paymentBreakdown };
    } catch (error) {
      console.error('❌ Get payment breakdown error:', error);
      return { success: false, message: 'Failed to fetch payment breakdown' };
    }
  });

  // Get detailed sales list with pagination and filters
  ipcMain.handle('sales-report:get-detailed-sales', async (event, { startDate, endDate, searchTerm = '', page = 1, pageSize = 25 }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);
      const offset = (page - 1) * pageSize;
      
      // Build WHERE clause
      let whereClause = `WHERE date(so.order_date) BETWEEN ? AND ? AND so.status NOT IN ('cancelled', 'returned')`;
      const params = [dbStartDate, dbEndDate];
      
      if (searchTerm) {
        whereClause += ` AND (so.order_number LIKE ? OR so.customer_name LIKE ?)`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      // Get total count
      const totalCount = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT COUNT(*) as count 
           FROM sales_orders so 
           ${whereClause}`,
          params,
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count || 0);
          }
        );
      });

      // Get paginated data
      const sales = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT 
            so.id,
            so.order_number,
            so.order_date,
            so.order_time,
            so.customer_name,
            so.customer_phone,
            (SELECT COUNT(*) FROM sales_order_items WHERE order_id = so.id) as itemCount,
            so.subtotal,
            so.discount_total,
            so.tax_total,
            so.grand_total,
            so.payment_method,
            so.payment_status,
            so.status
          FROM sales_orders so
          ${whereClause}
          ORDER BY so.order_date DESC, so.order_time DESC
          LIMIT ? OFFSET ?`,
          [...params, pageSize, offset],
          (err, rows) => {
            if (err) {
              console.error('❌ Get detailed sales error:', err.message);
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      return { 
        success: true, 
        data: {
          sales,
          totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize)
        }
      };
    } catch (error) {
      console.error('❌ Get detailed sales error:', error);
      return { success: false, message: 'Failed to fetch detailed sales' };
    }
  });

  console.log('✅ Sales Report IPC handlers registered');
}
