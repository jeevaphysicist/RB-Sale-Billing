import { ipcMain } from 'electron';

let globalDb = null;

export function initializePurchaseReportHandlers(db) {
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

  // Get purchase summary statistics
  ipcMain.handle('purchase-report:get-summary', async (event, { startDate, endDate }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);
      
      const summary = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT 
            COUNT(*) as totalOrders,
            SUM(net_payable) as totalSpend,
            AVG(net_payable) as averageOrderValue,
            SUM(
              (SELECT SUM(quantity) FROM purchase_order_items WHERE po_id = purchase_orders.id)
            ) as totalItems
          FROM purchase_orders
          WHERE po_date BETWEEN ? AND ?
          AND status != 'cancelled'`,
          [dbStartDate, dbEndDate],
          (err, row) => {
            if (err) {
              console.error('❌ Get purchase summary error:', err.message);
              reject(err);
            } else {
              resolve({
                totalOrders: row.totalOrders || 0,
                totalSpend: row.totalSpend || 0,
                averageOrderValue: row.averageOrderValue || 0,
                totalItems: row.totalItems || 0
              });
            }
          }
        );
      });

      return { success: true, data: summary };
    } catch (error) {
      console.error('❌ Get purchase summary error:', error);
      return { success: false, message: 'Failed to fetch purchase summary' };
    }
  });

  // Get daily purchase trend
  ipcMain.handle('purchase-report:get-daily-purchases', async (event, { startDate, endDate }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);

      const dailyPurchases = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT 
            po_date as date,
            COUNT(*) as orders,
            SUM(net_payable) as spend
          FROM purchase_orders
          WHERE po_date BETWEEN ? AND ?
          AND status != 'cancelled'
          GROUP BY po_date
          ORDER BY po_date ASC`,
          [dbStartDate, dbEndDate],
          (err, rows) => {
            if (err) {
              console.error('❌ Get daily purchases error:', err.message);
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      return { success: true, data: dailyPurchases };
    } catch (error) {
      console.error('❌ Get daily purchases error:', error);
      return { success: false, message: 'Failed to fetch daily purchases' };
    }
  });

  // Get top products purchased
  ipcMain.handle('purchase-report:get-top-products', async (event, { startDate, endDate, limit = 10 }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);

      const topProducts = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT 
            p.product_name as name,
            SUM(poi.quantity) as quantity,
            SUM(poi.amount) as spend
          FROM purchase_order_items poi
          JOIN purchase_orders po ON poi.po_id = po.id
          JOIN products p ON poi.product_id = p.id
          WHERE po.po_date BETWEEN ? AND ?
          AND po.status != 'cancelled'
          GROUP BY poi.product_id, p.product_name
          ORDER BY spend DESC
          LIMIT ?`,
          [dbStartDate, dbEndDate, limit],
          (err, rows) => {
            if (err) {
              console.error('❌ Get top purchased products error:', err.message);
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      return { success: true, data: topProducts };
    } catch (error) {
      console.error('❌ Get top purchased products error:', error);
      return { success: false, message: 'Failed to fetch top products' };
    }
  });

  // Get category breakdown
  ipcMain.handle('purchase-report:get-category-breakdown', async (event, { startDate, endDate }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);

      const categoryBreakdown = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT 
            c.name as name,
            SUM(poi.amount) as value,
            COUNT(DISTINCT poi.po_id) as orders
          FROM purchase_order_items poi
          JOIN purchase_orders po ON poi.po_id = po.id
          JOIN products p ON poi.product_id = p.id
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE po.po_date BETWEEN ? AND ?
          AND po.status != 'cancelled'
          AND c.name IS NOT NULL AND c.name != ''
          GROUP BY c.name
          ORDER BY value DESC`,
          [dbStartDate, dbEndDate],
          (err, rows) => {
            if (err) {
              console.error('❌ Get purchase category breakdown error:', err.message);
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      return { success: true, data: categoryBreakdown };
    } catch (error) {
      console.error('❌ Get purchase category breakdown error:', error);
      return { success: false, message: 'Failed to fetch category breakdown' };
    }
  });

  // Get payment method breakdown
  ipcMain.handle('purchase-report:get-payment-breakdown', async (event, { startDate, endDate }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);

      const paymentBreakdown = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT 
            payment_method as name,
            COUNT(*) as count,
            SUM(payment_amount) as value
          FROM payment_records
          WHERE record_type = 'purchase'
          AND payment_date BETWEEN ? AND ?
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

  // Get detailed purchase list with pagination and filters
  ipcMain.handle('purchase-report:get-detailed-purchases', async (event, { startDate, endDate, searchTerm = '', page = 1, pageSize = 25 }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);
      const offset = (page - 1) * pageSize;
      
      // Build WHERE clause
      let whereClause = `WHERE po.po_date BETWEEN ? AND ? AND po.status != 'cancelled'`;
      const params = [dbStartDate, dbEndDate];
      
      if (searchTerm) {
        whereClause += ` AND (po.po_number LIKE ? OR po.supplier_name LIKE ?)`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      // Get total count
      const totalCount = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT COUNT(*) as count 
           FROM purchase_orders po 
           ${whereClause}`,
          params,
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count || 0);
          }
        );
      });

      // Get paginated data
      const purchases = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT 
            po.id,
            po.po_number,
            po.po_date,
            po.supplier_name,
            po.contact_number,
            (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = po.id) as itemCount,
            (SELECT subtotal_without_tax FROM purchase_order_totals WHERE po_id = po.id) as subtotal,
            po.order_discount_type,
            po.order_discount,
            (SELECT order_discount_amount FROM purchase_order_totals WHERE po_id = po.id) as discount_amount,
            (SELECT total_tax FROM purchase_order_totals WHERE po_id = po.id) as tax_total,
            po.net_payable as grand_total,
            po.payment_terms,
            po.payment_status,
            po.status
          FROM purchase_orders po
          ${whereClause}
          ORDER BY po.po_date DESC
          LIMIT ? OFFSET ?`,
          [...params, pageSize, offset],
          (err, rows) => {
            if (err) {
              console.error('❌ Get detailed purchases error:', err.message);
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
          purchases,
          totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize)
        }
      };
    } catch (error) {
      console.error('❌ Get detailed purchases error:', error);
      return { success: false, message: 'Failed to fetch detailed purchases' };
    }
  });

  console.log('✅ Purchase Report IPC handlers registered');
}
