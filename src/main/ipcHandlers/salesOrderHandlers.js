import { ipcMain } from 'electron';

import { addTransaction } from './ledgerHandlers.js';
import { createSalesOrder, getNextOrderNumber } from '../services/orderService.js';

let globalDb = null;

export function initializeSalesOrderHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for sales order handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Sales Order handlers initialized with database:', !!db);

  // Log all registered handlers
  const handlers = [
    'sales-order:create',
    'sales-order:get-all',
    'sales-order:get-by-id',
    'sales-order:update',
    'sales-order:delete',
    'sales-order:get-next-number'
  ];
  
  console.log('📋 Registered sales order handlers:', handlers);

  // Get Next Order Number
  ipcMain.handle('sales-order:get-next-number', async () => {
    try {
      const nextNumber = await getNextOrderNumber(globalDb);
      return { success: true, data: nextNumber };
    } catch (error) {
      console.error('❌ Get next order number error:', error);
      return { success: false, message: 'Failed to generate order number' };
    }
  });

  // Create Sales Order
  ipcMain.handle('sales-order:create', async (event, orderData) => {
    try {
      const result = await createSalesOrder(globalDb, orderData);
      
      // Emit event to update sequence in all windows
      const newNextNumber = await getNextOrderNumber(globalDb);
      event.sender.send('sales-order:sequence-updated', newNextNumber);

      return {
        success: true,
        message: 'Sales order created successfully',
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        nextOrderNumber: newNextNumber
      };

    } catch (error) {
      console.error('❌ Create sales order error:', error);
      return { success: false, message: 'Failed to create sales order: ' + error.message };
    }
  });

  // Get All Sales Orders
  ipcMain.handle('sales-order:get-all', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting sales orders with filter params:', filterParams);
      const { searchTerm, sortKey = 'order_date', sortDirection = 'DESC', page = 1, limit = 10 } = filterParams;
      const offset = (page - 1) * limit;
      
      // Validate sortKey
      const validSortKeys = ['id', 'order_number', 'order_date', 'customer_name', 'grand_total', 'status', 'payment_status'];
      const safeSortKey = validSortKeys.includes(sortKey) ? sortKey : 'order_date';
      const safeSortDirection = sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      let query = `
        SELECT 
          so.*,
          (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = 'sales' AND reference_id = so.id) as amount_paid,
          CASE 
            WHEN so.status IN ('cancelled', 'returned') THEN 0
            ELSE (so.grand_total - (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = 'sales' AND reference_id = so.id)) 
          END as balance_amount,
          CASE 
            WHEN so.status IN ('cancelled', 'returned') THEN 'refunded'
            WHEN (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = 'sales' AND reference_id = so.id) <= 0.01 THEN 'pending'
            WHEN (so.grand_total - (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = 'sales' AND reference_id = so.id)) > 0.01 THEN 'partial'
            ELSE 'paid'
          END as payment_status
        FROM sales_orders so
      `;
      let countQuery = `SELECT COUNT(*) as total FROM sales_orders so`;
      const params = [];
      const countParams = [];
      
      // Add search filter
      if (searchTerm) {
        const searchCondition = ` WHERE so.order_number LIKE ? OR so.customer_name LIKE ? OR so.customer_phone LIKE ?`;
        query += searchCondition;
        countQuery += searchCondition;
        const searchParam = `%${searchTerm}%`;
        params.push(searchParam, searchParam, searchParam);
        countParams.push(searchParam, searchParam, searchParam);
      }
      
      // Add sorting
      query += ` ORDER BY so.${safeSortKey} ${safeSortDirection}`;
      
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

      // Add serial number (sno) to each order
      const ordersWithSno = orders.map((order, index) => ({
        sno: offset + index + 1,
        ...order
      }));

      return {
        success: true,
        data: ordersWithSno,
        total: countResult,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      };
    } catch (error) {
      console.error('❌ Get sales orders error:', error);
      return { success: false, message: 'Failed to fetch sales orders', error: error.message };
    }
  });

  // Get Sales Order by ID
  ipcMain.handle('sales-order:get-by-id', async (event, orderId) => {
    try {
      if (!orderId) {
        return { success: false, message: 'Order ID is required' };
      }

      // Get order details
      const order = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT * FROM sales_orders WHERE id = ?`,
          [orderId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!order) {
        return { success: false, message: 'Sales order not found' };
      }

      // Get order items
      const items = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT * FROM sales_order_items WHERE order_id = ?`,
          [orderId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      // Get order totals
      const totals = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT * FROM sales_order_totals WHERE order_id = ?`,
          [orderId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Get payment records
      const paymentRecords = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT * FROM payment_records WHERE record_type = 'sales' AND reference_id = ?`,
          [orderId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      const amount_paid = paymentRecords.reduce((sum, record) => sum + (record.payment_amount || 0), 0);
      const balance_amount = (order.status === 'returned' || order.status === 'cancelled') ? 0 : Math.max(0, (order.grand_total || 0) - amount_paid);
      
      // Calculate dynamic payment status
      let payment_status = order.payment_status;
      if (order.status === 'returned' && amount_paid <= 0.01) {
        payment_status = 'refunded';
      } else if (order.status === 'cancelled') {
        payment_status = 'refunded';
      } else if (amount_paid <= 0.01) {
        payment_status = 'pending';
      } else if ((order.grand_total - amount_paid) > 0.01) {
        payment_status = 'partial';
      } else {
        payment_status = 'paid';
      }

      return { 
        success: true, 
        data: {
          ...order,
          items,
          totals,
          paymentRecords,
          amount_paid,
          balance_amount,
          payment_status
        }
      };
    } catch (error) {
      console.error('❌ Get sales order error:', error);
      return { success: false, message: 'Failed to fetch sales order' };
    }
  });

  // Update Sales Order (Limited update capabilities for now)
  // Update Sales Order
  ipcMain.handle('sales-order:update', async (event, orderData) => {
    try {
      console.log('📥 Updating sales order:', orderData);
      
      const { 
        id, orderDate, orderTime, customer, storeDetails, 
        items, calculations, payment, status, additionalInfo
      } = orderData;

      if (!id) {
        return { success: false, message: 'Order ID is required' };
      }

      // Start transaction
      await new Promise((resolve, reject) => {
        globalDb.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Helper to sanitize parameters (replace undefined with null)
      const sanitizeParams = (params) => params.map(p => p === undefined ? null : p);

      try {
        // Get order number for logging
        const order = await new Promise((resolve, reject) => {
          globalDb.get(`SELECT * FROM sales_orders WHERE id = ?`, [id], (err, row) => {
            if (err) reject(err); else resolve(row);
          });
        });

        if (!order) {
           throw new Error('Order not found');
        }
        const orderNumber = order.order_number;

        // 1. Delete old items
        await new Promise((resolve, reject) => {
          globalDb.run(
            `DELETE FROM sales_order_items WHERE order_id = ?`,
            [id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // 2. Insert new items (free-text line items, no product master)
        for (const item of items) {
          await new Promise((resolve, reject) => {
            const itemParams = [
              id, item.productName, item.productCode, item.hsnCode, item.category, item.unit,
              item.quantity, item.unitPrice, item.mrp,
              item.itemDiscount, item.itemDiscountAmount,
              item.taxRate, item.sgstAmount, item.cgstAmount, item.igstAmount, item.totalTaxAmount,
              item.grossAmount, item.netAmount, item.finalAmount
            ];

            globalDb.run(
              `INSERT INTO sales_order_items (
                order_id, product_name, product_code, hsn_code, category, unit,
                quantity, unit_price, mrp,
                discount_percent, discount_amount,
                tax_rate, sgst_amount, cgst_amount, igst_amount, tax_amount,
                gross_amount, net_amount, final_amount
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              sanitizeParams(itemParams),
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        // 4.5 REVERSE OLD LEDGER TRANSACTIONS
        // A. Restore Old Loyalty Points
        if ((order.loyalty_points_used || 0) > 0 && order.customer_id) {
            await addTransaction(globalDb, {
                customerId: order.customer_id,
                type: 'CREDIT', // Points balance increases (Refund)
                category: 'LOYALTY_REFUND',
                points: order.loyalty_points_used || 0,
                amount: 0,
                referenceType: 'sales_order',
                referenceId: id,
                referenceNumber: orderNumber,
                description: `Adjustment (Refund) for Edit Order #${orderNumber}`
            });
        }

        // B. Reverse Old Credit Balance
        if ((order.balance_amount || 0) > 0.01 && order.customer_id) {
             await addTransaction(globalDb, {
                customerId: order.customer_id,
                type: 'CREDIT',
                category: 'SALES_REVERSAL',
                amount: order.balance_amount,
                points: 0,
                referenceType: 'sales_order',
                referenceId: id,
                referenceNumber: orderNumber,
                description: `Adjustment (Reversal) for Edit Order #${orderNumber}`
            });
        }

        // 5. Update sales_orders table
        await new Promise((resolve, reject) => {
          const params = [
            customer.id, customer.name, customer.phone, customer.email, customer.address,
            storeDetails.cashier, storeDetails.cashierId,
            status.orderStatus, status.paymentStatus, status.deliveryStatus,
            calculations.subtotal, calculations.billDiscountAmount, calculations.taxDetails.totalTaxAmount,
            calculations.roundOffAmount, calculations.grandTotal,
            payment.paymentType, payment.paymentMethod, payment.receivedAmount, payment.changeAmount,
            payment.splitPayments?.cash || 0, payment.splitPayments?.card || 0, payment.splitPayments?.upi || 0, payment.splitPayments?.credit || 0, payment.splitPayments?.loyaltyPoints || 0,
            calculations.loyaltyPointsUsed, calculations.loyaltyPointsValue,
            payment.balanceAmount || 0,
            orderData.priceLevel || 'Retail',
            id
          ];

          globalDb.run(
            `UPDATE sales_orders SET
              customer_id = ?, customer_name = ?, customer_phone = ?, customer_email = ?, customer_address = ?,
              cashier_name = ?, cashier_id = ?,
              status = ?, payment_status = ?, delivery_status = ?,
              subtotal = ?, discount_total = ?, tax_total = ?, round_off = ?, grand_total = ?,
              payment_type = ?, payment_method = ?, received_amount = ?, change_amount = ?,
              split_payment_cash = ?, split_payment_card = ?, split_payment_upi = ?, split_payment_credit = ?, split_payment_loyalty = ?,
              loyalty_points_used = ?, loyalty_points_amount = ?,
              balance_amount = ?,
              price_category = ?,
              updated_at = datetime('now', '+5 hours', '30 minutes')
            WHERE id = ?`,
            sanitizeParams(params),
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // 6. Update totals table
        await new Promise((resolve, reject) => {
          const totalParams = [
            calculations.itemCount, calculations.totalQuantity,
            calculations.subtotal,
            calculations.totalItemDiscounts, calculations.billDiscount, calculations.billDiscountType, calculations.billDiscountAmount,
            calculations.taxDetails.taxableAmount, calculations.taxDetails.totalSgst, calculations.taxDetails.totalCgst,
            calculations.taxDetails.totalIgst, calculations.taxDetails.totalTaxAmount,
            calculations.amountBeforeTax, calculations.amountAfterTax,
            calculations.roundOffAmount, calculations.grandTotal,
            id
          ];

          globalDb.run(
            `UPDATE sales_order_totals SET
              item_count = ?, total_quantity = ?,
              subtotal = ?,
              total_item_discount = ?, bill_discount = ?, bill_discount_type = ?, bill_discount_amount = ?,
              taxable_amount = ?, total_sgst = ?, total_cgst = ?, total_igst = ?, total_tax_amount = ?,
              amount_before_tax = ?, amount_after_tax = ?,
              round_off_amount = ?, grand_total = ?
            WHERE order_id = ?`,
            sanitizeParams(totalParams),
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // 7. NEW LEDGER TRANSACTIONS
        // A. Apply New Loyalty Points Used
        if (calculations.loyaltyPointsUsed > 0 && customer.id) {
            await addTransaction(globalDb, {
                customerId: customer.id,
                type: 'DEBIT',
                category: 'LOYALTY_USED',
                points: calculations.loyaltyPointsUsed,
                amount: 0,
                referenceType: 'sales_order',
                referenceId: id,
                referenceNumber: orderNumber,
                description: `Points used in Order #${orderNumber}`
            });
        }

        // B. Apply New Credit Balance
        // We need to calculate the NEW balance amount explicitly here or rely on the passed value.
        // payment.balanceAmount is passed from frontend.
        const newBalance = payment.balanceAmount || 0;
        if (newBalance > 0.01 && customer.id) {
             await addTransaction(globalDb, {
                customerId: customer.id,
                type: 'DEBIT',
                category: 'SALES',
                amount: newBalance,
                points: 0,
                referenceType: 'sales_order',
                referenceId: id,
                referenceNumber: orderNumber,
                description: `Credit Sale Balance for Order #${orderNumber}`
            });
        }

        // Commit transaction
        await new Promise((resolve, reject) => {
          globalDb.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        console.log('✅ Sales order updated successfully with stock adjustments');
        return { 
          success: true, 
          message: 'Sales order updated successfully',
          orderId: id,
          orderNumber: orderNumber
        };

      } catch (error) {
        // Rollback on error
        await new Promise((resolve) => {
          globalDb.run('ROLLBACK', () => resolve());
        });
        throw error;
      }

    } catch (error) {
      console.error('❌ Update sales order error:', error);
      return { success: false, message: 'Failed to update sales order: ' + error.message };
    }
  });

  // Cancel Sales Order
  ipcMain.handle('sales-order:cancel', async (event, orderId) => {
    try {
      if (!orderId) {
        return { success: false, message: 'Order ID is required' };
      }

      // Start transaction
      await new Promise((resolve, reject) => {
        globalDb.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      try {
        // Get order details
        const order = await new Promise((resolve, reject) => {
          globalDb.get(
            `SELECT * FROM sales_orders WHERE id = ?`,
            [orderId],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (!order) {
          await new Promise((resolve) => globalDb.run('ROLLBACK', () => resolve()));
          return { success: false, message: 'Sales order not found' };
        }

        if (order.status === 'cancelled') {
          await new Promise((resolve) => globalDb.run('ROLLBACK', () => resolve()));
          return { success: false, message: 'Order is already cancelled' };
        }

        // REVERSE LEDGER TRANSACTIONS
        // A. Restore Loyalty Points
        if ((order.loyalty_points_used || 0) > 0 && order.customer_id) {
            await addTransaction(globalDb, {
                customerId: order.customer_id,
                type: 'CREDIT', // Points balance increases (Refund)
                category: 'LOYALTY_REFUND',
                points: order.loyalty_points_used || 0,
                amount: 0,
                referenceType: 'sales_order',
                referenceId: orderId,
                referenceNumber: order.order_number,
                description: `Refund Points for Cancelled Order #${order.order_number}`
            });
        }

        // B. Reverse Credit Balance
        if ((order.balance_amount || 0) > 0.01 && order.customer_id) {
             await addTransaction(globalDb, {
                customerId: order.customer_id,
                type: 'CREDIT', // Owe less money (Reversal)
                category: 'RETURN', 
                amount: order.balance_amount, // Reduce debt by this amount
                points: 0,
                referenceType: 'sales_order',
                referenceId: orderId,
                referenceNumber: order.order_number,
                description: `Reversal of Balance for Cancelled Order #${order.order_number}`
            });
        }

        // Update order status
        await new Promise((resolve, reject) => {
          globalDb.run(
            `UPDATE sales_orders SET 
              status = 'cancelled', 
              updated_at = datetime('now', '+5 hours', '30 minutes')
             WHERE id = ?`,
            [orderId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // Commit transaction
        await new Promise((resolve, reject) => {
          globalDb.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        return { success: true, message: 'Sales order cancelled successfully' };

      } catch (error) {
        // Rollback on error
        await new Promise((resolve) => {
          globalDb.run('ROLLBACK', () => resolve());
        });
        throw error;
      }

    } catch (error) {
      console.error('❌ Cancel sales order error:', error);
      return { success: false, message: 'Failed to cancel sales order: ' + error.message };
    }
  });

  // Return Sales Order
  ipcMain.handle('sales-order:return', async (event, orderId) => {
    try {
      if (!orderId) {
        return { success: false, message: 'Order ID is required' };
      }

      // Start transaction
      await new Promise((resolve, reject) => {
        globalDb.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      try {
        // Get order details
        const order = await new Promise((resolve, reject) => {
          globalDb.get(
            `SELECT * FROM sales_orders WHERE id = ?`,
            [orderId],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (!order) {
          await new Promise((resolve) => globalDb.run('ROLLBACK', () => resolve()));
          return { success: false, message: 'Sales order not found' };
        }

        if (order.status === 'returned') {
          await new Promise((resolve) => globalDb.run('ROLLBACK', () => resolve()));
          return { success: false, message: 'Order is already returned' };
        }

        if (order.status === 'cancelled') {
          await new Promise((resolve) => globalDb.run('ROLLBACK', () => resolve()));
          return { success: false, message: 'Cannot return a cancelled order' };
        }

        if (order.status === 'draft') {
          await new Promise((resolve) => globalDb.run('ROLLBACK', () => resolve()));
          return { success: false, message: 'Cannot return a draft order. Use delete instead.' };
        }

        // REVERSE LEDGER TRANSACTIONS
        // A. Restore Loyalty Points
        if ((order.loyalty_points_used || 0) > 0 && order.customer_id) {
            await addTransaction(globalDb, {
                customerId: order.customer_id,
                type: 'CREDIT', // Points balance increases (Refund)
                category: 'LOYALTY_REFUND',
                points: order.loyalty_points_used || 0,
                amount: 0,
                referenceType: 'sales_order',
                referenceId: orderId,
                referenceNumber: order.order_number,
                description: `Refund Points for Returned Order #${order.order_number}`
            });
        }

        // B. Reverse Credit Balance
        if ((order.balance_amount || 0) > 0.01 && order.customer_id) {
             await addTransaction(globalDb, {
                customerId: order.customer_id,
                type: 'CREDIT', // Owe less money (Reversal)
                category: 'RETURN', 
                amount: order.balance_amount, // Reduce debt by this amount
                points: 0,
                referenceType: 'sales_order',
                referenceId: orderId,
                referenceNumber: order.order_number,
                description: `Reversal of Balance for Returned Order #${order.order_number}`
            });
        }

        // Update order status
        await new Promise((resolve, reject) => {
          globalDb.run(
            `UPDATE sales_orders SET 
              status = 'returned', 
              updated_at = datetime('now', '+5 hours', '30 minutes')
             WHERE id = ?`,
            [orderId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // Commit transaction
        await new Promise((resolve, reject) => {
          globalDb.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        return { success: true, message: 'Sales order returned successfully' };

      } catch (error) {
        // Rollback on error
        await new Promise((resolve) => {
          globalDb.run('ROLLBACK', () => resolve());
        });
        throw error;
      }

    } catch (error) {
      console.error('❌ Return sales order error:', error);
      return { success: false, message: 'Failed to return sales order: ' + error.message };
    }
  });

  // Delete Sales Order
  ipcMain.handle('sales-order:delete', async (event, orderId) => {
    try {
      if (!orderId) {
        return { success: false, message: 'Order ID is required' };
      }

      // Start transaction
      await new Promise((resolve, reject) => {
        globalDb.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      try {
        // Get order details for logging and ledger reversal
        const order = await new Promise((resolve, reject) => {
          globalDb.get(
            `SELECT * FROM sales_orders WHERE id = ?`,
            [orderId],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (!order) {
          await new Promise((resolve) => globalDb.run('ROLLBACK', () => resolve()));
          return { success: false, message: 'Sales order not found' };
        }

        // REVERSE LEDGER TRANSACTIONS
        // A. Restore Loyalty Points
        if ((order.loyalty_points_used || 0) > 0 && order.customer_id) {
            await addTransaction(globalDb, {
                customerId: order.customer_id,
                type: 'CREDIT', // Points balance increases (Refund)
                category: 'LOYALTY_REFUND',
                points: order.loyalty_points_used || 0,
                amount: 0,
                referenceType: 'sales_order',
                referenceId: orderId,
                referenceNumber: order.order_number,
                description: `Refund Points for Deleted Order #${order.order_number}`
            });
        }

        // B. Reverse Credit Balance
        if ((order.balance_amount || 0) > 0.01 && order.customer_id) {
             await addTransaction(globalDb, {
                customerId: order.customer_id,
                type: 'CREDIT', // Owe less money (Reversal)
                category: 'RETURN', // or SALES_REVERSAL
                amount: order.balance_amount, // Reduce debt by this amount
                points: 0,
                referenceType: 'sales_order',
                referenceId: orderId,
                referenceNumber: order.order_number,
                description: `Reversal of Balance for Deleted Order #${order.order_number}`
            });
        }

        // Delete from sales_orders (Cascade delete should handle items and totals if configured, but explicit delete is safer)
        await new Promise((resolve, reject) => {
          globalDb.run(`DELETE FROM sales_order_totals WHERE order_id = ?`, [orderId], (err) => {
             if (err) reject(err); else resolve();
          });
        });

        await new Promise((resolve, reject) => {
          globalDb.run(`DELETE FROM sales_order_items WHERE order_id = ?`, [orderId], (err) => {
             if (err) reject(err); else resolve();
          });
        });

        await new Promise((resolve, reject) => {
          globalDb.run(`DELETE FROM sales_orders WHERE id = ?`, [orderId], (err) => {
             if (err) reject(err); else resolve();
          });
        });

        // Commit transaction
        await new Promise((resolve, reject) => {
          globalDb.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        return { success: true, message: 'Sales order deleted successfully' };

      } catch (error) {
        // Rollback transaction on error
        await new Promise((resolve) => {
          globalDb.run('ROLLBACK', () => resolve());
        });
        throw error;
      }

    } catch (error) {
      console.error('❌ Delete sales order error:', error);
      return { success: false, message: 'Failed to delete sales order' };
    }
  });

  // Get Sales Order Payment Summary
  ipcMain.handle('sales-order:get-payment-summary', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting sales order payment summary with filters:', filterParams);
      const {
        searchTerm,
        status,
        customerId,
        startDate,
        endDate,
        sortKey = 'order_date',
        sortDirection = 'DESC',
        page = 1,
        limit = 10
      } = filterParams;

      const offset = (page - 1) * limit;
      
      const validSortKeys = ['id', 'order_number', 'order_date', 'customer_name', 'status', 'grand_total'];
      const safeSortKey = validSortKeys.includes(sortKey) ? sortKey : 'order_date';
      const safeSortDirection = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      
      let query = `
        SELECT 
          so.*,
          (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = 'sales' AND reference_id = so.id) as amount_paid,
          CASE 
            WHEN so.status IN ('cancelled', 'returned') THEN 0
            ELSE (so.grand_total - (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = 'sales' AND reference_id = so.id)) 
          END as balance_amount,
          (SELECT COUNT(*) FROM sales_order_items WHERE order_id = so.id) as item_count,
          CASE 
            WHEN so.status IN ('cancelled', 'returned') THEN 'refunded'
            WHEN (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = 'sales' AND reference_id = so.id) <= 0.01 THEN 'pending'
            WHEN (so.grand_total - (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_records WHERE record_type = 'sales' AND reference_id = so.id)) > 0.01 THEN 'partial'
            ELSE 'paid'
          END as payment_status
        FROM sales_orders so
      `;
      
      let countQuery = `SELECT COUNT(DISTINCT so.id) as total FROM sales_orders so`;
      const params = [];
      const countParams = [];
      const conditions = [];
      
      // Add filters
      if (searchTerm) {
        conditions.push(`(so.order_number LIKE ? OR so.customer_name LIKE ?)`);
        const searchParam = `%${searchTerm}%`;
        params.push(searchParam, searchParam);
        countParams.push(searchParam, searchParam);
      }
      
      if (status) {
        conditions.push(`so.status = ?`);
        params.push(status);
        countParams.push(status);
      }
      
      if (customerId) {
        conditions.push(`so.customer_id = ?`);
        params.push(customerId);
        countParams.push(customerId);
      }
      
      if (startDate) {
        conditions.push(`so.order_date >= ?`);
        params.push(startDate);
        countParams.push(startDate);
      }
      
      if (endDate) {
        conditions.push(`so.order_date <= ?`);
        params.push(endDate);
        countParams.push(endDate);
      }
      
      if (conditions.length > 0) {
        const whereClause = ` WHERE ` + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }
      
      // Add sorting
      query += ` ORDER BY so.${safeSortKey} ${safeSortDirection}`;
      
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

      // Add serial number (sno) to each order
      const ordersWithSno = orders.map((order, index) => ({
        sno: offset + index + 1,
        ...order
      }));

      return {
        success: true,
        data: ordersWithSno,
        total: countResult,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      };
    } catch (error) {
      console.error('❌ Get sales order payment summary error:', error);
      return { success: false, message: 'Failed to fetch sales order payment summary', error: error.message };
    }
  });

  // Generate Sales Order PDF
  ipcMain.handle('sales-order:generate-pdf', async (event, { orderData, orderId, templateType }) => {
    try {
      const { generateSalesOrderPDF } = await import('../utils/pdfGenerator.js');
      
      let finalOrderData = orderData;
      let templateConfig = {};
      let templateName = templateType || 'A4'; // Default to A4 if not provided

      // If orderId is provided, fetch fresh data from DB
      if (orderId) {
        console.log('📄 Generating PDF for Order ID:', orderId);
        
        // 1. Fetch Order Basic Info
        const order = await new Promise((resolve, reject) => {
          globalDb.get(`SELECT * FROM sales_orders WHERE id = ?`, [orderId], (err, row) => {
            if (err) reject(err); else resolve(row);
          });
        });

        if (!order) throw new Error('Order not found');

        // 2. Fetch Items
        const items = await new Promise((resolve, reject) => {
          globalDb.all(`SELECT * FROM sales_order_items WHERE order_id = ?`, [orderId], (err, rows) => {
            if (err) reject(err); else resolve(rows || []);
          });
        });

        // 3. Fetch Totals
        const totals = await new Promise((resolve, reject) => {
          globalDb.get(`SELECT * FROM sales_order_totals WHERE order_id = ?`, [orderId], (err, row) => {
            if (err) reject(err); else resolve(row);
          });
        });

        // 4. Fetch Payment Records (to calculate received amount correctly)
        const paymentRecords = await new Promise((resolve, reject) => {
          globalDb.all(`SELECT * FROM payment_records WHERE record_type = 'sales' AND reference_id = ?`, [orderId], (err, rows) => {
            if (err) reject(err); else resolve(rows || []);
          });
        });

        // 5. Fetch Store Settings
        const storeSettings = await new Promise((resolve, reject) => {
          globalDb.get(`SELECT * FROM store_settings LIMIT 1`, (err, row) => {
            if (err) reject(err); else resolve(row);
          });
        });

        // 6. Fetch Template Settings
        const templateSettings = await new Promise((resolve, reject) => {
          globalDb.get(`SELECT * FROM template_settings WHERE document_type = 'sales_order'`, (err, row) => {
            if (err) reject(err); else resolve(row);
          });
        });

        if (templateSettings) {
          templateName = templateSettings.template_name || templateName;
          if (templateSettings.config) {
            try {
              templateConfig = JSON.parse(templateSettings.config);
            } catch (e) {
              console.error('Error parsing template config:', e);
            }
          }
        }

        // Calculate total paid amount from payment records
        const totalPaid = paymentRecords.reduce((sum, record) => sum + (record.payment_amount || 0), 0);

        // 7. Construct the nested object structure expected by pdfGenerator
        finalOrderData = {
          id: order.id,
          orderNumber: order.order_number,
          orderDate: order.order_date,
          orderTime: order.order_time,
          customer: {
            id: order.customer_id,
            name: order.customer_name || 'Walk-in Customer',
            phone: order.customer_phone || '',
            email: order.customer_email || '',
            address: order.customer_address || '',
            gstin: order.customer_gstin || ''
          },
          storeDetails: {
            store: storeSettings?.store_name || order.store_name || '',
            counter: order.counter_name || '',
            cashier: order.cashier_name || '',
            // Include individual fields for A4 templates
            address_line1: storeSettings?.address_line1 || '',
            address_line2: storeSettings?.address_line2 || '',
            city: storeSettings?.city || '',
            state: storeSettings?.state || '',
            pincode: storeSettings?.pincode || '',
            district: storeSettings?.district || '',
            pan: storeSettings?.pan || '',
            // Keep concatenated address for backward compatibility with thermal templates
            address: storeSettings?.address_line1 ? `${storeSettings.address_line1}${storeSettings.address_line2 ? ', ' + storeSettings.address_line2 : ''}, ${storeSettings.city}, ${storeSettings.state} - ${storeSettings.pincode}` : '',
            phone: storeSettings?.phone || '',
            email: storeSettings?.email || '',
            website: storeSettings?.website || '',
            gstin: storeSettings?.gstin || '',
            god_name: storeSettings?.god_name || '',
            fassai_no: storeSettings?.fassai_no || ''
          },
          items: items.map(item => ({
            productName: item.product_name,
            productCode: item.product_code,
            hsnCode: item.hsn_code,
            hsnCode: item.hsn_code,
            category: item.category,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            mrp: item.mrp,
            itemDiscount: item.discount_percent,
            itemDiscountAmount: item.discount_amount,
            taxRate: item.tax_rate,
            sgstAmount: item.sgst_amount,
            cgstAmount: item.cgst_amount,
            igstAmount: item.igst_amount,
            totalTaxAmount: item.tax_amount,
            grossAmount: item.gross_amount,
            netAmount: item.net_amount,
            finalAmount: item.final_amount
          })),
          calculations: {
            itemCount: totals?.item_count || 0,
            totalQuantity: totals?.total_quantity || 0,
            subtotal: totals?.subtotal || 0,
            totalItemDiscounts: totals?.total_item_discount || 0,
            billDiscount: totals?.bill_discount || 0,
            billDiscountType: totals?.bill_discount_type || 'percentage',
            billDiscountAmount: totals?.bill_discount_amount || 0,
            taxDetails: {
              taxableAmount: totals?.taxable_amount || 0,
              totalSgst: totals?.total_sgst || 0,
              totalCgst: totals?.total_cgst || 0,
              totalIgst: totals?.total_igst || 0,
              totalTaxAmount: totals?.total_tax_amount || 0
            },
            amountBeforeTax: totals?.amount_before_tax || 0,
            amountAfterTax: totals?.amount_after_tax || 0,
            roundOffAmount: totals?.round_off_amount || 0,
            grandTotal: totals?.grand_total || 0,
            loyaltyPointsUsed: order.loyalty_points_used || 0,
            loyaltyPointsValue: order.loyalty_points_amount || 0
          },
          payment: {
            paymentType: order.payment_type,
            paymentMethod: order.payment_method,
            receivedAmount: totalPaid,
            changeAmount: order.change_amount,
            balanceAmount: (totals?.grand_total || 0) - totalPaid,
            splitPayments: {
              cash: order.split_payment_cash || 0,
              card: order.split_payment_card || 0,
              upi: order.split_payment_upi || 0,
              credit: order.split_payment_credit || 0,
              loyaltyPoints: order.split_payment_loyalty || 0
            }
          },
          status: {
            orderStatus: order.status,
            paymentStatus: order.payment_status,
            deliveryStatus: order.delivery_status
          },
          additionalInfo: {
            customerNotes: order.notes || ''
          }
        };
      }

      // Pass templateName (which might be updated from DB) and templateConfig
      const pdfResult = await generateSalesOrderPDF(finalOrderData, templateName, templateConfig);
      
      // Handle both old (buffer only) and new (object) return types
      let pdfBuffer = pdfResult;
      let height = null;
      let width = null;

      if (pdfResult && !Buffer.isBuffer(pdfResult) && pdfResult.buffer) {
        pdfBuffer = pdfResult.buffer;
        height = pdfResult.height;
        width = pdfResult.width;
      }

      return { 
        success: true, 
        data: pdfBuffer,
        height: height,
        width: width
      };
    } catch (error) {
      console.error('❌ Generate PDF error:', error);
      return { success: false, message: 'Failed to generate PDF: ' + error.message };
    }
  });

  console.log('✅ Sales Order IPC handlers registered');
}
