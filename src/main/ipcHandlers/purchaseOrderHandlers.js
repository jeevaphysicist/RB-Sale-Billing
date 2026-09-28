import { ipcMain } from 'electron';
import { logStockMovement } from './stockMovementHandlers.js';

let globalDb = null;

export function initializePurchaseOrderHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for purchase order handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Purchase Order handlers initialized with database:', !!db);

  // Helper function to get next PO number
  const getNextPONumber = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const prefix = `PO-${currentYear}-`;
      
      // Get the latest PO number for the current year
      const latestPO = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT po_number FROM purchase_orders 
           WHERE po_number LIKE ? 
           ORDER BY id DESC LIMIT 1`,
          [`${prefix}%`],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      let nextNumber = 1;
      if (latestPO && latestPO.po_number) {
        // Extract the sequence number from the latest PO number
        const parts = latestPO.po_number.split('-');
        if (parts.length === 3) {
          const lastSequence = parseInt(parts[2], 10);
          if (!isNaN(lastSequence)) {
            nextNumber = lastSequence + 1;
          }
        }
      }

      const poNumber = `${prefix}${String(nextNumber).padStart(3, '0')}`;
      console.log('📋 Generated next PO number:', poNumber);
      return poNumber;
    } catch (error) {
      console.error('❌ Error generating PO number:', error);
      throw error;
    }
  };

  const handlers = [
    'purchase-order:create',
    'purchase-order:get-all',
    'purchase-order:get-by-id',
    'purchase-order:update',
    'purchase-order:delete',
    'purchase-order:get-next-number'
  ];
  
  console.log('📋 Registered purchase order handlers:', handlers);

  // Get Next PO Number
  ipcMain.handle('purchase-order:get-next-number', async () => {
    try {
      const nextPONumber = await getNextPONumber();
      return {
        success: true,
        data: nextPONumber
      };
    } catch (error) {
      console.error('❌ Get next PO number error:', error);
      return {
        success: false,
        message: 'Failed to generate PO number: ' + error.message
      };
    }
  });

  // Create Purchase Order
  ipcMain.handle('purchase-order:create', async (event, orderData) => {
    try {
      console.log('📥 Creating purchase order with data:', orderData);
      
      const {
        poNumber, poDate, supplierId, supplierName, supplierAddress, supplierGst,
        contactPerson, contactNumber, email, paymentTerms, deliveryDate,
        deliveryLocation, remarks, status, freight, insurance, otherCharges,
        orderDiscount, orderDiscountType, taxSettings, items, totals
      } = orderData;

      // Validate required fields
      if (!poNumber || !poDate || !supplierId) {
        return { success: false, message: 'PO Number, Date, and Supplier are required' };
      }

      if (!items || items.length === 0) {
        return { success: false, message: 'At least one item is required' };
      }

      // Start transaction
      await new Promise((resolve, reject) => {
        globalDb.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      try {
        // Insert purchase order
        const poResult = await new Promise((resolve, reject) => {
          globalDb.run(
            `INSERT INTO purchase_orders (
              po_number, po_date, supplier_id, supplier_name, supplier_address,
              supplier_gst, contact_person, contact_number, email, payment_terms,
              delivery_date, delivery_location, remarks, status, freight, insurance,
              other_charges, order_discount, order_discount_type, enable_tax, tax_type,
              tax_included_in_price, round_off, net_payable
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              poNumber, poDate, supplierId, supplierName, supplierAddress,
              supplierGst, contactPerson, contactNumber, email, paymentTerms,
              deliveryDate, deliveryLocation, remarks, status, freight, insurance,
              otherCharges, orderDiscount, orderDiscountType,
              taxSettings?.enableTax ? 1 : 0, taxSettings?.taxType || 'SGST',
              taxSettings?.taxIncludedInPrice ? 1 : 0,
              totals?.roundOff || 0, totals?.netPayable || 0
            ],
            function(err) {
              if (err) reject(err);
              else resolve({ id: this.lastID });
            }
          );
        });

        const poId = poResult.id;

        // Insert purchase order items
        for (const item of items) {
          if (item.product) { // Only insert items with products
            await new Promise((resolve, reject) => {
              globalDb.run(
                `INSERT INTO purchase_order_items (
                  po_id, product_id, hsn_code, quantity, unit, unit_price,
                  discount, tax, amount
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  poId, item.product, item.hsnCode, item.quantity, item.unit,
                  item.unitPrice, item.discount, item.tax, item.amount
                ],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });

            // Update product stock
            await new Promise((resolve, reject) => {
              globalDb.run(
                `UPDATE products SET current_stock = current_stock + ? WHERE id = ?`,
                [item.quantity, item.product],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });

            // Log stock movement
            await logStockMovement(globalDb, {
              productId: item.product,
              referenceType: 'purchase_order',
              referenceId: poId,
              referenceNumber: poNumber,
              transactionType: 'IN',
              quantity: item.quantity,
              previousStock: null, // We could fetch this if needed, but for now null is fine or we can fetch it
              newStock: null, // Same here
              reason: 'Purchase Order Created',
              createdBy: 'System' // Or get user ID if available
            });
          }
        }

        // Insert purchase order totals
        await new Promise((resolve, reject) => {
          globalDb.run(
            `INSERT INTO purchase_order_totals (
              po_id, subtotal_without_tax, total_tax, sgst, cgst, igst,
              subtotal, order_discount_amount, subtotal_after_discount,
              freight, insurance, other_charges, round_off, net_payable
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              poId, totals.subtotalWithoutTax, totals.totalTax, totals.sgst,
              totals.cgst, totals.igst, totals.subtotal, totals.orderDiscountAmount,
              totals.subtotalAfterDiscount, totals.freight, totals.insurance,
              totals.otherCharges, totals.roundOff, totals.netPayable
            ],
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

        console.log('✅ Purchase order created with ID:', poId);
        return {
          success: true,
          message: 'Purchase order created successfully',
          poId: poId
        };

      } catch (error) {
        // Rollback on error
        await new Promise((resolve) => {
          globalDb.run('ROLLBACK', () => resolve());
        });
        throw error;
      }

    } catch (error) {
      console.error('❌ Create purchase order error:', error);
      return { success: false, message: 'Failed to create purchase order: ' + error.message };
    }
  });

  // Get All Purchase Orders
  ipcMain.handle('purchase-order:get-all', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting purchase orders with filter params:', filterParams);
      const {
        searchTerm,
        status,
        supplierId,
        startDate,
        endDate,
        sortKey = 'po_date',
        sortDirection = 'DESC',
        page = 1,
        limit = 10
      } = filterParams;

      const offset = (page - 1) * limit;
      
      const validSortKeys = ['id', 'po_number', 'po_date', 'supplier_name', 'status', 'net_payable', 'created_at'];
      const safeSortKey = validSortKeys.includes(sortKey) ? sortKey : 'po_date';
      const safeSortDirection = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      
      let query = `SELECT * FROM purchase_orders`;
      let countQuery = `SELECT COUNT(*) as total FROM purchase_orders`;
      const params = [];
      const countParams = [];
      const conditions = [];
      
      // Add filters
      if (searchTerm) {
        conditions.push(`(po_number LIKE ? OR supplier_name LIKE ? OR contact_person LIKE ?)`);
        const searchParam = `%${searchTerm}%`;
        params.push(searchParam, searchParam, searchParam);
        countParams.push(searchParam, searchParam, searchParam);
      }
      
      if (status) {
        conditions.push(`status = ?`);
        params.push(status);
        countParams.push(status);
      }
      
      if (supplierId) {
        conditions.push(`supplier_id = ?`);
        params.push(supplierId);
        countParams.push(supplierId);
      }
      
      if (startDate) {
        conditions.push(`po_date >= ?`);
        params.push(startDate);
        countParams.push(startDate);
      }
      
      if (endDate) {
        conditions.push(`po_date <= ?`);
        params.push(endDate);
        countParams.push(endDate);
      }
      
      if (conditions.length > 0) {
        const whereClause = ` WHERE ` + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }
      
      // Add sorting
      query += ` ORDER BY ${safeSortKey} ${safeSortDirection}`;
      
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
      console.error('❌ Get purchase orders error:', error);
      return { success: false, message: 'Failed to fetch purchase orders', error: error.message };
    }
  });

  // Get Purchase Order By ID
  ipcMain.handle('purchase-order:get-by-id', async (event, poId) => {
    try {
      console.log('📥 Getting purchase order by ID:', poId);
      
      if (!poId) {
        return { success: false, message: 'Purchase Order ID is required' };
      }

      // Get purchase order
      const order = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT * FROM purchase_orders WHERE id = ?`,
          [poId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!order) {
        return { success: false, message: 'Purchase order not found' };
      }

      // Get items
      const items = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT * FROM purchase_order_items WHERE po_id = ?`,
          [poId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      // Get totals
      const totals = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT * FROM purchase_order_totals WHERE po_id = ?`,
          [poId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      return {
        success: true,
        data: {
          ...order,
          items,
          totals
        }
      };
    } catch (error) {
      console.error('❌ Get purchase order error:', error);
      return { success: false, message: 'Failed to fetch purchase order' };
    }
  });

  // Update Purchase Order
  ipcMain.handle('purchase-order:update', async (event, orderData) => {
    try {
      console.log('📥 Updating purchase order:', orderData);
      
      const {
        id, poNumber, poDate, supplierId, supplierName, supplierAddress, supplierGst,
        contactPerson, contactNumber, email, paymentTerms, deliveryDate,
        deliveryLocation, remarks, status, freight, insurance, otherCharges,
        orderDiscount, orderDiscountType, taxSettings, items, totals
      } = orderData;

      if (!id) {
        return { success: false, message: 'Purchase Order ID is required' };
      }

      // Start transaction
      await new Promise((resolve, reject) => {
        globalDb.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      try {
        // Update purchase order
        await new Promise((resolve, reject) => {
          globalDb.run(
            `UPDATE purchase_orders SET
              po_number = ?, po_date = ?, supplier_id = ?, supplier_name = ?,
              supplier_address = ?, supplier_gst = ?, contact_person = ?,
              contact_number = ?, email = ?, payment_terms = ?, delivery_date = ?,
              delivery_location = ?, remarks = ?, status = ?, freight = ?,
              insurance = ?, other_charges = ?, order_discount = ?,
              order_discount_type = ?, enable_tax = ?, tax_type = ?,
              tax_included_in_price = ?, round_off = ?, net_payable = ?,
              updated_at = datetime('now', '+5 hours', '30 minutes')
            WHERE id = ?`,
            [
              poNumber, poDate, supplierId, supplierName, supplierAddress,
              supplierGst, contactPerson, contactNumber, email, paymentTerms,
              deliveryDate, deliveryLocation, remarks, status, freight, insurance,
              otherCharges, orderDiscount, orderDiscountType,
              taxSettings?.enableTax ? 1 : 0, taxSettings?.taxType || 'SGST',
              taxSettings?.taxIncludedInPrice ? 1 : 0,
              totals?.roundOff || 0, totals?.netPayable || 0, id
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // 1. Get old items to reverse stock
        const oldItems = await new Promise((resolve, reject) => {
          globalDb.all(
            `SELECT product_id, quantity FROM purchase_order_items WHERE po_id = ?`,
            [id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        // 2. Reverse stock (Decrease) for old items
        for (const oldItem of oldItems) {
          if (oldItem.product_id) {
            await new Promise((resolve, reject) => {
              globalDb.run(
                `UPDATE products SET current_stock = current_stock - ? WHERE id = ?`,
                [oldItem.quantity, oldItem.product_id],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });

            // Log stock movement (Reversal)
            await logStockMovement(globalDb, {
              productId: oldItem.product_id,
              referenceType: 'purchase_order',
              referenceId: id,
              referenceNumber: poNumber,
              transactionType: 'OUT',
              quantity: oldItem.quantity,
              reason: 'Purchase Order Edit (Reversal)',
              createdBy: 'System'
            });
          }
        }

        // 3. Delete existing items
        await new Promise((resolve, reject) => {
          globalDb.run(
            `DELETE FROM purchase_order_items WHERE po_id = ?`,
            [id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // 4. Insert updated items and apply new stock
        for (const item of items) {
          if (item.product) {
            await new Promise((resolve, reject) => {
              globalDb.run(
                `INSERT INTO purchase_order_items (
                  po_id, product_id, hsn_code, quantity, unit, unit_price,
                  discount, tax, amount
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  id, item.product, item.hsnCode, item.quantity, item.unit,
                  item.unitPrice, item.discount, item.tax, item.amount
                ],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });

            // Increase stock
            await new Promise((resolve, reject) => {
              globalDb.run(
                `UPDATE products SET current_stock = current_stock + ? WHERE id = ?`,
                [item.quantity, item.product],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });

            // Log stock movement (New application)
            await logStockMovement(globalDb, {
              productId: item.product,
              referenceType: 'purchase_order',
              referenceId: id,
              referenceNumber: poNumber,
              transactionType: 'IN',
              quantity: item.quantity,
              reason: 'Purchase Order Edit (Updated)',
              createdBy: 'System'
            });
          }
        }

        // Update totals
        await new Promise((resolve, reject) => {
          globalDb.run(
            `UPDATE purchase_order_totals SET
              subtotal_without_tax = ?, total_tax = ?, sgst = ?, cgst = ?,
              igst = ?, subtotal = ?, order_discount_amount = ?,
              subtotal_after_discount = ?, freight = ?, insurance = ?,
              other_charges = ?, round_off = ?, net_payable = ?
            WHERE po_id = ?`,
            [
              totals.subtotalWithoutTax, totals.totalTax, totals.sgst,
              totals.cgst, totals.igst, totals.subtotal, totals.orderDiscountAmount,
              totals.subtotalAfterDiscount, totals.freight, totals.insurance,
              totals.otherCharges, totals.roundOff, totals.netPayable, id
            ],
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

        console.log('✅ Purchase order updated:', id);
        return { success: true, message: 'Purchase order updated successfully' };

      } catch (error) {
        await new Promise((resolve) => {
          globalDb.run('ROLLBACK', () => resolve());
        });
        throw error;
      }

    } catch (error) {
      console.error('❌ Update purchase order error:', error);
      return { success: false, message: 'Failed to update purchase order: ' + error.message };
    }
  });

  // Delete Purchase Order
  ipcMain.handle('purchase-order:delete', async (event, poId) => {
    try {
      console.log('📥 Deleting purchase order:', poId);
      
      if (!poId) {
        return { success: false, message: 'Purchase Order ID is required' };
      }

      // Start transaction
      await new Promise((resolve, reject) => {
        globalDb.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      try {
        // Get PO details for logging
        const po = await new Promise((resolve, reject) => {
          globalDb.get(
            `SELECT po_number FROM purchase_orders WHERE id = ?`,
            [poId],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (!po) {
          await new Promise((resolve) => globalDb.run('ROLLBACK', () => resolve()));
          return { success: false, message: 'Purchase order not found' };
        }

        // Get items to reverse stock
        const items = await new Promise((resolve, reject) => {
          globalDb.all(
            `SELECT product_id, quantity FROM purchase_order_items WHERE po_id = ?`,
            [poId],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        // Reverse stock (Decrease)
        for (const item of items) {
          if (item.product_id) {
            // Decrease stock
            await new Promise((resolve, reject) => {
              globalDb.run(
                `UPDATE products SET current_stock = current_stock - ? WHERE id = ?`,
                [item.quantity, item.product_id],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });

            // Log stock movement
            await logStockMovement(globalDb, {
              productId: item.product_id,
              referenceType: 'purchase_order',
              referenceId: poId,
              referenceNumber: po.po_number,
              transactionType: 'OUT',
              quantity: item.quantity,
              reason: 'Purchase Order Deleted',
              createdBy: 'System'
            });
          }
        }

        // Delete from purchase_orders (Cascade delete handles items and totals)
        // But we explicitly delete to be safe and consistent with other handlers if needed
        // Assuming ON DELETE CASCADE is set up in schema, but let's be explicit if not sure
        // The schema has ON DELETE CASCADE for items and totals, so deleting PO is enough.
        
        await new Promise((resolve, reject) => {
          globalDb.run(
            `DELETE FROM purchase_orders WHERE id = ?`,
            [poId],
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

        console.log(`✅ Purchase order ${poId} deleted successfully with stock adjustment`);
        return { success: true, message: 'Purchase order deleted successfully' };

      } catch (error) {
        // Rollback on error
        await new Promise((resolve) => {
          globalDb.run('ROLLBACK', () => resolve());
        });
        throw error;
      }

    } catch (error) {
      console.error('❌ Delete purchase order error:', error);
      return {
        success: false,
        message: 'Failed to delete purchase order: ' + error.message
      };
    }
  });

  console.log('✅ Purchase Order IPC handlers registered');
}
