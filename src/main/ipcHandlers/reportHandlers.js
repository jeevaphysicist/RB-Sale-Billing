import { ipcMain } from 'electron';

let globalDb = null;

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

// Bills that do not count towards sales totals (still listed for audit)
const EXCLUDED_STATUSES = ['cancelled', 'returned'];

// Finds missing sequence numbers in bill numbers of the form PREFIX-YYYY-NNN
const findMissingBillNumbers = (orderNumbers) => {
  const byPrefix = {};
  for (const number of orderNumbers) {
    const match = /^(.*-)(\d+)$/.exec(number || '');
    if (!match) continue;
    const [, prefix, seq] = match;
    if (!byPrefix[prefix]) byPrefix[prefix] = { width: seq.length, seqs: new Set() };
    byPrefix[prefix].seqs.add(parseInt(seq, 10));
  }

  const missing = [];
  for (const [prefix, { width, seqs }] of Object.entries(byPrefix)) {
    const sorted = [...seqs].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      for (let s = sorted[i - 1] + 1; s < sorted[i]; s++) {
        missing.push(`${prefix}${String(s).padStart(width, '0')}`);
        if (missing.length >= 200) return missing;
      }
    }
  }
  return missing;
};

export function initializeReportHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for report handlers');
    return false;
  }

  globalDb = db;

  // Bill-wise sales report for auditing
  ipcMain.handle('report:sales', async (event, filterParams = {}) => {
    try {
      const { startDate, endDate, billType = 'all', status = 'all', searchTerm } = filterParams;

      const conditions = [];
      const params = [];

      if (startDate) {
        conditions.push(`${LOCAL_DATE_SQL('so.order_date')} >= ?`);
        params.push(startDate);
      }
      if (endDate) {
        conditions.push(`${LOCAL_DATE_SQL('so.order_date')} <= ?`);
        params.push(endDate);
      }
      if (billType === 'b2b') {
        conditions.push(`TRIM(COALESCE(so.customer_gstin, '')) <> ''`);
      } else if (billType === 'b2c') {
        conditions.push(`TRIM(COALESCE(so.customer_gstin, '')) = ''`);
      }
      if (status === 'active') {
        conditions.push(`LOWER(COALESCE(so.status, '')) NOT IN ('cancelled', 'returned')`);
      } else if (status === 'cancelled') {
        conditions.push(`LOWER(COALESCE(so.status, '')) IN ('cancelled', 'returned')`);
      }
      if (searchTerm) {
        conditions.push(`(so.order_number LIKE ? OR so.customer_name LIKE ? OR so.customer_phone LIKE ? OR so.customer_gstin LIKE ?)`);
        const like = `%${searchTerm}%`;
        params.push(like, like, like, like);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = await all(
        `
        SELECT
          so.id,
          so.order_number,
          ${LOCAL_DATE_SQL('so.order_date')} AS order_date,
          so.order_time,
          so.customer_name,
          so.customer_phone,
          so.customer_gstin,
          LOWER(COALESCE(so.status, 'completed')) AS status,
          so.payment_type,
          so.payment_method,
          so.split_payment_credit,
          COALESCE(t.taxable_amount, so.subtotal - so.discount_total, 0) AS taxable_amount,
          -- Zero-rated lines (e.g. labour charge) are not part of taxable_amount
          COALESCE(t.amount_before_tax - t.taxable_amount, 0) AS non_taxable,
          COALESCE(t.total_item_discount, 0) + COALESCE(t.bill_discount_amount, so.discount_total, 0) AS discount,
          COALESCE(t.total_cgst, 0) AS cgst,
          COALESCE(t.total_sgst, 0) AS sgst,
          COALESCE(t.total_igst, 0) AS igst,
          COALESCE(t.round_off_amount, so.round_off, 0) AS round_off,
          COALESCE(so.grand_total, 0) AS net_amount,
          COALESCE(pay.cash, 0) AS cash,
          COALESCE(pay.card, 0) AS card,
          COALESCE(pay.upi, 0) AS upi,
          COALESCE(pay.other, 0) AS other,
          COALESCE(pay.total_paid, 0) AS total_paid,
          COALESCE(u.username, so.cashier_name, '') AS billing_user
        FROM sales_orders so
        LEFT JOIN sales_order_totals t
          ON t.id = (SELECT MAX(id) FROM sales_order_totals WHERE order_id = so.id)
        LEFT JOIN (
          SELECT
            reference_id,
            SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN payment_amount ELSE 0 END) AS cash,
            SUM(CASE WHEN LOWER(payment_method) = 'card' THEN payment_amount ELSE 0 END) AS card,
            SUM(CASE WHEN LOWER(payment_method) = 'upi' THEN payment_amount ELSE 0 END) AS upi,
            SUM(CASE WHEN LOWER(payment_method) NOT IN ('cash', 'card', 'upi') THEN payment_amount ELSE 0 END) AS other,
            SUM(payment_amount) AS total_paid
          FROM payment_records
          WHERE record_type = 'sales'
          GROUP BY reference_id
        ) pay ON pay.reference_id = so.id
        LEFT JOIN users u ON u.id = so.cashier_id
        ${whereClause}
        ORDER BY so.id ASC
        `,
        params
      );

      const totals = {
        bills: 0,
        cancelledBills: 0,
        taxable_amount: 0,
        non_taxable: 0,
        discount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        round_off: 0,
        net_amount: 0,
        cash: 0,
        card: 0,
        upi: 0,
        other: 0,
        credit: 0,
        balance_due: 0
      };

      const data = rows.map((row, index) => {
        const excluded = EXCLUDED_STATUSES.includes(row.status);

        // Credit given at the time of billing
        let credit = 0;
        if (row.payment_type === 'split') credit = row.split_payment_credit || 0;
        else if ((row.payment_method || '').toLowerCase() === 'credit') credit = row.net_amount;

        const balanceDue = excluded ? 0 : Math.max(0, round2(row.net_amount - row.total_paid));

        const record = {
          sno: index + 1,
          id: row.id,
          order_number: row.order_number,
          order_date: row.order_date,
          order_time: row.order_time,
          customer_name: row.customer_name,
          customer_phone: row.customer_phone,
          customer_gstin: (row.customer_gstin || '').trim(),
          status: row.status,
          taxable_amount: round2(row.taxable_amount),
          non_taxable: round2(row.non_taxable),
          discount: round2(row.discount),
          cgst: round2(row.cgst),
          sgst: round2(row.sgst),
          igst: round2(row.igst),
          round_off: round2(row.round_off),
          net_amount: round2(row.net_amount),
          cash: round2(row.cash),
          card: round2(row.card),
          upi: round2(row.upi),
          other: round2(row.other),
          credit: round2(credit),
          balance_due: balanceDue,
          billing_user: row.billing_user,
          excluded
        };

        if (excluded) {
          totals.cancelledBills += 1;
        } else {
          totals.bills += 1;
          for (const key of ['taxable_amount', 'non_taxable', 'discount', 'cgst', 'sgst', 'igst', 'round_off', 'net_amount', 'cash', 'card', 'upi', 'other', 'credit', 'balance_due']) {
            totals[key] += record[key];
          }
        }

        return record;
      });

      for (const key of Object.keys(totals)) totals[key] = round2(totals[key]);

      // Bill number gaps are checked across the whole date range, ignoring bill type / search filters
      let missingBillNumbers = [];
      if (billType === 'all' && status === 'all' && !searchTerm) {
        missingBillNumbers = findMissingBillNumbers(rows.map((r) => r.order_number));
      } else {
        const rangeParams = [];
        const rangeConditions = [];
        if (startDate) {
          rangeConditions.push(`${LOCAL_DATE_SQL('order_date')} >= ?`);
          rangeParams.push(startDate);
        }
        if (endDate) {
          rangeConditions.push(`${LOCAL_DATE_SQL('order_date')} <= ?`);
          rangeParams.push(endDate);
        }
        const rangeRows = await all(
          `SELECT order_number FROM sales_orders ${rangeConditions.length ? `WHERE ${rangeConditions.join(' AND ')}` : ''}`,
          rangeParams
        );
        missingBillNumbers = findMissingBillNumbers(rangeRows.map((r) => r.order_number));
      }

      return { success: true, data, totals, missingBillNumbers };
    } catch (error) {
      console.error('❌ Sales report error:', error);
      return { success: false, message: 'Failed to load sales report', error: error.message };
    }
  });

  // Shared WHERE clause for the HSN summary and its bill drill-down
  const buildHsnConditions = ({ startDate, endDate, billType = 'all', searchTerm }) => {
    // Cancelled / returned bills are never part of the HSN summary
    const conditions = [`LOWER(COALESCE(so.status, '')) NOT IN ('cancelled', 'returned')`];
    const params = [];

    if (startDate) {
      conditions.push(`${LOCAL_DATE_SQL('so.order_date')} >= ?`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`${LOCAL_DATE_SQL('so.order_date')} <= ?`);
      params.push(endDate);
    }
    if (billType === 'b2b') {
      conditions.push(`TRIM(COALESCE(so.customer_gstin, '')) <> ''`);
    } else if (billType === 'b2c') {
      conditions.push(`TRIM(COALESCE(so.customer_gstin, '')) = ''`);
    }
    if (searchTerm) {
      conditions.push(`(soi.hsn_code LIKE ? OR soi.product_name LIKE ?)`);
      const like = `%${searchTerm}%`;
      params.push(like, like);
    }
    return { conditions, params };
  };

  // HSN-wise summary (GSTR-1 style) for the selected period
  ipcMain.handle('report:hsn', async (event, filterParams = {}) => {
    try {
      const { conditions, params } = buildHsnConditions(filterParams);

      // Taxable value is derived from the tax actually charged, because the saved line amount
      // can include a labour charge that is not taxed. Zero-rated lines are taxable at 0%.
      const rows = await all(
        `
        SELECT
          TRIM(COALESCE(soi.hsn_code, '')) AS hsn_code,
          COALESCE(soi.tax_rate, 0) AS tax_rate,
          GROUP_CONCAT(DISTINCT soi.product_name) AS products,
          GROUP_CONCAT(DISTINCT soi.unit) AS units,
          SUM(COALESCE(soi.quantity, 0)) AS quantity,
          SUM(
            CASE WHEN COALESCE(soi.tax_rate, 0) > 0
              THEN COALESCE(soi.tax_amount, 0) * 100.0 / soi.tax_rate
              ELSE COALESCE(soi.final_amount, 0) - COALESCE(soi.tax_amount, 0)
            END
          ) AS taxable_amount,
          SUM(COALESCE(soi.cgst_amount, 0)) AS cgst,
          SUM(COALESCE(soi.sgst_amount, 0)) AS sgst,
          SUM(COALESCE(soi.igst_amount, 0)) AS igst,
          SUM(COALESCE(soi.tax_amount, 0)) AS total_tax,
          SUM(COALESCE(soi.final_amount, 0)) AS net_value,
          COUNT(DISTINCT so.id) AS bills
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.order_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY TRIM(COALESCE(soi.hsn_code, '')), COALESCE(soi.tax_rate, 0)
        ORDER BY hsn_code = '' ASC, hsn_code ASC, tax_rate ASC
        `,
        params
      );

      const totals = {
        lines: rows.length,
        quantity: 0,
        taxable_amount: 0,
        labour: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total_tax: 0,
        net_value: 0,
        bills: 0
      };
      let invalidHsnLines = 0;

      const data = rows.map((row, index) => {
        const taxable = round2(row.taxable_amount);
        const totalTax = round2(row.total_tax);
        const netValue = round2(row.net_value);
        // HSN codes are 4, 6 or 8 digits; blanks and anything else need correcting before filing
        const hsnValid = /^(\d{4}|\d{6}|\d{8})$/.test(row.hsn_code);
        if (!hsnValid) invalidHsnLines += 1;

        const record = {
          sno: index + 1,
          hsn_code: row.hsn_code,
          hsn_valid: hsnValid,
          tax_rate: round2(row.tax_rate),
          products: row.products || '',
          units: row.units || '',
          quantity: round2(row.quantity),
          taxable_amount: taxable,
          // Untaxed labour charge included in the line amounts
          labour: Math.max(0, round2(netValue - taxable - totalTax)),
          cgst: round2(row.cgst),
          sgst: round2(row.sgst),
          igst: round2(row.igst),
          total_tax: totalTax,
          net_value: netValue,
          bills: row.bills
        };

        for (const key of ['quantity', 'taxable_amount', 'labour', 'cgst', 'sgst', 'igst', 'total_tax', 'net_value']) {
          totals[key] += record[key];
        }
        return record;
      });

      // Distinct bill count across all HSN lines
      const billCount = await all(
        `
        SELECT COUNT(DISTINCT so.id) AS bills
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.order_id
        WHERE ${conditions.join(' AND ')}
        `,
        params
      );

      for (const key of Object.keys(totals)) totals[key] = round2(totals[key]);
      totals.bills = billCount[0]?.bills || 0;

      return { success: true, data, totals, invalidHsnLines };
    } catch (error) {
      console.error('❌ HSN report error:', error);
      return { success: false, message: 'Failed to load HSN report', error: error.message };
    }
  });

  // Bills behind one HSN summary line (same filters as the summary)
  ipcMain.handle('report:hsn-bills', async (event, filterParams = {}) => {
    try {
      const { hsnCode = '', taxRate = 0 } = filterParams;
      const { conditions, params } = buildHsnConditions(filterParams);
      conditions.push(`TRIM(COALESCE(soi.hsn_code, '')) = ?`, `COALESCE(soi.tax_rate, 0) = ?`);
      params.push(hsnCode, taxRate);

      const rows = await all(
        `
        SELECT
          so.id,
          so.order_number,
          ${LOCAL_DATE_SQL('so.order_date')} AS order_date,
          COALESCE(so.customer_name, 'Walk-in Customer') AS customer_name,
          SUM(COALESCE(soi.quantity, 0)) AS quantity,
          SUM(COALESCE(soi.tax_amount, 0)) AS total_tax,
          SUM(COALESCE(soi.final_amount, 0)) AS net_value
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.order_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY so.id
        ORDER BY so.order_date DESC, so.id DESC
        `,
        params
      );

      const data = rows.map((row) => ({
        ...row,
        quantity: round2(row.quantity),
        total_tax: round2(row.total_tax),
        net_value: round2(row.net_value)
      }));
      return { success: true, data };
    } catch (error) {
      console.error('❌ HSN bills error:', error);
      return { success: false, message: 'Failed to load HSN bills', error: error.message };
    }
  });

  // Customer-wise purchase summary for the selected period
  ipcMain.handle('report:customer-summary', async (event, filterParams = {}) => {
    try {
      const { startDate, endDate, searchTerm, balanceOnly = false } = filterParams;

      // Walk-in sales are excluded (customer_id 0/NULL or the WALK-IN customer record)
      const conditions = [
        `LOWER(COALESCE(so.status, '')) NOT IN ('cancelled', 'returned')`,
        `COALESCE(so.customer_id, 0) > 0`,
        `COALESCE(c.customer_code, '') <> 'WALK-IN'`
      ];
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
        conditions.push(`(COALESCE(c.customer_name, so.customer_name) LIKE ? OR COALESCE(c.mobile_number, so.customer_phone) LIKE ? OR COALESCE(c.gstin, so.customer_gstin) LIKE ?)`);
        const like = `%${searchTerm}%`;
        params.push(like, like, like);
      }

      const rows = await all(
        `
        SELECT
          COALESCE(so.customer_id, 0) AS customer_id,
          COALESCE(MAX(c.customer_name), MAX(so.customer_name), 'Walk-in Customer') AS customer_name,
          COALESCE(MAX(c.mobile_number), MAX(so.customer_phone), '') AS mobile,
          TRIM(COALESCE(MAX(c.gstin), MAX(so.customer_gstin), '')) AS gstin,
          COALESCE(MAX(c.credit_limit), 0) AS credit_limit,
          COUNT(*) AS bills,
          MIN(${LOCAL_DATE_SQL('so.order_date')}) AS first_purchase,
          MAX(${LOCAL_DATE_SQL('so.order_date')}) AS last_purchase,
          SUM(COALESCE(so.grand_total, 0)) AS total_purchase,
          SUM(COALESCE(pay.total_paid, 0)) AS paid,
          SUM(MAX(0, COALESCE(so.grand_total, 0) - COALESCE(pay.total_paid, 0))) AS balance_due
        FROM sales_orders so
        LEFT JOIN customers c ON c.id = so.customer_id
        LEFT JOIN (
          SELECT reference_id, SUM(payment_amount) AS total_paid
          FROM payment_records
          WHERE record_type = 'sales'
          GROUP BY reference_id
        ) pay ON pay.reference_id = so.id
        WHERE ${conditions.join(' AND ')}
        GROUP BY COALESCE(so.customer_id, 0)
        ${balanceOnly ? 'HAVING balance_due > 0.01' : ''}
        ORDER BY total_purchase DESC
        `,
        params
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const totals = { customers: rows.length, bills: 0, total_purchase: 0, paid: 0, balance_due: 0 };

      const data = rows.map((row, index) => {
        const last = row.last_purchase ? new Date(`${row.last_purchase}T00:00:00`) : null;
        const record = {
          sno: index + 1,
          customer_id: row.customer_id,
          is_walk_in: !row.customer_id,
          customer_name: row.customer_name,
          mobile: row.mobile,
          gstin: row.gstin,
          credit_limit: round2(row.credit_limit),
          bills: row.bills,
          first_purchase: row.first_purchase,
          last_purchase: row.last_purchase,
          days_since_last: last ? Math.max(0, Math.round((today - last) / 86400000)) : null,
          total_purchase: round2(row.total_purchase),
          avg_bill: round2(row.bills ? row.total_purchase / row.bills : 0),
          paid: round2(row.paid),
          balance_due: round2(row.balance_due)
        };
        record.over_limit = record.credit_limit > 0 && record.balance_due > record.credit_limit;

        totals.bills += record.bills;
        totals.total_purchase += record.total_purchase;
        totals.paid += record.paid;
        totals.balance_due += record.balance_due;
        return record;
      });

      for (const key of Object.keys(totals)) totals[key] = round2(totals[key]);

      return { success: true, data, totals };
    } catch (error) {
      console.error('❌ Customer summary report error:', error);
      return { success: false, message: 'Failed to load customer report', error: error.message };
    }
  });

  // Full purchase history of one customer: bills, products bought and account statement
  ipcMain.handle('report:customer-history', async (event, filterParams = {}) => {
    try {
      const { customerId, startDate, endDate } = filterParams;
      const id = Number(customerId) || 0;

      // Walk-in sales are saved with customer_id 0 or NULL
      const customerCondition = id > 0 ? `so.customer_id = ?` : `COALESCE(so.customer_id, 0) = 0`;
      const customerParams = id > 0 ? [id] : [];

      const rangeConditions = [];
      const rangeParams = [];
      if (startDate) {
        rangeConditions.push(`${LOCAL_DATE_SQL('so.order_date')} >= ?`);
        rangeParams.push(startDate);
      }
      if (endDate) {
        rangeConditions.push(`${LOCAL_DATE_SQL('so.order_date')} <= ?`);
        rangeParams.push(endDate);
      }
      const rangeSql = rangeConditions.length ? ` AND ${rangeConditions.join(' AND ')}` : '';
      const ACTIVE_SQL = `LOWER(COALESCE(so.status, '')) NOT IN ('cancelled', 'returned')`;

      const customerRows = id > 0 ? await all(`SELECT * FROM customers WHERE id = ?`, [id]) : [];
      const customer = customerRows[0] || {
        id,
        customer_name: 'Walk-in Customer',
        mobile_number: '',
        opening_balance: 0,
        credit_limit: 0
      };

      // Bills in the period (cancelled / returned included so the history is complete)
      const bills = await all(
        `
        SELECT
          so.id,
          so.order_number,
          ${LOCAL_DATE_SQL('so.order_date')} AS order_date,
          so.order_time,
          LOWER(COALESCE(so.status, 'completed')) AS status,
          COALESCE(so.grand_total, 0) AS net_amount,
          COALESCE(pay.total_paid, 0) AS paid,
          (SELECT COUNT(*) FROM sales_order_items WHERE order_id = so.id) AS item_count,
          COALESCE(so.cashier_name, '') AS billing_user
        FROM sales_orders so
        LEFT JOIN (
          SELECT reference_id, SUM(payment_amount) AS total_paid
          FROM payment_records
          WHERE record_type = 'sales'
          GROUP BY reference_id
        ) pay ON pay.reference_id = so.id
        WHERE ${customerCondition}${rangeSql}
        ORDER BY so.id DESC
        `,
        [...customerParams, ...rangeParams]
      );

      const billIds = bills.map((b) => b.id);
      const items = billIds.length
        ? await all(
            `
            SELECT order_id, product_name, hsn_code, unit, quantity, unit_price, tax_rate, tax_amount, final_amount
            FROM sales_order_items
            WHERE order_id IN (${billIds.map(() => '?').join(',')})
            ORDER BY id ASC
            `,
            billIds
          )
        : [];

      const itemsByBill = {};
      for (const item of items) {
        (itemsByBill[item.order_id] ||= []).push({
          product_name: item.product_name,
          hsn_code: item.hsn_code || '',
          unit: item.unit || '',
          quantity: round2(item.quantity),
          unit_price: round2(item.unit_price),
          tax_rate: round2(item.tax_rate),
          tax_amount: round2(item.tax_amount),
          final_amount: round2(item.final_amount)
        });
      }

      const summary = { bills: 0, cancelledBills: 0, total_purchase: 0, paid: 0, balance_due: 0 };
      const billRows = bills.map((bill) => {
        const excluded = EXCLUDED_STATUSES.includes(bill.status);
        const balance = excluded ? 0 : Math.max(0, round2(bill.net_amount - bill.paid));
        if (excluded) {
          summary.cancelledBills += 1;
        } else {
          summary.bills += 1;
          summary.total_purchase += bill.net_amount;
          summary.paid += bill.paid;
          summary.balance_due += balance;
        }
        return {
          ...bill,
          net_amount: round2(bill.net_amount),
          paid: round2(bill.paid),
          balance_due: balance,
          excluded,
          items: itemsByBill[bill.id] || []
        };
      });
      for (const key of Object.keys(summary)) summary[key] = round2(summary[key]);
      summary.avg_bill = summary.bills ? round2(summary.total_purchase / summary.bills) : 0;

      // Products bought (completed bills only)
      const productRows = await all(
        `
        SELECT
          soi.product_name,
          TRIM(COALESCE(soi.hsn_code, '')) AS hsn_code,
          GROUP_CONCAT(DISTINCT soi.unit) AS units,
          SUM(COALESCE(soi.quantity, 0)) AS quantity,
          SUM(COALESCE(soi.final_amount, 0)) AS total_value,
          COUNT(DISTINCT so.id) AS times_bought,
          MAX(${LOCAL_DATE_SQL('so.order_date')}) AS last_bought
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.order_id
        WHERE ${customerCondition} AND ${ACTIVE_SQL}${rangeSql}
        GROUP BY LOWER(TRIM(soi.product_name)), TRIM(COALESCE(soi.hsn_code, ''))
        ORDER BY total_value DESC
        `,
        [...customerParams, ...rangeParams]
      );
      const products = productRows.map((p) => ({
        product_name: p.product_name,
        hsn_code: p.hsn_code,
        units: p.units || '',
        quantity: round2(p.quantity),
        total_value: round2(p.total_value),
        times_bought: p.times_bought,
        last_bought: p.last_bought
      }));

      // Account statement: bills are debits, payments against those bills are credits
      const ledgerBills = await all(
        `
        SELECT so.id, so.order_number, ${LOCAL_DATE_SQL('so.order_date')} AS entry_date, COALESCE(so.grand_total, 0) AS amount
        FROM sales_orders so
        WHERE ${customerCondition} AND ${ACTIVE_SQL}
        `,
        customerParams
      );
      const ledgerPayments = await all(
        `
        SELECT pr.id, pr.reference_id, so.order_number, ${LOCAL_DATE_SQL('pr.payment_date')} AS entry_date,
               COALESCE(pr.payment_amount, 0) AS amount, COALESCE(pr.payment_method, '') AS payment_method
        FROM payment_records pr
        JOIN sales_orders so ON so.id = pr.reference_id
        WHERE pr.record_type = 'sales' AND ${customerCondition} AND ${ACTIVE_SQL}
        `,
        customerParams
      );

      const entries = [
        ...ledgerBills.map((b) => ({ type: 'bill', id: b.id, date: b.entry_date, reference: b.order_number, debit: round2(b.amount), credit: 0 })),
        ...ledgerPayments.map((p) => ({ type: 'payment', id: p.id, order_id: p.reference_id, date: p.entry_date, reference: p.order_number, method: p.payment_method, debit: 0, credit: round2(p.amount) }))
      ].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        if (a.type !== b.type) return a.type === 'bill' ? -1 : 1; // bill before its payment on the same day
        return a.id - b.id;
      });

      let balance = round2(customer.opening_balance || 0);
      let openingBalance = balance;
      const statement = [];
      for (const entry of entries) {
        if (startDate && entry.date < startDate) {
          balance = round2(balance + entry.debit - entry.credit);
          openingBalance = balance;
          continue;
        }
        if (endDate && entry.date > endDate) break;
        balance = round2(balance + entry.debit - entry.credit);
        statement.push({ ...entry, balance });
      }
      const statementTotals = {
        opening_balance: openingBalance,
        debit: round2(statement.reduce((s, e) => s + e.debit, 0)),
        credit: round2(statement.reduce((s, e) => s + e.credit, 0)),
        closing_balance: statement.length ? statement[statement.length - 1].balance : openingBalance
      };

      return {
        success: true,
        customer: {
          id,
          is_walk_in: id <= 0,
          customer_name: customer.customer_name,
          mobile: customer.mobile_number || '',
          email: customer.email || '',
          gstin: customer.gstin || '',
          customer_type: customer.customer_type || '',
          address: [customer.address_line_1, customer.address_line_2, customer.city, customer.state, customer.pincode].filter(Boolean).join(', '),
          opening_balance: round2(customer.opening_balance || 0),
          credit_limit: round2(customer.credit_limit || 0)
        },
        summary,
        bills: billRows,
        products,
        statement,
        statementTotals
      };
    } catch (error) {
      console.error('❌ Customer history report error:', error);
      return { success: false, message: 'Failed to load customer history', error: error.message };
    }
  });

  console.log('✅ Report handlers initialized');
  return true;
}
