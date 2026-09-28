import { logStockMovement } from '../ipcHandlers/stockMovementHandlers.js';
import { addTransaction } from '../ipcHandlers/ledgerHandlers.js';

// Helper to generate next order number
export const getNextOrderNumber = async (db) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT order_number FROM sales_orders ORDER BY id DESC LIMIT 1`,
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        const currentYear = new Date().getFullYear();
        const prefix = `SO-${currentYear}-`;
        
        if (!row || !row.order_number) {
          resolve(`${prefix}001`);
          return;
        }

        // Extract number from last order (assuming format SO-YYYY-XXX)
        const lastOrderNumber = row.order_number;
        const parts = lastOrderNumber.split('-');
        
        if (parts.length === 3 && parts[1] === String(currentYear)) {
          const lastSequence = parseInt(parts[2], 10);
          if (!isNaN(lastSequence)) {
            const nextSequence = String(lastSequence + 1).padStart(3, '0');
            resolve(`${prefix}${nextSequence}`);
            return;
          }
        }

        // Fallback if format doesn't match or new year
        resolve(`${prefix}001`);
      }
    );
  });
};

const resolveCustomerId = (customer) => {
  const id = customer?.id;
  if (id == null || id === '' || Number(id) <= 0) return null;
  return Number(id);
};

const productExists = (db, productId) =>
  new Promise((resolve, reject) => {
    if (productId == null || Number(productId) <= 0) {
      resolve(false);
      return;
    }
    db.get('SELECT id FROM products WHERE id = ?', [productId], (err, row) => {
      if (err) reject(err);
      else resolve(!!row);
    });
  });

/** Deduct sold qty from stock; floor at 0 (no block on oversell, no negative stock stored) */
export const deductProductStock = async (db, productId, quantity) => {
  const deductQty = parseFloat(quantity) || 0;
  if (deductQty <= 0) return;

  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE products SET current_stock = MAX(0, current_stock - ?) WHERE id = ?`,
      [deductQty, productId],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

export const createSalesOrder = async (db, orderData) => {
  console.log('📥 Creating sales order using OrderService');
      
  // Generate the next order number dynamically to ensure sequence
  const nextOrderNumber = await getNextOrderNumber(db);
  
    const { 
        orderDate, orderTime, customer, storeDetails, 
        items, calculations, payment, status, additionalInfo,
        // New A4 Fields
        delivery_note, supplier_ref, buyer_order_no, dispatch_doc_no, dispatch_through, destination, terms_of_delivery, vehicle_no
      } = orderData;
    
      // Start transaction
      await new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    
      // Helper to sanitize parameters (replace undefined with null)
      const sanitizeParams = (params) => params.map(p => p === undefined ? null : p);
    
      try {
        const customerId = resolveCustomerId(customer);

        // 1. Insert into sales_orders
        const orderId = await new Promise((resolve, reject) => {
          const params = [
            nextOrderNumber, orderDate, orderTime,
            customerId, customer.name, customer.phone, customer.email, customer.address, customer.gstin,
            storeDetails.store, storeDetails.counter, storeDetails.cashier, storeDetails.cashierId,
            status.orderStatus, status.paymentStatus, status.deliveryStatus,
            calculations.subtotal, calculations.billDiscountAmount, calculations.taxDetails.totalTaxAmount, calculations.roundOffAmount, calculations.grandTotal,
            payment.paymentType, payment.paymentMethod, payment.receivedAmount, payment.changeAmount,
            payment.splitPayments?.cash || 0, payment.splitPayments?.card || 0, payment.splitPayments?.upi || 0, payment.splitPayments?.credit || 0, payment.splitPayments?.loyaltyPoints || 0,
            calculations.loyaltyPointsUsed, calculations.loyaltyPointsValue,
            additionalInfo.customerNotes, payment.balanceAmount || 0,
            orderData.priceLevel || 'Retail'
          ];
    
          db.run(
            `INSERT INTO sales_orders (
              order_number, order_date, order_time,
              customer_id, customer_name, customer_phone, customer_email, customer_address, customer_gstin,
              store_name, counter_name, cashier_name, cashier_id,
              status, payment_status, delivery_status,
              subtotal, discount_total, tax_total, round_off, grand_total,
              payment_type, payment_method, received_amount, change_amount,
              split_payment_cash, split_payment_card, split_payment_upi, split_payment_credit, split_payment_loyalty,
              loyalty_points_used, loyalty_points_amount,
              notes, balance_amount, price_category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            sanitizeParams(params),
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });

    // 2. Insert into sales_order_items and collect stock deductions (aggregated per product)
    const stockDeductions = new Map();

    for (const item of items) {
      const hasValidProduct = await productExists(db, item.productId);
      const safeProductId = hasValidProduct ? item.productId : null;
      const deductQty = (parseFloat(item.quantity) || 0) + (parseFloat(item.wastage_qty) || 0);

      await new Promise((resolve, reject) => {
        const itemParams = [
          orderId, safeProductId, item.productName, item.productCode, item.hsnCode, item.category, item.unit,
          item.quantity, item.wastage_qty || 0, item.unitPrice, item.mrp,
          item.itemDiscount, item.itemDiscountAmount,
          item.taxRate, item.sgstAmount, item.cgstAmount, item.igstAmount, item.totalTaxAmount,
          item.grossAmount, item.netAmount, item.finalAmount
        ];

        db.run(
          `INSERT INTO sales_order_items (
            order_id, product_id, product_name, product_code, hsn_code, category, unit,
            quantity, wastage_qty, unit_price, mrp,
            discount_percent, discount_amount,
            tax_rate, sgst_amount, cgst_amount, igst_amount, tax_amount,
            gross_amount, net_amount, final_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          sanitizeParams(itemParams),
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      if (!hasValidProduct) {
        console.warn(`⚠️ Skipping stock update for missing product id: ${item.productId} (${item.productName})`);
        continue;
      }

      const existing = stockDeductions.get(safeProductId) || {
        productId: safeProductId,
        qty: 0,
        productName: item.productName
      };
      existing.qty += deductQty;
      stockDeductions.set(safeProductId, existing);
    }

    for (const { productId, qty, productName } of stockDeductions.values()) {
      await deductProductStock(db, productId, qty);

      await logStockMovement(db, {
        productId,
        referenceType: 'sales_order',
        referenceId: orderId,
        referenceNumber: nextOrderNumber,
        transactionType: 'OUT',
        quantity: qty,
        reason: 'Sales Order Created',
        createdBy: 'System'
      });
    }

    // 3. Insert into sales_order_totals
    await new Promise((resolve, reject) => {
      const totalParams = [
        orderId,
        calculations.itemCount, calculations.totalQuantity,
        calculations.subtotal,
        calculations.totalItemDiscounts, calculations.billDiscount, calculations.billDiscountType, calculations.billDiscountAmount,
        calculations.taxDetails.taxableAmount, calculations.taxDetails.totalSgst, calculations.taxDetails.totalCgst, calculations.taxDetails.totalIgst, calculations.taxDetails.totalTaxAmount,
        calculations.amountBeforeTax, calculations.amountAfterTax,
        calculations.roundOffAmount, calculations.grandTotal
      ];

      db.run(
        `INSERT INTO sales_order_totals (
          order_id,
          item_count, total_quantity,
          subtotal,
          total_item_discount, bill_discount, bill_discount_type, bill_discount_amount,
          taxable_amount, total_sgst, total_cgst, total_igst, total_tax_amount,
          amount_before_tax, amount_after_tax,
          round_off_amount, grand_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sanitizeParams(totalParams),
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // 4. Insert into payment_records and calculate payment status
    const paymentRecords = [];
    
    if (payment.paymentType === 'single') {
      // For single payment, if it's not credit, add a record
      if (payment.paymentMethod !== 'credit') {
        // Calculate actual paid amount (capped at grand total, as excess is change)
        const paidAmount = Math.min(payment.receivedAmount || 0, calculations.grandTotal);
        
        if (paidAmount > 0) {
          paymentRecords.push({
            method: payment.paymentMethod,
            amount: paidAmount
          });
        }
      }
    } else if (payment.paymentType === 'split') {
      // For split payment, add records for each non-zero component
      const { splitPayments } = payment;
      if (splitPayments) {
        if (splitPayments.cash > 0) paymentRecords.push({ method: 'Cash', amount: splitPayments.cash });
        if (splitPayments.card > 0) paymentRecords.push({ method: 'Card', amount: splitPayments.card });
        if (splitPayments.upi > 0) paymentRecords.push({ method: 'UPI', amount: splitPayments.upi });
        if (splitPayments.loyaltyPoints > 0) paymentRecords.push({ method: 'Loyalty Points', amount: splitPayments.loyaltyPoints });
      }
    }

    // Insert payment records
    for (const record of paymentRecords) {
      await new Promise((resolve, reject) => {
        const recordParams = [
          'sales', orderId, orderDate,
          record.amount, record.method, nextOrderNumber,
          additionalInfo.customerNotes || ''
        ];

        db.run(
          `INSERT INTO payment_records (
            record_type, reference_id, payment_date,
            payment_amount, payment_method, reference_number,
            notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          sanitizeParams(recordParams),
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // 5. Calculate payment status from payment records
    const totalPaid = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COALESCE(SUM(payment_amount), 0) as total 
         FROM payment_records 
         WHERE record_type = 'sales' AND reference_id = ?`,
        [orderId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.total);
        }
      );
    });

    const balanceAmount = calculations.grandTotal - totalPaid;
    let paymentStatus;
    
    if (totalPaid === 0) {
      paymentStatus = 'pending';
    } else if (balanceAmount > 0.01) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = 'paid';
    }

    // 6. Update sales_orders with calculated payment status and balance
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE sales_orders 
         SET payment_status = ?, balance_amount = ?, received_amount = ?
         WHERE id = ?`,
        [paymentStatus, balanceAmount, totalPaid, orderId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // 7. LEDGER TRANSACTIONS
    // A. Loyalty Points Used
    if (calculations.loyaltyPointsUsed > 0 && customerId) {
        await addTransaction(db, {
            customerId: customerId,
            type: 'DEBIT',
            category: 'LOYALTY_USED',
            points: calculations.loyaltyPointsUsed,
            amount: 0,
            referenceType: 'sales_order',
            referenceId: orderId,
            referenceNumber: nextOrderNumber,
            description: `Points used in Order #${nextOrderNumber}`
        });
    }

    // B. Credit Sale (Balance Due)
    // IMPORTANT: 'balanceAmount' here is what remains unpaid.
    if (balanceAmount > 0.01 && customerId) {
         await addTransaction(db, {
            customerId: customerId,
            type: 'DEBIT', // Owe more money
            category: 'SALES',
            amount: balanceAmount,
            points: 0,
            referenceType: 'sales_order',
            referenceId: orderId,
            referenceNumber: nextOrderNumber,
            description: `Credit Sale Balance for Order #${nextOrderNumber}`
        });
    }

    // Commit transaction
    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ Sales order created successfully via OrderService:', orderId);
    
    // Return data needed for response
    return {
      success: true,
      orderId,
      orderNumber: nextOrderNumber,
      // We might need to fetch the *very* next number for the UI, or let the UI ask for it.
      // The handler usually returns `nextOrderNumber` (the one just used) AND `newNextNumber`.
      // The service will just return the order details created.
    };

  } catch (error) {
    // Rollback transaction on error
    await new Promise((resolve) => {
      db.run('ROLLBACK', () => resolve());
    });
    throw error;
  }
};
