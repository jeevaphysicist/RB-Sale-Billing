import { ipcMain } from 'electron';

export function initializeSupplierReportHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for supplier report handlers');
    return;
  }

  // Get Supplier Report Summary
  ipcMain.handle('supplier-report:get-summary', async (event, filters = {}) => {
    try {
      // 1. Total Suppliers
      // 2. Total Purchase Value (Net Payable)
      // 3. Total Outstanding (Payables)
      
      // Calculate outstanding as: SUM(po.net_payable) - SUM(paid_amount)
      // We need to aggregate payment records for purchase orders
      
      const query = `
        SELECT 
          COUNT(DISTINCT s.id) as total_suppliers,
          SUM(po.net_payable) as total_purchases,
          SUM(po.net_payable) - IFNULL((
            SELECT SUM(pr.payment_amount) 
            FROM payment_records pr 
            WHERE pr.record_type = 'purchase'
          ), 0) as total_outstanding
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id
        WHERE s.status = 'Active'
      `;
      // Note: The total_outstanding calculation above is global (Total POs - Total Payments).
      // A more accurate way per supplier might be needed if we wan't to only count active suppliers' outstanding.
      // But "Total Outstanding" usually implies the business's total liability.
      // Let's stick to the joined query to ensure we only count active suppliers' stats or generally all POs.
      // However, typical "Total Outstanding" is sum of (PO Total - PO Paid) for all UNPAID/PARTIAL POs.
      // Let's refine the query to be safe.
      
      /*
        Refined Logic:
        Total Suppliers: Count of active suppliers.
        Total Spent: Sum of net_payable of all POs (linked to active suppliers or all? Usually all historical).
        Total Outstanding: (Sum of net_payable of all POs) - (Sum of payments for purchase).
      */

      const summaryQuery = `
        SELECT 
          (SELECT COUNT(*) FROM suppliers WHERE status = 'Active') as total_suppliers,
          (SELECT SUM(net_payable) FROM purchase_orders WHERE status != 'cancelled') as total_purchases,
          (
            (SELECT IFNULL(SUM(net_payable), 0) FROM purchase_orders WHERE status != 'cancelled') - 
            (SELECT IFNULL(SUM(payment_amount), 0) FROM payment_records WHERE record_type = 'purchase')
          ) as total_outstanding
      `;

      return new Promise((resolve, reject) => {
        db.get(summaryQuery, [], (err, row) => {
          if (err) {
            console.error('Error fetching supplier summary:', err);
            reject(err);
          } else {
            resolve({
              success: true,
              data: {
                totalSuppliers: row.total_suppliers || 0,
                totalPurchases: row.total_purchases || 0,
                totalOutstanding: row.total_outstanding || 0
              }
            });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get supplier summary error:', error);
      return { success: false, message: 'Failed to fetch supplier summary' };
    }
  });

  // Get Top Suppliers by Purchase Value
  ipcMain.handle('supplier-report:get-top-suppliers', async (event, limit = 5) => {
    try {
      const query = `
        SELECT 
          s.supplier_name as name,
          COUNT(po.id) as order_count,
          SUM(po.net_payable) as total_spent
        FROM suppliers s
        JOIN purchase_orders po ON s.id = po.supplier_id
        WHERE po.status != 'cancelled'
        GROUP BY s.id
        ORDER BY total_spent DESC
        LIMIT ?
      `;

      return new Promise((resolve, reject) => {
        db.all(query, [limit], (err, rows) => {
          if (err) {
            console.error('Error fetching top suppliers:', err);
            reject(err);
          } else {
            resolve({ success: true, data: rows || [] });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get top suppliers error:', error);
      return { success: false, message: 'Failed to fetch top suppliers' };
    }
  });

  // Get Supplier List with Statistics
  ipcMain.handle('supplier-report:get-supplier-list', async (event, filters = {}) => {
    try {
      const { page = 1, limit = 20, searchTerm, sortBy = 'total_spent', sortOrder = 'DESC' } = filters;
      const offset = (page - 1) * limit;

      // We need to calculate outstanding balance per supplier. 
      // This is (Total POs for supplier) - (Total Payments for those POs)
      
      let query = `
        SELECT 
          s.id, s.supplier_name as name, s.phone as phone, s.email,
          COUNT(po.id) as total_orders,
          IFNULL(SUM(po.net_payable), 0) as total_spent,
          (
            IFNULL(SUM(po.net_payable), 0) - 
            IFNULL((
              SELECT SUM(pr.payment_amount)
              FROM payment_records pr
              JOIN purchase_orders po2 ON pr.reference_id = po2.id
              WHERE po2.supplier_id = s.id AND pr.record_type = 'purchase'
            ), 0)
          ) as outstanding_balance,
          MAX(po.po_date) as last_purchase_date
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.status != 'cancelled'
        WHERE s.status = 'Active'
      `;

      const params = [];

      if (searchTerm) {
        query += ` AND (s.supplier_name LIKE ? OR s.phone LIKE ?)`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      query += ` GROUP BY s.id`;

      // Sorting
      const validSorts = ['name', 'total_orders', 'total_spent', 'outstanding_balance', 'last_purchase_date'];
      const safeSortBy = validSorts.includes(sortBy) ? sortBy : 'total_spent';
      const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;
      
      // Pagination
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      // Get Data
      const suppliers = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Get Total Count (for pagination)
      let countQuery = `SELECT COUNT(*) as total FROM suppliers s WHERE s.status = 'Active'`;
      const countParams = [];
      
      if (searchTerm) {
        countQuery += ` AND (s.supplier_name LIKE ? OR s.phone LIKE ?)`;
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
        data: suppliers,
        pagination: {
          total: countResult,
          page,
          limit,
          totalPages: Math.ceil(countResult / limit)
        }
      };

    } catch (error) {
      console.error('❌ Get supplier list error:', error);
      return { success: false, message: 'Failed to fetch supplier list' };
    }
  });

  // Get Supplier Growth Trends (Monthly New Suppliers - Last 12 Months)
  ipcMain.handle('supplier-report:get-growth-trends', async (event, filters = {}) => {
    try {
      const query = `
        SELECT 
          strftime('%Y-%m', created_at) as month,
          COUNT(*) as new_suppliers
        FROM suppliers
        WHERE status = 'Active'
          AND created_at >= date('now', '-12 months')
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month ASC
      `;

      return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) {
            console.error('Error fetching supplier growth trends:', err);
            reject(err);
          } else {
            resolve({ success: true, data: rows || [] });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get supplier growth trends error:', error);
      return { success: false, message: 'Failed to fetch supplier growth trends' };
    }
  });

  // Get Supplier Segmentation (RFM-style Analysis)
  ipcMain.handle('supplier-report:get-supplier-segments', async (event, filters = {}) => {
    try {
      const query = `
        WITH supplier_rfm AS (
          SELECT 
            s.id,
            s.supplier_name,
            COUNT(po.id) as frequency,
            IFNULL(SUM(po.net_payable), 0) as monetary,
            CAST(julianday('now') - julianday(MAX(po.po_date)) AS INTEGER) as recency_days,
            MAX(po.po_date) as last_purchase_date
          FROM suppliers s
          LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.status != 'cancelled'
          WHERE s.status = 'Active'
          GROUP BY s.id
        ),
        segmented AS (
          SELECT 
            *,
            CASE 
              WHEN frequency >= 5 AND monetary >= 50000 AND recency_days <= 30 THEN 'Premium'
              WHEN frequency >= 3 AND monetary >= 20000 AND recency_days <= 60 THEN 'Reliable'
              WHEN frequency >= 1 AND recency_days <= 60 THEN 'Standard'
              WHEN frequency <= 2 AND recency_days <= 30 THEN 'New'
              WHEN recency_days > 90 THEN 'Inactive'
              WHEN recency_days BETWEEN 60 AND 90 THEN 'At-Risk'
              ELSE 'Standard'
            END as segment
          FROM supplier_rfm
        )
        SELECT 
          segment,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM suppliers WHERE status = 'Active'), 2) as percentage,
          ROUND(AVG(monetary), 2) as avg_spent,
          ROUND(AVG(frequency), 1) as avg_orders
        FROM segmented
        GROUP BY segment
        ORDER BY 
          CASE segment
            WHEN 'Premium' THEN 1
            WHEN 'Reliable' THEN 2
            WHEN 'Standard' THEN 3
            WHEN 'New' THEN 4
            WHEN 'At-Risk' THEN 5
            WHEN 'Inactive' THEN 6
          END
      `;

      return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) {
            console.error('Error fetching supplier segments:', err);
            reject(err);
          } else {
            resolve({ success: true, data: rows || [] });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get supplier segments error:', error);
      return { success: false, message: 'Failed to fetch supplier segments' };
    }
  });

  // Get Purchase Trends (Monthly Purchase Volume - Last 12 Months)
  ipcMain.handle('supplier-report:get-purchase-trends', async (event, filters = {}) => {
    try {
      const query = `
        SELECT 
          strftime('%Y-%m', po_date) as month,
          COUNT(*) as order_count,
          ROUND(SUM(net_payable), 2) as total_amount
        FROM purchase_orders
        WHERE status != 'cancelled'
          AND po_date >= date('now', '-12 months')
        GROUP BY strftime('%Y-%m', po_date)
        ORDER BY month ASC
      `;

      return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
          if (err) {
            console.error('Error fetching purchase trends:', err);
            reject(err);
          } else {
            resolve({ success: true, data: rows || [] });
          }
        });
      });
    } catch (error) {
      console.error('❌ Get purchase trends error:', error);
      return { success: false, message: 'Failed to fetch purchase trends' };
    }
  });

  // Get Payment Behavior Analysis
  ipcMain.handle('supplier-report:get-payment-behavior', async (event, filters = {}) => {
    try {
      // Payment method distribution for purchases
      // Query payment records for purchases instead of purchase_orders (which doesn't have payment_method)
      const paymentMethodQuery = `
        SELECT 
          payment_method,
          COUNT(*) as transaction_count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM payment_records WHERE record_type = 'purchase'), 2) as percentage,
          SUM(payment_amount) as total_amount
       FROM payment_records
        WHERE record_type = 'purchase'
        GROUP BY payment_method
        ORDER BY transaction_count DESC
      `;

      // Outstanding payables analysis
      const outstandingQuery = `
        SELECT 
          COUNT(DISTINCT supplier_id) as suppliers_with_payables,
          SUM(net_payable) - IFNULL((
            SELECT SUM(payment_amount) FROM payment_records WHERE record_type = 'purchase'
          ), 0) as total_outstanding,
          ROUND((SUM(net_payable) - IFNULL((
            SELECT SUM(payment_amount) FROM payment_records WHERE record_type = 'purchase'
          ), 0)) / NULLIF(COUNT(DISTINCT supplier_id), 0), 2) as avg_outstanding
        FROM purchase_orders
        WHERE status != 'cancelled'
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

  // Get Average Purchase Value (APV) Metrics
  ipcMain.handle('supplier-report:get-apv-metrics', async (event, filters = {}) => {
    try {
      // Overall APV
      const overallAPVQuery = `
        SELECT 
          ROUND(AVG(net_payable), 2) as overall_apv,
          COUNT(*) as total_orders,
          SUM(net_payable) as total_spent
        FROM purchase_orders
        WHERE status != 'cancelled'
      `;

      // Monthly APV Trend (Last 6 months)
      const monthlyTrendQuery = `
        SELECT 
          strftime('%Y-%m', po_date) as month,
          ROUND(AVG(net_payable), 2) as apv,
          COUNT(*) as order_count
        FROM purchase_orders
        WHERE po_date >= date('now', '-6 months') AND status != 'cancelled'
        GROUP BY strftime('%Y-%m', po_date)
        ORDER BY month ASC
      `;

      // Top suppliers by APV
      const topAPVSuppliersQuery = `
        SELECT 
          s.supplier_name as name,
          COUNT(po.id) as total_orders,
          ROUND(AVG(po.net_payable), 2) as avg_order_value,
          SUM(po.net_payable) as total_spent
        FROM suppliers s
        JOIN purchase_orders po ON s.id = po.supplier_id
        WHERE s.status = 'Active' AND po.status != 'cancelled'
        GROUP BY s.id
        HAVING total_orders >= 2
        ORDER BY avg_order_value DESC
        LIMIT 10
      `;

      const overallAPV = await new Promise((resolve, reject) => {
        db.get(overallAPVQuery, [], (err, row) => {
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

      const topSuppliers = await new Promise((resolve, reject) => {
        db.all(topAPVSuppliersQuery, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      return {
        success: true,
        data: {
          overall: overallAPV,
          monthlyTrend,
          topSuppliers
        }
      };
    } catch (error) {
      console.error('❌ Get APV metrics error:', error);
      return { success: false, message: 'Failed to fetch APV metrics' };
    }
  });

  console.log('✅ Supplier Report handlers initialized');
}
