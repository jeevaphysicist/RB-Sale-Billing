import { ipcMain } from 'electron';

let globalDb = null;

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    globalDb.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    globalDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    globalDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// order_date is stored either as YYYY-MM-DD or as a full ISO (UTC) timestamp; normalise to the local calendar date
const LOCAL_DATE_SQL = (col) => `(CASE WHEN LENGTH(${col}) > 10 THEN DATE(${col}, 'localtime') ELSE SUBSTR(${col}, 1, 10) END)`;

const EXCLUDED_STATUSES = ['cancelled', 'returned'];

const generateNextCode = async () => {
  const row = await get(
    `SELECT mechanic_code FROM mechanics
     WHERE mechanic_code LIKE 'MECH%'
     ORDER BY CAST(SUBSTR(mechanic_code, 5) AS INTEGER) DESC
     LIMIT 1`
  );
  const match = row?.mechanic_code?.match(/MECH(\d+)/);
  const next = match ? parseInt(match[1], 10) + 1 : 1;
  return `MECH${String(next).padStart(3, '0')}`;
};

export function initializeMechanicHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for mechanic handlers');
    return false;
  }
  globalDb = db;

  // Create
  ipcMain.handle('mechanic:create', async (event, data = {}) => {
    try {
      const name = String(data.mechanic_name || '').trim();
      const mobile = String(data.mobile_number || '').trim();
      if (!name) return { success: false, message: 'Mechanic name is required' };

      if (mobile) {
        const existing = await get(`SELECT id FROM mechanics WHERE mobile_number = ?`, [mobile]);
        if (existing) return { success: false, message: 'A mechanic with this mobile number already exists' };
      }

      const code = await generateNextCode();
      const result = await run(
        `INSERT INTO mechanics (mechanic_code, mechanic_name, mobile_number, address, notes, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [code, name, mobile, String(data.address || '').trim(), String(data.notes || '').trim(), data.status === 'Inactive' ? 'Inactive' : 'Active']
      );
      return { success: true, message: 'Mechanic created successfully', mechanicId: result.lastID, mechanicCode: code };
    } catch (error) {
      console.error('❌ Create mechanic error:', error);
      return { success: false, message: 'Failed to create mechanic: ' + error.message };
    }
  });

  // List
  ipcMain.handle('mechanic:get-all', async (event, filterParams = {}) => {
    try {
      const { searchTerm, status, sortKey = 'id', sortDirection = 'DESC', page = 1, limit = 10 } = filterParams;
      const validSortKeys = ['id', 'mechanic_code', 'mechanic_name', 'mobile_number', 'status', 'created_at'];
      const safeSortKey = validSortKeys.includes(sortKey) ? sortKey : 'id';
      const safeDirection = String(sortDirection).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const conditions = [];
      const params = [];
      if (status) {
        conditions.push(`status = ?`);
        params.push(status);
      }
      if (searchTerm) {
        conditions.push(`(mechanic_name LIKE ? OR mechanic_code LIKE ? OR mobile_number LIKE ?)`);
        const like = `%${searchTerm}%`;
        params.push(like, like, like);
      }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

      const total = (await get(`SELECT COUNT(*) AS total FROM mechanics${where}`, params)).total;
      const rows = await all(
        `SELECT m.*, (SELECT COUNT(*) FROM sales_orders so WHERE so.mechanic_id = m.id) AS bill_count
         FROM (SELECT * FROM mechanics${where} ORDER BY ${safeSortKey} ${safeDirection} LIMIT ? OFFSET ?) m
         ORDER BY m.${safeSortKey} ${safeDirection}`,
        [...params, Number(limit) || 10, ((Number(page) || 1) - 1) * (Number(limit) || 10)]
      );
      return { success: true, data: rows, total, page: Number(page) || 1, limit: Number(limit) || 10 };
    } catch (error) {
      console.error('❌ Get mechanics error:', error);
      return { success: false, message: 'Failed to fetch mechanics' };
    }
  });

  // Single record
  ipcMain.handle('mechanic:get-by-id', async (event, id) => {
    try {
      const mechanic = await get(`SELECT * FROM mechanics WHERE id = ?`, [id]);
      if (!mechanic) return { success: false, message: 'Mechanic not found' };
      return { success: true, mechanic };
    } catch (error) {
      return { success: false, message: 'Failed to fetch mechanic' };
    }
  });

  // Update
  ipcMain.handle('mechanic:update', async (event, data = {}) => {
    try {
      const name = String(data.mechanic_name || '').trim();
      const mobile = String(data.mobile_number || '').trim();
      if (!data.id) return { success: false, message: 'Mechanic ID is required' };
      if (!name) return { success: false, message: 'Mechanic name is required' };

      if (mobile) {
        const existing = await get(`SELECT id FROM mechanics WHERE mobile_number = ? AND id <> ?`, [mobile, data.id]);
        if (existing) return { success: false, message: 'A mechanic with this mobile number already exists' };
      }

      const result = await run(
        `UPDATE mechanics SET mechanic_name = ?, mobile_number = ?, address = ?, notes = ?, status = ?,
           updated_at = datetime('now', '+5 hours', '30 minutes')
         WHERE id = ?`,
        [name, mobile, String(data.address || '').trim(), String(data.notes || '').trim(), data.status === 'Inactive' ? 'Inactive' : 'Active', data.id]
      );
      if (!result.changes) return { success: false, message: 'Mechanic not found' };

      // Keep the name printed in old bills' ledger in step with the master
      await run(`UPDATE sales_orders SET mechanic_name = ? WHERE mechanic_id = ?`, [name, data.id]);
      return { success: true, message: 'Mechanic updated successfully' };
    } catch (error) {
      console.error('❌ Update mechanic error:', error);
      return { success: false, message: 'Failed to update mechanic: ' + error.message };
    }
  });

  // Active / Inactive
  ipcMain.handle('mechanic:set-status', async (event, { id, status } = {}) => {
    try {
      const next = status === 'Inactive' ? 'Inactive' : 'Active';
      const result = await run(
        `UPDATE mechanics SET status = ?, updated_at = datetime('now', '+5 hours', '30 minutes') WHERE id = ?`,
        [next, id]
      );
      if (!result.changes) return { success: false, message: 'Mechanic not found' };
      return { success: true, message: `Mechanic marked ${next.toLowerCase()}` };
    } catch (error) {
      return { success: false, message: 'Failed to change status' };
    }
  });

  // Delete (only when no bill refers to the mechanic - otherwise make them inactive)
  ipcMain.handle('mechanic:delete', async (event, id) => {
    try {
      const { count } = await get(`SELECT COUNT(*) AS count FROM sales_orders WHERE mechanic_id = ?`, [id]);
      if (count > 0) {
        return {
          success: false,
          message: `This mechanic is the referrer on ${count} bill${count === 1 ? '' : 's'} and cannot be deleted. Mark the mechanic inactive instead.`
        };
      }
      const result = await run(`DELETE FROM mechanics WHERE id = ?`, [id]);
      if (!result.changes) return { success: false, message: 'Mechanic not found' };
      return { success: true, message: 'Mechanic deleted successfully' };
    } catch (error) {
      console.error('❌ Delete mechanic error:', error);
      return { success: false, message: 'Failed to delete mechanic' };
    }
  });

  // Mechanic ledger - one row per mechanic for the period
  ipcMain.handle('mechanic:ledger-summary', async (event, filterParams = {}) => {
    try {
      const { startDate, endDate, searchTerm, balanceOnly = false } = filterParams;
      const conditions = [`so.mechanic_id IS NOT NULL`, `LOWER(COALESCE(so.status, '')) NOT IN ('cancelled', 'returned')`];
      const params = [];
      if (startDate) {
        conditions.push(`${LOCAL_DATE_SQL('so.order_date')} >= ?`);
        params.push(startDate);
      }
      if (endDate) {
        conditions.push(`${LOCAL_DATE_SQL('so.order_date')} <= ?`);
        params.push(endDate);
      }
      if (searchTerm) {
        conditions.push(`(m.mechanic_name LIKE ? OR m.mobile_number LIKE ? OR m.mechanic_code LIKE ?)`);
        const like = `%${searchTerm}%`;
        params.push(like, like, like);
      }

      const rows = await all(
        `
        SELECT
          m.id AS mechanic_id,
          m.mechanic_code,
          m.mechanic_name,
          COALESCE(m.mobile_number, '') AS mobile,
          m.status AS mechanic_status,
          COUNT(*) AS bills,
          MIN(${LOCAL_DATE_SQL('so.order_date')}) AS first_sale,
          MAX(${LOCAL_DATE_SQL('so.order_date')}) AS last_sale,
          SUM(COALESCE(so.grand_total, 0)) AS total_sale,
          SUM(COALESCE(pay.total_paid, 0)) AS paid,
          SUM(MAX(0, COALESCE(so.grand_total, 0) - COALESCE(pay.total_paid, 0))) AS balance_due
        FROM sales_orders so
        JOIN mechanics m ON m.id = so.mechanic_id
        LEFT JOIN (
          SELECT reference_id, SUM(payment_amount) AS total_paid
          FROM payment_records
          WHERE record_type = 'sales'
          GROUP BY reference_id
        ) pay ON pay.reference_id = so.id
        WHERE ${conditions.join(' AND ')}
        GROUP BY m.id
        ${balanceOnly ? 'HAVING balance_due > 0.01' : ''}
        ORDER BY total_sale DESC
        `,
        params
      );

      const totals = { mechanics: rows.length, bills: 0, total_sale: 0, paid: 0, balance_due: 0 };
      const data = rows.map((row, index) => {
        const record = {
          sno: index + 1,
          mechanic_id: row.mechanic_id,
          mechanic_code: row.mechanic_code,
          mechanic_name: row.mechanic_name,
          mobile: row.mobile,
          mechanic_status: row.mechanic_status,
          bills: row.bills,
          first_sale: row.first_sale,
          last_sale: row.last_sale,
          total_sale: round2(row.total_sale),
          avg_bill: round2(row.bills ? row.total_sale / row.bills : 0),
          paid: round2(row.paid),
          balance_due: round2(row.balance_due)
        };
        totals.bills += record.bills;
        totals.total_sale += record.total_sale;
        totals.paid += record.paid;
        totals.balance_due += record.balance_due;
        return record;
      });
      for (const key of Object.keys(totals)) totals[key] = round2(totals[key]);

      return { success: true, data, totals };
    } catch (error) {
      console.error('❌ Mechanic ledger summary error:', error);
      return { success: false, message: 'Failed to load mechanic ledger', error: error.message };
    }
  });

  // Mechanic ledger - every bill that names the mechanic as referrer
  ipcMain.handle('mechanic:ledger-history', async (event, filterParams = {}) => {
    try {
      const { mechanicId, startDate, endDate } = filterParams;
      const id = Number(mechanicId) || 0;
      const mechanic = await get(`SELECT * FROM mechanics WHERE id = ?`, [id]);
      if (!mechanic) return { success: false, message: 'Mechanic not found' };

      const conditions = [`so.mechanic_id = ?`];
      const params = [id];
      if (startDate) {
        conditions.push(`${LOCAL_DATE_SQL('so.order_date')} >= ?`);
        params.push(startDate);
      }
      if (endDate) {
        conditions.push(`${LOCAL_DATE_SQL('so.order_date')} <= ?`);
        params.push(endDate);
      }

      const bills = await all(
        `
        SELECT
          so.id,
          so.order_number,
          ${LOCAL_DATE_SQL('so.order_date')} AS order_date,
          so.order_time,
          so.customer_id,
          COALESCE(so.customer_name, '') AS customer_name,
          COALESCE(so.customer_phone, '') AS customer_phone,
          LOWER(COALESCE(so.status, 'completed')) AS status,
          COALESCE(so.grand_total, 0) AS net_amount,
          COALESCE(pay.total_paid, 0) AS paid,
          (SELECT COUNT(*) FROM sales_order_items WHERE order_id = so.id) AS item_count
        FROM sales_orders so
        LEFT JOIN (
          SELECT reference_id, SUM(payment_amount) AS total_paid
          FROM payment_records
          WHERE record_type = 'sales'
          GROUP BY reference_id
        ) pay ON pay.reference_id = so.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY so.id DESC
        `,
        params
      );

      const summary = { bills: 0, cancelledBills: 0, total_sale: 0, paid: 0, balance_due: 0 };
      const billRows = bills.map((bill) => {
        const excluded = EXCLUDED_STATUSES.includes(bill.status);
        const balance = excluded ? 0 : Math.max(0, round2(bill.net_amount - bill.paid));
        if (excluded) {
          summary.cancelledBills += 1;
        } else {
          summary.bills += 1;
          summary.total_sale += bill.net_amount;
          summary.paid += bill.paid;
          summary.balance_due += balance;
        }
        return { ...bill, net_amount: round2(bill.net_amount), paid: round2(bill.paid), balance_due: balance, excluded };
      });
      for (const key of Object.keys(summary)) summary[key] = round2(summary[key]);
      summary.avg_bill = summary.bills ? round2(summary.total_sale / summary.bills) : 0;

      return { success: true, mechanic, summary, bills: billRows };
    } catch (error) {
      console.error('❌ Mechanic ledger history error:', error);
      return { success: false, message: 'Failed to load mechanic ledger', error: error.message };
    }
  });

  console.log('✅ Mechanic handlers initialized');
  return true;
}
