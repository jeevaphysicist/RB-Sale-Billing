import { ipcMain } from 'electron';

let globalDb = null;

export function initializeProductPerformanceReportHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for product performance report handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Product Performance Report handlers initialized');

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

  // Get Summary (Total Inventory Value, Total Items Sold, Top Product)
  ipcMain.handle('product-performance:get-summary', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting product performance summary:', filterParams);
      const { startDate, endDate } = filterParams;
      const dateFilter = startDate && endDate ? `AND date(so.order_date) BETWEEN ? AND ?` : '';
      const dateParams = startDate && endDate ? [startDate, endDate] : [];

      // 1. Total Inventory Valuation (Current Stock * Purchase Price)
      const inventoryQuery = `
        SELECT SUM(current_stock * purchase_price) as total_value
        FROM products
        WHERE status = 'Active'
      `;

      // 2. Total Revenue from Sales (Period)
      const revenueQuery = `
         SELECT SUM(soi.final_amount) as total_revenue, SUM(soi.quantity) as total_units
         FROM sales_order_items soi
         JOIN sales_orders so ON soi.order_id = so.id
         WHERE so.status != 'Cancelled' ${dateFilter}
      `;

      // 3. Top Selling Product by Revenue (Period)
      const topProductQuery = `
        SELECT p.product_name, SUM(soi.final_amount) as revenue
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.order_id = so.id
        JOIN products p ON soi.product_id = p.id
        WHERE so.status != 'Cancelled' ${dateFilter}
        GROUP BY soi.product_id
        ORDER BY revenue DESC
        LIMIT 1
      `;

      const [invRes, revRes, topRes] = await Promise.all([
        getRow(inventoryQuery),
        getRow(revenueQuery, dateParams),
        getRow(topProductQuery, dateParams)
      ]);

      return {
        success: true,
        data: {
          inventoryValue: invRes.total_value || 0,
          periodRevenue: revRes.total_revenue || 0,
          periodUnits: revRes.total_units || 0,
          topProduct: topRes || { product_name: 'N/A', revenue: 0 }
        }
      };
    } catch (error) {
      console.error('❌ Get product performance summary error:', error);
      return { success: false, message: 'Failed to fetch summary' };
    }
  });

  // Get Top Selling Products (Chart Data)
  ipcMain.handle('product-performance:get-top-products', async (event, filterParams = {}) => {
    try {
      const { startDate, endDate, limit = 5, sortBy = 'revenue' } = filterParams;
      const dateFilter = startDate && endDate ? `AND date(so.order_date) BETWEEN ? AND ?` : '';
      const dateParams = startDate && endDate ? [startDate, endDate] : [];
      const sortColumn = sortBy === 'quantity' ? 'units_sold' : 'revenue';

      const query = `
        SELECT 
          p.product_name as name,
          SUM(soi.final_amount) as revenue,
          SUM(soi.quantity) as units_sold
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.order_id = so.id
        JOIN products p ON soi.product_id = p.id
        WHERE so.status != 'Cancelled' ${dateFilter}
        GROUP BY soi.product_id
        ORDER BY ${sortColumn} DESC
        LIMIT ?
      `;

      const data = await runQuery(query, [...dateParams, limit]);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Get top products error:', error);
      return { success: false, message: 'Failed to fetch top products' };
    }
  });

  // Get Detailed Product Performance List
  ipcMain.handle('product-performance:get-list', async (event, filterParams = {}) => {
    try {
      const { page = 1, limit = 10, searchTerm, startDate, endDate, sortBy = 'revenue', sortDirection = 'DESC' } = filterParams;
      const offset = (page - 1) * limit;

      // Base: All active products, left joined with sales data in period
      // Note: We want even products with 0 sales to show (if filtered by search), 
      // but typically "Performance" implies checking active movements. 
      // If we want ALL products, we start FROM products.

      let dateCondition = '';
      const dateParams = [];
      if (startDate && endDate) {
        dateCondition = `AND date(so.order_date) BETWEEN ? AND ?`;
        dateParams.push(startDate, endDate);
      }

      let baseQuery = `
        SELECT 
          p.id,
          p.product_name,
          p.product_code,
          p.current_stock,
          p.unit,
          COALESCE(sales.revenue, 0) as revenue,
          COALESCE(sales.units_sold, 0) as units_sold,
          COALESCE(sales.orders_count, 0) as orders_count
        FROM products p
        LEFT JOIN (
          SELECT 
            soi.product_id,
            SUM(soi.final_amount) as revenue,
            SUM(soi.quantity) as units_sold,
            COUNT(DISTINCT soi.order_id) as orders_count
          FROM sales_order_items soi
          JOIN sales_orders so ON soi.order_id = so.id
          WHERE so.status != 'Cancelled' ${dateCondition}
          GROUP BY soi.product_id
        ) sales ON p.id = sales.product_id
        WHERE p.status = 'Active'
      `;
      
      const params = [];

      if (searchTerm) {
        baseQuery += ` AND (p.product_name LIKE ? OR p.product_code LIKE ?)`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      // Safe Sort
      const validSorts = ['product_name', 'current_stock', 'revenue', 'units_sold'];
      const safeSort = validSorts.includes(sortBy) ? sortBy : 'revenue';
      const safeDir = sortDirection === 'ASC' ? 'ASC' : 'DESC';

      const listQuery = baseQuery + ` ORDER BY ${safeSort} ${safeDir} LIMIT ? OFFSET ?`;
      const countQuery = `SELECT COUNT(*) as total FROM products p WHERE p.status = 'Active' ` + 
        (searchTerm ? `AND (p.product_name LIKE ? OR p.product_code LIKE ?)` : '');
      
      // For count params, we only need search terms if they exist
      const countParams = searchTerm ? [`%${searchTerm}%`, `%${searchTerm}%`] : [];
      const listParams = [...dateParams, ...params, limit, offset];

      const [list, countRes] = await Promise.all([
        runQuery(listQuery, listParams),
        getRow(countQuery, countParams)
      ]);

      return {
        success: true,
        data: list,
        total: countRes.total,
        page,
        limit
      };

    } catch (error) {
      console.error('❌ Get product performance list error:', error);
      return { success: false, message: 'Failed to fetch product list' };
    }
  });

  console.log('✅ Product Performance Report IPC handlers registered');
}
