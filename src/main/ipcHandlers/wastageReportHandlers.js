import { ipcMain } from 'electron';

let globalDb = null;

export function initializeWastageReportHandlers(db) {
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

  // Get wastage report summary
  ipcMain.handle('wastage-report:get-summary', async (event, { startDate, endDate }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);
      
      const subquery = `
        SELECT 
          p.product_name,
          w.quantity,
          w.category,
          p.purchase_price as unit_price,
          date(w.wastage_date) as w_date
        FROM wastage w
        JOIN products p ON w.product_id = p.id
        UNION ALL
        SELECT 
          si.product_name,
          si.wastage_qty as quantity,
          'Sales Order' as category,
          p.purchase_price as unit_price,
          date(so.order_date) as w_date
        FROM sales_order_items si
        JOIN sales_orders so ON si.order_id = so.id
        JOIN products p ON si.product_id = p.id
        WHERE si.wastage_qty > 0
      `;

      const summary = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT 
            COUNT(*) as totalItems,
            SUM(qty) as totalWastageQty,
            SUM(val) as totalWastageValue
          FROM (
            SELECT 
              SUM(quantity) as qty,
              SUM(quantity * unit_price) as val
            FROM (${subquery})
            WHERE w_date BETWEEN ? AND ?
            GROUP BY product_name
          ) aggregated`,
          [dbStartDate, dbEndDate],
          (err, row) => {
            if (err) {
              console.error('❌ Get wastage summary error:', err.message);
              reject(err);
            } else {
              resolve({
                totalItems: row.totalItems || 0,
                totalWastageQty: row.totalWastageQty || 0,
                totalWastageValue: row.totalWastageValue || 0
              });
            }
          }
        );
      });

      return { success: true, data: summary };
    } catch (error) {
      console.error('❌ Get wastage summary error:', error);
      return { success: false, message: 'Failed to fetch wastage summary' };
    }
  });

  // Get detailed wastage report with pagination and filters
  ipcMain.handle('wastage-report:get-detailed', async (event, { startDate, endDate, searchTerm = '', page = 1, pageSize = 25 }) => {
    try {
      const dbStartDate = formatDateForDb(startDate);
      const dbEndDate = formatDateForDb(endDate);
      const offset = (page - 1) * pageSize;
      
      // Subquery to combine sources and standardize fields
      const subquery = `
        SELECT 
          date(w.wastage_date) as wastage_date,
          w.product_id,
          p.product_name,
          p.product_code,
          w.quantity,
          w.category,
          w.reason,
          w.created_by,
          p.purchase_price as unit_price
        FROM wastage w
        JOIN products p ON w.product_id = p.id
        UNION ALL
        SELECT 
          date(so.order_date) as wastage_date,
          si.product_id,
          si.product_name,
          si.product_code,
          si.wastage_qty as quantity,
          'Sales Order' as category,
          'Sales Order' as reason, -- Removed specific order number
          so.cashier_name as created_by,
          p.purchase_price as unit_price
        FROM sales_order_items si
        JOIN sales_orders so ON si.order_id = so.id
        JOIN products p ON si.product_id = p.id
        WHERE si.wastage_qty > 0
      `;

      // Wrapper query to group and filter
      let whereClause = `WHERE date(wastage_date) BETWEEN ? AND ?`;
      const params = [dbStartDate, dbEndDate];
      
      if (searchTerm) {
        whereClause += ` AND (product_name LIKE ? OR product_code LIKE ? OR reason LIKE ? OR category LIKE ?)`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }

      const baseQuery = `
        SELECT 
          MAX(wastage_date) as wastage_date,
          product_name,
          product_code,
          SUM(quantity) as wastage_qty,
          GROUP_CONCAT(DISTINCT category) as category,
          GROUP_CONCAT(DISTINCT reason) as reason,
          MAX(created_by) as created_by,
          MAX(unit_price) as unit_price,
          SUM(quantity * unit_price) as wastage_value
        FROM (${subquery})
        ${whereClause}
        GROUP BY product_name
      `;

      // Get total count for pagination
      const totalCount = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT COUNT(*) as count FROM (${baseQuery})`,
          params,
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count || 0);
          }
        );
      });

      // Get paginated data
      const items = await new Promise((resolve, reject) => {
        globalDb.all(
          `${baseQuery}
           ORDER BY wastage_date DESC, product_name ASC
           LIMIT ? OFFSET ?`,
          [...params, pageSize, offset],
          (err, rows) => {
            if (err) {
              console.error('❌ Get detailed wastage error:', err.message);
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
          items,
          totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize)
        }
      };
    } catch (error) {
      console.error('❌ Get detailed wastage error:', error);
      return { success: false, message: 'Failed to fetch detailed wastage report' };
    }
  });

  console.log('✅ Wastage Report IPC handlers registered');
}
