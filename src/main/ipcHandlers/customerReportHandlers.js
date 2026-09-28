import { ipcMain } from 'electron';

export function initializeCustomerReportHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for customer report handlers');
    return;
  }

  // Get Customer Report Summary
  ipcMain.handle('customer-report:get-summary', async (event, filters = {}) => {
    try {
      // 1. Total Customers
      // 2. Total Revenue (Net Sales)
      // 3. Total Outstanding (Receivables)
      const query = `
        SELECT 
          COUNT(DISTINCT c.id) as total_customers,
          SUM(so.grand_total) as total_revenue,
          SUM(so.balance_amount) as total_outstanding
        FROM customers c
        LEFT JOIN sales_orders so ON c.id = so.customer_id AND so.status NOT IN ('cancelled', 'returned')
        WHERE c.customer_status = 'Active'
      `;

      return new Promise((resolve, reject) => {
        db.get(query, [], (err, row) => {
          if (err) {
            console.error('Error fetching customer summary:', err);
            reject(err);
          } else {
            resolve({
              success: true,
              data: {
                totalCustomers: row.total_customers || 0,
                totalRevenue: row.total_revenue || 0,
                totalOutstanding: row.total_outstanding || 0
              }
            });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get customer summary error:', error);
      return { success: false, message: 'Failed to fetch customer summary' };
    }
  });

  // Get Top Customers by Revenue
  ipcMain.handle('customer-report:get-top-customers', async (event, limit = 5) => {
    try {
      const query = `
        SELECT 
          c.customer_name as name,
          COUNT(so.id) as order_count,
          SUM(so.grand_total) as total_spent
        FROM customers c
        JOIN sales_orders so ON c.id = so.customer_id
        WHERE so.status NOT IN ('cancelled', 'returned')
        GROUP BY c.id
        ORDER BY total_spent DESC
        LIMIT ?
      `;

      return new Promise((resolve, reject) => {
        db.all(query, [limit], (err, rows) => {
          if (err) {
            console.error('Error fetching top customers:', err);
            reject(err);
          } else {
            resolve({ success: true, data: rows || [] });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get top customers error:', error);
      return { success: false, message: 'Failed to fetch top customers' };
    }
  });

  // Get Customer List with Statistics
  ipcMain.handle('customer-report:get-customer-list', async (event, filters = {}) => {
    try {
      const { page = 1, limit = 20, searchTerm, sortBy = 'total_spent', sortOrder = 'DESC' } = filters;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          c.id, c.customer_name as name, c.mobile_number as phone, c.email,
          COUNT(so.id) as total_orders,
          SUM(so.grand_total) as total_spent,
          SUM(so.balance_amount) as outstanding_balance,
          MAX(so.order_date) as last_purchase_date
        FROM customers c
        LEFT JOIN sales_orders so ON c.id = so.customer_id AND so.status NOT IN ('cancelled', 'returned')
        WHERE c.customer_status = 'Active'
      `;

      const params = [];

      if (searchTerm) {
        query += ` AND (c.customer_name LIKE ? OR c.mobile_number LIKE ?)`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      query += ` GROUP BY c.id`;

      // Sorting
      const validSorts = ['name', 'total_orders', 'total_spent', 'outstanding_balance', 'last_purchase_date'];
      const safeSortBy = validSorts.includes(sortBy) ? sortBy : 'total_spent';
      const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;
      
      // Pagination
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      // Get Data
      const customers = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Get Total Count (for pagination)
      // Note: COUNT(DISTINCT c.id) with Filters
      let countQuery = `SELECT COUNT(*) as total FROM customers c WHERE c.customer_status = 'Active'`;
      const countParams = [];
      
      if (searchTerm) {
        countQuery += ` AND (c.customer_name LIKE ? OR c.mobile_number LIKE ?)`;
        countParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      const countResult = await new Promise((resolve, reject) => {
        db.get(countQuery, countParams, (err, row) => {
          if (err) reject(err);
          else resolve(row?.total || 0);
        });
      });

      return {
        success: true,
        data: customers,
        pagination: {
          total: countResult,
          page,
          limit,
          totalPages: Math.ceil(countResult / limit)
        }
      };

    } catch (error) {
      console.error('❌ Get customer list error:', error);
      return { success: false, message: 'Failed to fetch customer list' };
    }
  });

  // Get Customer Growth Trends (Monthly New Customers - Last 12 Months)
  ipcMain.handle('customer-report:get-growth-trends', async (event, filters = {}) => {
    try {
      const query = `
        SELECT 
          strftime('%Y-%m', created_at) as month,
          COUNT(*) as new_customers
        FROM customers
        WHERE customer_status = 'Active'
          AND created_at >= date('now', '-12 months')
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month ASC
      `;

      return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) {
            console.error('Error fetching customer growth trends:', err);
            reject(err);
          } else {
            resolve({ success: true, data: rows || [] });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get customer growth trends error:', error);
      return { success: false, message: 'Failed to fetch customer growth trends' };
    }
  });

  // Get At-Risk Customers (Haven't purchased recently)
  ipcMain.handle('customer-report:get-at-risk-customers', async (event, filters = {}) => {
    try {
      const { days = 60, limit = 10 } = filters;
      
      const query = `
        SELECT 
          c.id,
          c.customer_name as name,
          c.mobile_number as phone,
          c.email,
          COUNT(so.id) as total_orders,
          SUM(so.grand_total) as total_spent,
          MAX(so.order_date) as last_purchase_date,
          CAST(julianday('now') - julianday(MAX(so.order_date)) AS INTEGER) as days_since_purchase
        FROM customers c
        LEFT JOIN sales_orders so ON c.id = so.customer_id AND so.status NOT IN ('cancelled', 'returned')
        WHERE c.customer_status = 'Active'
        GROUP BY c.id
        HAVING days_since_purchase >= ? AND total_orders > 0
        ORDER BY total_spent DESC
        LIMIT ?
      `;

      return new Promise((resolve, reject) => {
        db.all(query, [days, limit], (err, rows) => {
          if (err) {
            console.error('Error fetching at-risk customers:', err);
            reject(err);
          } else {
            resolve({ success: true, data: rows || [] });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get at-risk customers error:', error);
      return { success: false, message: 'Failed to fetch at-risk customers' };
    }
  });

  // Get Customer Segmentation (RFM Analysis)
  ipcMain.handle('customer-report:get-customer-segments', async (event, filters = {}) => {
    try {
      const query = `
        WITH customer_rfm AS (
          SELECT 
            c.id,
            c.customer_name,
            COUNT(so.id) as frequency,
            SUM(so.grand_total) as monetary,
            CAST(julianday('now') - julianday(MAX(so.order_date)) AS INTEGER) as recency_days,
            MAX(so.order_date) as last_purchase_date
          FROM customers c
          LEFT JOIN sales_orders so ON c.id = so.customer_id AND so.status NOT IN ('cancelled', 'returned')
          WHERE c.customer_status = 'Active'
          GROUP BY c.id
        ),
        segmented AS (
          SELECT 
            *,
            CASE 
              WHEN frequency >= 5 AND monetary >= 10000 AND recency_days <= 30 THEN 'VIP'
              WHEN frequency >= 3 AND monetary >= 5000 AND recency_days <= 60 THEN 'Loyal'
              WHEN frequency >= 1 AND recency_days <= 30 THEN 'New'
              WHEN recency_days > 90 THEN 'Lost'
              WHEN recency_days BETWEEN 60 AND 90 THEN 'At-Risk'
              ELSE 'Regular'
            END as segment
          FROM customer_rfm
        )
        SELECT 
          segment,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM customers WHERE customer_status = 'Active'), 2) as percentage,
          ROUND(AVG(monetary), 2) as avg_revenue,
          ROUND(AVG(frequency), 1) as avg_orders
        FROM segmented
        GROUP BY segment
        ORDER BY 
          CASE segment
            WHEN 'VIP' THEN 1
            WHEN 'Loyal' THEN 2
            WHEN 'Regular' THEN 3
            WHEN 'New' THEN 4
            WHEN 'At-Risk' THEN 5
            WHEN 'Lost' THEN 6
          END
      `;

      return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) {
            console.error('Error fetching customer segments:', err);
            reject(err);
          } else {
            resolve({ success: true, data: rows || [] });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get customer segments error:', error);
      return { success: false, message: 'Failed to fetch customer segments' };
    }
  });

  // Get Payment Behavior Analysis
  ipcMain.handle('customer-report:get-payment-behavior', async (event, filters = {}) => {
    try {
      // Payment method distribution
      const paymentMethodQuery = `
        SELECT 
          payment_method,
          COUNT(*) as transaction_count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM sales_orders), 2) as percentage,
          SUM(grand_total) as total_amount
        FROM sales_orders
        WHERE payment_method IS NOT NULL AND status NOT IN ('cancelled', 'returned')
        GROUP BY payment_method
        ORDER BY transaction_count DESC
      `;

      // Outstanding balance analysis
      const outstandingQuery = `
        SELECT 
          COUNT(DISTINCT customer_id) as customers_with_outstanding,
          SUM(balance_amount) as total_outstanding,
          ROUND(AVG(balance_amount), 2) as avg_outstanding
        FROM sales_orders
        WHERE balance_amount > 0 AND status NOT IN ('cancelled', 'returned')
      `;

      const paymentMethods = await new Promise((resolve, reject) => {
        db.all(paymentMethodQuery, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      const outstanding = await new Promise((resolve, reject) => {
        db.get(outstandingQuery, [], (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        });
      });

      return {
        success: true,
        data: {
          paymentMethods,
          outstanding
        }
      };
    } catch (error) {
      console.error('❌ Get payment behavior error:', error);
      return { success: false, message: 'Failed to fetch payment behavior' };
    }
  });

  // Get Average Order Value (AOV) Metrics
  ipcMain.handle('customer-report:get-aov-metrics', async (event, filters = {}) => {
    try {
      // Overall AOV
      const overallAOVQuery = `
        SELECT 
          ROUND(AVG(grand_total), 2) as overall_aov,
          COUNT(*) as total_orders,
          SUM(grand_total) as total_revenue
        FROM sales_orders
        WHERE status NOT IN ('cancelled', 'returned')
      `;

      // Monthly AOV Trend (Last 6 months)
      const monthlyTrendQuery = `
        SELECT 
          strftime('%Y-%m', order_date) as month,
          ROUND(AVG(grand_total), 2) as aov,
          COUNT(*) as order_count
        FROM sales_orders
        WHERE order_date >= date('now', '-6 months') AND status NOT IN ('cancelled', 'returned')
        GROUP BY strftime('%Y-%m', order_date)
        ORDER BY month ASC
      `;

      // Top customers by AOV
      const topAOVCustomersQuery = `
        SELECT 
          c.customer_name as name,
          COUNT(so.id) as total_orders,
          ROUND(AVG(so.grand_total), 2) as avg_order_value,
          SUM(so.grand_total) as total_spent
        FROM customers c
        JOIN sales_orders so ON c.id = so.customer_id
        WHERE c.customer_status = 'Active' AND so.status NOT IN ('cancelled', 'returned')
        GROUP BY c.id
        HAVING total_orders >= 2
        ORDER BY avg_order_value DESC
        LIMIT 10
      `;

      const overallAOV = await new Promise((resolve, reject) => {
        db.get(overallAOVQuery, [], (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        });
      });

      const monthlyTrend = await new Promise((resolve, reject) => {
        db.all(monthlyTrendQuery, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      const topCustomers = await new Promise((resolve, reject) => {
        db.all(topAOVCustomersQuery, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      return {
        success: true,
        data: {
          overall: overallAOV,
          monthlyTrend,
          topCustomers
        }
      };
    } catch (error) {
      console.error('❌ Get AOV metrics error:', error);
      return { success: false, message: 'Failed to fetch AOV metrics' };
    }
  });

  console.log('✅ Customer Report handlers initialized');
}
