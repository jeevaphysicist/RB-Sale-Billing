import { ipcMain } from 'electron';

let globalDb = null;

export function initializePaymentRecordHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for payment record handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Payment Record handlers initialized with database:', !!db);

  const handlers = [
    'payment-record:create',
    'payment-record:get-all',
    'payment-record:get-by-id',
    'payment-record:get-by-po',
    'payment-record:update',
    'payment-record:delete',
    'payment-record:get-po-summary'
  ];
  
  console.log('📋 Registered payment record handlers:', handlers);

  // Create Payment Record
  ipcMain.handle('payment-record:create', async (event, paymentData) => {
    try {
      console.log('📥 Creating payment record with data:', paymentData);
      
      const {
        recordType, referenceId, paymentDate, paymentAmount, paymentMethod,
        referenceNumber, bankName, chequeNumber, transactionId, notes
      } = paymentData;

      // Validate required fields
      if (!recordType || !referenceId || !paymentDate || !paymentAmount) {
        return { success: false, message: 'Record Type, Reference ID, Payment Date, and Amount are required' };
      }

      // Validate record type
      if (!['purchase', 'sales'].includes(recordType)) {
        return { success: false, message: 'Invalid record type. Must be "purchase" or "sales"' };
      }

      // Verify order exists and get total amount
      const tableName = recordType === 'purchase' ? 'purchase_orders' : 'sales_orders';
      const amountColumn = recordType === 'purchase' ? 'net_payable' : 'grand_total';
      
      const orderExists = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT id, status, ${amountColumn} as total_amount FROM ${tableName} WHERE id = ?`,
          [referenceId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!orderExists) {
        return { success: false, message: `${recordType === 'purchase' ? 'Purchase' : 'Sales'} order not found` };
      }

      // Get total paid amount
      const totalPaid = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT COALESCE(SUM(payment_amount), 0) as total 
           FROM payment_records 
           WHERE record_type = ? AND reference_id = ?`,
          [recordType, referenceId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.total);
          }
        );
      });

      // Check if payment exceeds balance
      const balance = orderExists.total_amount - totalPaid;
      if (paymentAmount > balance) {
        return { 
          success: false, 
          message: `Payment amount (${paymentAmount}) exceeds balance (${balance})` 
        };
      }

      // Insert payment record
      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `INSERT INTO payment_records (
            record_type, reference_id, payment_date, payment_amount, payment_method,
            reference_number, bank_name, cheque_number, transaction_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recordType, referenceId, paymentDate, paymentAmount, paymentMethod,
            referenceNumber, bankName, chequeNumber, transactionId, notes
          ],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      // Recalculate total paid and update order payment status
      const newTotalPaid = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT COALESCE(SUM(payment_amount), 0) as total 
           FROM payment_records 
           WHERE record_type = ? AND reference_id = ?`,
          [recordType, referenceId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.total);
          }
        );
      });

      const newBalance = orderExists.total_amount - newTotalPaid;
      let newPaymentStatus;
      
      if (orderExists.status === 'cancelled') {
        newPaymentStatus = 'refunded';
      } else if (orderExists.status === 'returned' && newTotalPaid <= 0.01) {
        newPaymentStatus = 'refunded';
      } else if (newTotalPaid <= 0.01) {
        newPaymentStatus = 'pending';
      } else if (newBalance > 0.01) { // Using 0.01 to account for floating point precision
        newPaymentStatus = 'partial';
      } else {
        newPaymentStatus = 'paid';
      }

      // Update order with new payment status and balance
      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE ${tableName} 
           SET payment_status = ?, balance_amount = ?, received_amount = ?
           WHERE id = ?`,
          [newPaymentStatus, newBalance, newTotalPaid, referenceId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      console.log('✅ Payment record created with ID:', result.id);
      console.log(`   Updated ${recordType} order: Status=${newPaymentStatus}, Paid=${newTotalPaid}, Balance=${newBalance}`);
      return {
        success: true,
        message: 'Payment record created successfully',
        paymentId: result.id
      };

    } catch (error) {
      console.error('❌ Create payment record error:', error);
      return { success: false, message: 'Failed to create payment record: ' + error.message };
    }
  });

  // Get All Payment Records with order details
  ipcMain.handle('payment-record:get-all', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting payment records with filter params:', filterParams);
      const {
        searchTerm,
        recordType,
        referenceId,
        startDate,
        endDate,
        paymentMethod,
        sortKey = 'payment_date',
        sortDirection = 'DESC',
        page = 1,
        limit = 10
      } = filterParams;

      const offset = (page - 1) * limit;
      
      const validSortKeys = ['id', 'payment_date', 'payment_amount', 'payment_method', 'created_at'];
      const safeSortKey = validSortKeys.includes(sortKey) ? sortKey : 'payment_date';
      const safeSortDirection = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      
      let query = `
        SELECT 
          pr.*,
          CASE 
            WHEN pr.record_type = 'purchase' THEN po.po_number
            WHEN pr.record_type = 'sales' THEN so.order_number
          END as order_number,
          CASE 
            WHEN pr.record_type = 'purchase' THEN po.supplier_name
            WHEN pr.record_type = 'sales' THEN so.customer_name
          END as party_name,
          CASE 
            WHEN pr.record_type = 'purchase' THEN po.net_payable
            WHEN pr.record_type = 'sales' THEN so.grand_total
          END as net_payable
        FROM payment_records pr
        LEFT JOIN purchase_orders po ON pr.record_type = 'purchase' AND pr.reference_id = po.id
        LEFT JOIN sales_orders so ON pr.record_type = 'sales' AND pr.reference_id = so.id
      `;
      let countQuery = `SELECT COUNT(*) as total FROM payment_records pr`;
      const params = [];
      const countParams = [];
      const conditions = [];
      
      // Add filters
      if (searchTerm) {
        conditions.push(`(pr.reference_number LIKE ? OR pr.transaction_id LIKE ?)`);
        const searchParam = `%${searchTerm}%`;
        params.push(searchParam, searchParam);
        countParams.push(searchParam, searchParam);
      }
      
      if (recordType) {
        conditions.push(`pr.record_type = ?`);
        params.push(recordType);
        countParams.push(recordType);
      }
      
      if (referenceId) {
        conditions.push(`pr.reference_id = ?`);
        params.push(referenceId);
        countParams.push(referenceId);
      }
      
      if (paymentMethod) {
        conditions.push(`pr.payment_method = ?`);
        params.push(paymentMethod);
        countParams.push(paymentMethod);
      }
      
      if (startDate) {
        conditions.push(`pr.payment_date >= ?`);
        params.push(startDate);
        countParams.push(startDate);
      }
      
      if (endDate) {
        conditions.push(`pr.payment_date <= ?`);
        params.push(endDate);
        countParams.push(endDate);
      }
      
      if (conditions.length > 0) {
        const whereClause = ` WHERE ` + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }
      
      // Add sorting
      query += ` ORDER BY pr.${safeSortKey} ${safeSortDirection}`;
      
      // Add pagination
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      // Get total count
      const countResult = await new Promise((resolve, reject) => {
        globalDb.get(countQuery, countParams, (err, row) => {
          if (err) reject(err);
          else resolve(row.total);
        });
      });

      // Get paginated results
      const records = await new Promise((resolve, reject) => {
        globalDb.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      return {
        success: true,
        data: records,
        total: countResult,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      };
    } catch (error) {
      console.error('❌ Get payment records error:', error);
      return { success: false, message: 'Failed to fetch payment records', error: error.message };
    }
  });

  // Get Payment Record By ID
  ipcMain.handle('payment-record:get-by-id', async (event, paymentId) => {
    try {
      console.log('📥 Getting payment record by ID:', paymentId);
      
      if (!paymentId) {
        return { success: false, message: 'Payment Record ID is required' };
      }

      const record = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT 
            pr.*,
            CASE 
              WHEN pr.record_type = 'purchase' THEN po.po_number
              WHEN pr.record_type = 'sales' THEN so.order_number
            END as order_number,
            CASE 
              WHEN pr.record_type = 'purchase' THEN po.supplier_name
              WHEN pr.record_type = 'sales' THEN so.customer_name
            END as party_name,
            CASE 
              WHEN pr.record_type = 'purchase' THEN po.net_payable
              WHEN pr.record_type = 'sales' THEN so.grand_total
            END as net_payable
          FROM payment_records pr
          LEFT JOIN purchase_orders po ON pr.record_type = 'purchase' AND pr.reference_id = po.id
          LEFT JOIN sales_orders so ON pr.record_type = 'sales' AND pr.reference_id = so.id
          WHERE pr.id = ?`,
          [paymentId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!record) {
        return { success: false, message: 'Payment record not found' };
      }

      return {
        success: true,
        data: record
      };
    } catch (error) {
      console.error('❌ Get payment record error:', error);
      return { success: false, message: 'Failed to fetch payment record' };
    }
  });

  // Get Payment Records by Reference (PO or Sales Order)
  ipcMain.handle('payment-record:get-by-po', async (event, params) => {
    try {
      console.log('📥 Getting payment records for reference:', params);
      
      const { recordType, referenceId } = params;
      
      if (!recordType || !referenceId) {
        return { success: false, message: 'Record Type and Reference ID are required' };
      }

      const records = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT * FROM payment_records 
           WHERE record_type = ? AND reference_id = ? 
           ORDER BY payment_date DESC`,
          [recordType, referenceId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      return {
        success: true,
        data: records
      };
    } catch (error) {
      console.error('❌ Get payment records by reference error:', error);
      return { success: false, message: 'Failed to fetch payment records' };
    }
  });

  // Get Order Summary with Payment Info (Purchase or Sales)
  ipcMain.handle('payment-record:get-po-summary', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting order summary with payment info:', filterParams);
      const {
        recordType = 'purchase',
        searchTerm,
        status,
        partyId,
        startDate,
        endDate,
        sortKey,
        sortDirection = 'DESC',
        page = 1,
        limit = 10
      } = filterParams;

      const offset = (page - 1) * limit;
      
      // Determine table and column names based on record type
      const isPurchase = recordType === 'purchase';
      const tableName = isPurchase ? 'purchase_orders' : 'sales_orders';
      const tableAlias = isPurchase ? 'po' : 'so';
      const itemsTable = isPurchase ? 'purchase_order_items' : 'sales_order_items';
      const itemsAlias = isPurchase ? 'poi' : 'soi';
      const itemsForeignKey = isPurchase ? 'po_id' : 'order_id';
      const numberColumn = isPurchase ? 'po_number' : 'order_number';
      const dateColumn = isPurchase ? 'po_date' : 'order_date';
      const partyColumn = isPurchase ? 'supplier_name' : 'customer_name';
      const partyIdColumn = isPurchase ? 'supplier_id' : 'customer_id';
      
      const amountColumn = isPurchase ? 'net_payable' : 'grand_total';
      
      const defaultSortKey = sortKey || dateColumn;
      const validSortKeys = ['id', numberColumn, dateColumn, partyColumn, 'status', amountColumn];
      const safeSortKey = validSortKeys.includes(defaultSortKey) ? defaultSortKey : dateColumn;
      const safeSortDirection = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      
      let query = `
        SELECT 
          ${tableAlias}.*,
          (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = '${recordType}' AND reference_id = ${tableAlias}.id) as amount_paid,
          CASE 
            WHEN ${tableAlias}.status IN ('cancelled', 'returned') THEN 0
            ELSE (${tableAlias}.${amountColumn} - (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = '${recordType}' AND reference_id = ${tableAlias}.id)) 
          END as balance_amount,
          (SELECT COUNT(*) FROM ${itemsTable} WHERE ${itemsForeignKey} = ${tableAlias}.id) as item_count,
          CASE 
            WHEN ${tableAlias}.status IN ('cancelled', 'returned') THEN 'refunded'
            WHEN (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = '${recordType}' AND reference_id = ${tableAlias}.id) <= 0.01 THEN 'pending'
            WHEN (${tableAlias}.${amountColumn} - (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = '${recordType}' AND reference_id = ${tableAlias}.id)) > 0.01 THEN 'partial'
            ELSE 'paid'
          END as payment_status
        FROM ${tableName} ${tableAlias}
      `;
      
      let countQuery = `SELECT COUNT(DISTINCT ${tableAlias}.id) as total FROM ${tableName} ${tableAlias}`;
      const params = [];
      const countParams = [];
      const conditions = [];
      
      // Add filters
      if (searchTerm) {
        conditions.push(`(${tableAlias}.${numberColumn} LIKE ? OR ${tableAlias}.${partyColumn} LIKE ?)`);
        const searchParam = `%${searchTerm}%`;
        params.push(searchParam, searchParam);
        countParams.push(searchParam, searchParam);
      }
      
      if (status) {
        conditions.push(`${tableAlias}.status = ?`);
        params.push(status);
        countParams.push(status);
      }
      
      if (partyId) {
        conditions.push(`${tableAlias}.${partyIdColumn} = ?`);
        params.push(partyId);
        countParams.push(partyId);
      }
      
      if (startDate) {
        conditions.push(`${tableAlias}.${dateColumn} >= ?`);
        params.push(startDate);
        countParams.push(startDate);
      }
      
      if (endDate) {
        conditions.push(`${tableAlias}.${dateColumn} <= ?`);
        params.push(endDate);
        countParams.push(endDate);
      }
      
      if (conditions.length > 0) {
        const whereClause = ` WHERE ` + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }
      
      // Add sorting
      query += ` ORDER BY ${tableAlias}.${safeSortKey} ${safeSortDirection}`;
      
      // Add pagination
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      // Get total count
      const countResult = await new Promise((resolve, reject) => {
        globalDb.get(countQuery, countParams, (err, row) => {
          if (err) reject(err);
          else resolve(row.total);
        });
      });

      // Get paginated results
      const orders = await new Promise((resolve, reject) => {
        globalDb.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      return {
        success: true,
        data: orders,
        total: countResult,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      };
    } catch (error) {
      console.error('❌ Get PO summary error:', error);
      return { success: false, message: 'Failed to fetch PO summary', error: error.message };
    }
  });

  // Update Payment Record
  ipcMain.handle('payment-record:update', async (event, paymentData) => {
    try {
      console.log('📥 Updating payment record:', paymentData);
      
      const {
        id, paymentDate, paymentAmount, paymentMethod,
        referenceNumber, bankName, chequeNumber, transactionId, notes
      } = paymentData;

      if (!id) {
        return { success: false, message: 'Payment Record ID is required' };
      }

      // Get current payment record
      const currentRecord = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT * FROM payment_records WHERE id = ?`,
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!currentRecord) {
        return { success: false, message: 'Payment record not found' };
      }

      // Get order details
      const tableName = currentRecord.record_type === 'purchase' ? 'purchase_orders' : 'sales_orders';
      const amountColumn = currentRecord.record_type === 'purchase' ? 'net_payable' : 'grand_total';
      
      const order = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT ${amountColumn} as total_amount FROM ${tableName} WHERE id = ?`,
          [currentRecord.reference_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!order) {
        return { success: false, message: `${currentRecord.record_type === 'purchase' ? 'Purchase' : 'Sales'} order not found` };
      }

      // Get total paid amount (excluding current record)
      const totalPaid = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT COALESCE(SUM(payment_amount), 0) as total 
           FROM payment_records 
           WHERE record_type = ? AND reference_id = ? AND id != ?`,
          [currentRecord.record_type, currentRecord.reference_id, id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.total);
          }
        );
      });

      // Check if updated payment exceeds balance
      const balance = order.total_amount - totalPaid;
      if (paymentAmount > balance) {
        return { 
          success: false, 
          message: `Payment amount (${paymentAmount}) exceeds balance (${balance})` 
        };
      }

      // Update payment record
      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE payment_records SET
            payment_date = ?, payment_amount = ?, payment_method = ?,
            reference_number = ?, bank_name = ?, cheque_number = ?,
            transaction_id = ?, notes = ?,
            updated_at = datetime('now', '+5 hours', '30 minutes')
          WHERE id = ?`,
          [
            paymentDate, paymentAmount, paymentMethod,
            referenceNumber, bankName, chequeNumber,
            transactionId, notes, id
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      console.log('✅ Payment record updated:', id);
      return { success: true, message: 'Payment record updated successfully' };

    } catch (error) {
      console.error('❌ Update payment record error:', error);
      return { success: false, message: 'Failed to update payment record: ' + error.message };
    }
  });

  // Delete Payment Record
  ipcMain.handle('payment-record:delete', async (event, paymentId) => {
    try {
      console.log('📥 Deleting payment record:', paymentId);
      
      if (!paymentId) {
        return { success: false, message: 'Payment Record ID is required' };
      }

      // Get payment record details before deleting
      const paymentRecord = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT record_type, reference_id FROM payment_records WHERE id = ?`,
          [paymentId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!paymentRecord) {
        return { success: false, message: 'Payment record not found' };
      }

      // Delete the payment record
      await new Promise((resolve, reject) => {
        globalDb.run(
          `DELETE FROM payment_records WHERE id = ?`,
          [paymentId],
          function(err) {
            if (err) reject(err);
            else {
              if (this.changes === 0) {
                reject(new Error('Payment record not found'));
              } else {
                resolve();
              }
            }
          }
        );
      });

      // Recalculate payment status for the order
      const tableName = paymentRecord.record_type === 'purchase' ? 'purchase_orders' : 'sales_orders';
      const amountColumn = paymentRecord.record_type === 'purchase' ? 'net_payable' : 'grand_total';

      // Get order total
      const order = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT id, status, ${amountColumn} as total_amount FROM ${tableName} WHERE id = ?`,
          [paymentRecord.reference_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (order) {
        // Get new total paid
        const newTotalPaid = await new Promise((resolve, reject) => {
          globalDb.get(
            `SELECT COALESCE(SUM(payment_amount), 0) as total 
             FROM payment_records 
             WHERE record_type = ? AND reference_id = ?`,
            [paymentRecord.record_type, paymentRecord.reference_id],
            (err, row) => {
              if (err) reject(err);
              else resolve(row.total);
            }
          );
        });

        const newBalance = order.total_amount - newTotalPaid;
        let newPaymentStatus;
        
        if (order.status === 'cancelled') {
          newPaymentStatus = 'refunded';
        } else if (order.status === 'returned' && newTotalPaid <= 0.01) {
          newPaymentStatus = 'refunded';
        } else if (newTotalPaid <= 0.01) {
          newPaymentStatus = 'pending';
        } else if (newBalance > 0.01) {
          newPaymentStatus = 'partial';
        } else {
          newPaymentStatus = 'paid';
        }

        // Update order
        await new Promise((resolve, reject) => {
          globalDb.run(
            `UPDATE ${tableName} 
             SET payment_status = ?, balance_amount = ?, received_amount = ?
             WHERE id = ?`,
            [newPaymentStatus, newBalance, newTotalPaid, paymentRecord.reference_id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        console.log(`✅ Payment record ${paymentId} deleted successfully`);
        console.log(`   Updated ${paymentRecord.record_type} order: Status=${newPaymentStatus}, Paid=${newTotalPaid}, Balance=${newBalance}`);
      }

      return { success: true, message: 'Payment record deleted successfully' };
    } catch (error) {
      console.error('❌ Delete payment record error:', error);
      return {
        success: false,
        message: 'Failed to delete payment record: ' + error.message
      };
    }
  });

  console.log('✅ Payment Record IPC handlers registered');
}
