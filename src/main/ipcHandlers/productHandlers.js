import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import { format } from 'date-fns';
import { logStockMovement } from './stockMovementHandlers.js';
import { generateProductPriceSheetPDF } from '../utils/pdfGenerator.js';

let globalDb = null;

export function initializeProductHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for product handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Product handlers initialized with database:', !!db);

  const handlers = [
    'product:create',
    'product:get-all',
    'product:get-by-id',
    'product:update',
    'product:delete',
    'product:import',
    'product:export-price-sheet-pdf'
  ];
  
  console.log('📋 Registered product handlers:', handlers);

  // Helper function to generate next product code
  async function generateNextProductCode() {
    return new Promise((resolve, reject) => {
      globalDb.get(
        `SELECT product_code FROM products 
         WHERE product_code LIKE 'PROD%' 
         ORDER BY CAST(SUBSTR(product_code, 5) AS INTEGER) DESC 
         LIMIT 1`,
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row && row.product_code) {
            const match = row.product_code.match(/PROD(\d+)/);
            if (match) {
              const nextNumber = parseInt(match[1]) + 1;
              resolve(`PROD${String(nextNumber).padStart(3, '0')}`);
            } else {
              resolve('PROD001');
            }
          } else {
            resolve('PROD001');
          }
        }
      );
    });
  }

  // Create Product
  ipcMain.handle('product:create', async (event, productData) => {
    try {
      console.log('📥 Creating product with data:', productData);
      
      const {
        product_name,
        product_code,
        hsn_code,
        barcode,
        category_id,
        brand_id,
        unit,
        purchase_price,
        selling_price,
        mrp,
        wholesale_price,
        dealer_price,
        discount,
        tax_rate,
        current_stock,
        minimum_stock,
        opening_stock,
        reorder_level,
        supplier_ids,
        product_image,
        description,
        tags,
        status,
        product_type,
        warranty_period,
        expiry_date,
        batch_no,
        serial_no,
        notes,
        default_wastage
      } = productData;

      // Validation
      if (!product_name) {
        return { success: false, message: 'Product name is required' };
      }

      // Auto-generate product code if not provided
      let finalProductCode = product_code;
      if (!finalProductCode || finalProductCode.trim() === '') {
        finalProductCode = await generateNextProductCode();
        console.log('🔢 Auto-generated product code:', finalProductCode);
      }

      // Convert supplier_ids array to JSON string for storage
      const supplierIdsString = Array.isArray(supplier_ids) 
        ? JSON.stringify(supplier_ids) 
        : supplier_ids;

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `INSERT INTO products (
            product_name, product_code, hsn_code, barcode, category_id, brand_id, unit,
            purchase_price, selling_price, mrp, wholesale_price, dealer_price, discount, tax_rate,
            current_stock, minimum_stock, opening_stock, reorder_level,
            supplier_ids, description, tags, status, product_type,
            warranty_period, expiry_date, batch_no, serial_no, notes, default_wastage
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product_name, finalProductCode || '', hsn_code || '', barcode || '', category_id, brand_id, unit || 'Piece',
            purchase_price || 0, selling_price || 0, mrp || 0, wholesale_price || 0, dealer_price || 0, discount || 0, tax_rate || 0,
            current_stock || 0, minimum_stock || 0, opening_stock || 0, reorder_level || 0,
            supplierIdsString, description || '', tags || '', status || 'Active', product_type || 'Physical',
            warranty_period || '', expiry_date || '', batch_no || '', serial_no || '', notes || '',
            default_wastage || 0
          ],
          function(err) {
            if (err) {
              console.error('❌ Create product error:', err.message);
              reject(err);
            } else {
              console.log('✅ Product created with ID:', this.lastID);
              resolve({ id: this.lastID });
            }
          }
        );
      });

      return { 
        success: true, 
        message: 'Product created successfully',
        productId: result.id 
      };
    } catch (error) {
      console.error('❌ Create product error:', error);
      return { 
        success: false, 
        message: error.message.includes('UNIQUE') 
          ? 'Product code already exists' 
          : 'Failed to create product' 
      };
    }
  });

  // Get All Products with filters
  ipcMain.handle('product:get-all', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting products with filter params:', filterParams);
      const { searchTerm, sortKey = 'id', sortDirection = 'DESC', page = 1, limit = 10, status } = filterParams;
      const offset = (page - 1) * limit;
      
      const validSortKeys = ['id', 'product_name', 'product_code', 'selling_price', 'current_stock', 'status', 'created_at'];
      const safeSortKey = validSortKeys.includes(sortKey) ? sortKey : 'id';
      const safeSortDirection = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      
      let query = `
        SELECT 
          p.*,
          c.name as category_name,
          b.name as brand_name,
          pi.image_path as product_image
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = 1
      `;
      let countQuery = `SELECT COUNT(*) as total FROM products p`;
      const params = [];
      const countParams = [];
      
      // Build WHERE conditions
      const conditions = [];
      
      // Add search filter
      if (searchTerm) {
        conditions.push(`(
          p.product_name LIKE ? OR 
          p.product_code LIKE ? OR 
          p.barcode LIKE ? OR 
          p.hsn_code LIKE ? OR
          p.tags LIKE ?
        )`);
        const searchParam = `%${searchTerm}%`;
        params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
        countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
      }
      
      // Add status filter (case-insensitive)
      if (status) {
        conditions.push(`LOWER(p.status) = LOWER(?)`);
        params.push(status);
        countParams.push(status);
      }
      
      // Apply WHERE clause if there are conditions
      if (conditions.length > 0) {
        const whereClause = ` WHERE ${conditions.join(' AND ')}`;
        query += whereClause;
        countQuery += whereClause;
      }
      
      // Add sorting
      query += ` ORDER BY p.${safeSortKey} ${safeSortDirection}`;
      
      // Add pagination
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      // Get total count
      const countResult = await new Promise((resolve, reject) => {
        globalDb.get(countQuery, countParams, (err, row) => {
          if (err) {
            console.error('Error getting total count:', err);
            reject(err);
          } else {
            resolve(row.total);
          }
        });
      });

      // Get paginated results
      const products = await new Promise((resolve, reject) => {
        globalDb.all(query, params, (err, rows) => {
          if (err) {
            console.error('Error fetching products:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });

      return {
        success: true,
        data: products,
        total: countResult,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      };
    } catch (error) {
      console.error('❌ Get products error:', error);
      return { success: false, message: 'Failed to fetch products', error: error.message };
    }
  });

  // Get Product by ID
  ipcMain.handle('product:get-by-id', async (event, productId) => {
    try {
      if (!productId) {
        return { success: false, message: 'Product ID is required' };
      }

      const product = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT 
            p.*,
            c.name as category_name,
            b.name as brand_name,
            pi.image_path as product_image
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          LEFT JOIN brands b ON p.brand_id = b.id
          LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = 1
          WHERE p.id = ?`,
          [productId],
          (err, row) => {
            if (err) {
              console.error('❌ Get product error:', err.message);
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (!product) {
        return { success: false, message: 'Product not found' };
      }

      return { success: true, data: product };
    } catch (error) {
      console.error('❌ Get product error:', error);
      return { success: false, message: 'Failed to fetch product' };
    }
  });

  // Update Product
  ipcMain.handle('product:update', async (event, productData) => {
    try {
      const {
        id,
        product_name,
        product_code,
        hsn_code,
        barcode,
        category_id,
        brand_id,
        unit,
        purchase_price,
        selling_price,
        mrp,
        wholesale_price,
        dealer_price,
        discount,
        tax_rate,
        current_stock,
        minimum_stock,
        opening_stock,
        reorder_level,
        supplier_ids,
        product_image,
        description,
        tags,
        status,
        product_type,
        warranty_period,
        expiry_date,
        batch_no,
        serial_no,
        notes,
        default_wastage
      } = productData;

      if (!id) {
        return { success: false, message: 'Product ID is required' };
      }

      if (!product_name) {
        return { success: false, message: 'Product name is required' };
      }

      // Convert supplier_ids array to JSON string for storage
      const supplierIdsString = Array.isArray(supplier_ids) 
        ? JSON.stringify(supplier_ids) 
        : supplier_ids;

      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE products SET 
            product_name = ?, product_code = ?, hsn_code = ?, barcode = ?, 
            category_id = ?, brand_id = ?, unit = ?,
            purchase_price = ?, selling_price = ?, mrp = ?, wholesale_price = ?, dealer_price = ?, discount = ?, tax_rate = ?,
            current_stock = ?, minimum_stock = ?, opening_stock = ?, reorder_level = ?,
            supplier_ids = ?, description = ?, tags = ?, 
            status = ?, product_type = ?, warranty_period = ?, expiry_date = ?, 
            batch_no = ?, serial_no = ?, notes = ?, default_wastage = ?,
            updated_at = datetime('now', '+5 hours', '30 minutes')
          WHERE id = ?`,
          [
            product_name, product_code, hsn_code, barcode,
            category_id, brand_id, unit,
            purchase_price, selling_price, mrp, wholesale_price, dealer_price, discount, tax_rate,
            current_stock, minimum_stock, opening_stock, reorder_level,
            supplierIdsString, description, tags,
            status, product_type, warranty_period, expiry_date,
            batch_no, serial_no, notes || '', default_wastage || 0,
            id
          ],
          (err) => {
            if (err) {
              console.error('❌ Update product error:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      return { success: true, message: 'Product updated successfully' };
    } catch (error) {
      console.error('❌ Update product error:', error);
      return { 
        success: false, 
        message: error.message.includes('UNIQUE') 
          ? 'Product code already exists' 
          : 'Failed to update product' 
      };
    }
  });

  // Delete Product
  ipcMain.handle('product:delete', async (event, productId) => {
    try {
      if (!productId) {
        return { success: false, message: 'Product ID is required' };
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `DELETE FROM products WHERE id = ?`,
          [productId],
          function(err) {
            if (err) {
              console.error('❌ Delete product error:', err.message);
              reject(err);
            } else {
              if (this.changes === 0) {
                resolve({ success: false, message: 'Product not found' });
              } else {
                console.log(`✅ Product ${productId} deleted successfully`);
                resolve({ success: true, message: 'Product deleted successfully' });
              }
            }
          }
        );
      });

      return result;
    } catch (error) {
      console.error('❌ Delete product error:', error);
      return { 
        success: false, 
        message: error.message.includes('FOREIGN KEY') 
          ? 'Cannot delete product as it is being used in transactions' 
          : 'Failed to delete product' 
      };
    }
  });

  // Adjust Stock
  ipcMain.handle('product:adjust-stock', async (event, adjustmentData) => {
    try {
      const { productId, adjustmentType, quantity, reason, remarks } = adjustmentData;

      if (!productId || !adjustmentType || !quantity) {
        return { success: false, message: 'Missing required fields' };
      }

      // Start transaction
      await new Promise((resolve, reject) => {
        globalDb.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      try {
        // Get current stock
        const product = await new Promise((resolve, reject) => {
          globalDb.get(
            `SELECT current_stock, product_name FROM products WHERE id = ?`,
            [productId],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (!product) {
          await new Promise((resolve) => globalDb.run('ROLLBACK', () => resolve()));
          return { success: false, message: 'Product not found' };
        }

        const currentStock = product.current_stock || 0;
        let newStock = currentStock;
        let transactionType = '';

        if (adjustmentType === 'add') {
          newStock += parseFloat(quantity);
          transactionType = 'IN';
        } else if (adjustmentType === 'subtract') {
          newStock -= parseFloat(quantity);
          transactionType = 'OUT';
        } else if (adjustmentType === 'set') {
          newStock = parseFloat(quantity);
          transactionType = newStock > currentStock ? 'IN' : 'OUT';
        }

        // Update product stock
        await new Promise((resolve, reject) => {
          globalDb.run(
            `UPDATE products SET current_stock = ?, updated_at = datetime('now', '+5 hours', '30 minutes') WHERE id = ?`,
            [newStock, productId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // Log stock movement
        await logStockMovement(globalDb, {
          productId: productId,
          referenceType: 'adjustment',
          referenceId: null, // No specific order ID for manual adjustment
          referenceNumber: 'MANUAL',
          transactionType: transactionType,
          quantity: Math.abs(newStock - currentStock),
          previousStock: currentStock,
          newStock: newStock,
          reason: reason || remarks || 'Manual Adjustment',
          createdBy: 'User' // Or get user ID
        });

        // Commit transaction
        await new Promise((resolve, reject) => {
          globalDb.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        return { success: true, message: 'Stock adjusted successfully', newStock };

      } catch (error) {
        await new Promise((resolve) => {
          globalDb.run('ROLLBACK', () => resolve());
        });
        throw error;
      }

    } catch (error) {
      console.error('❌ Adjust stock error:', error);
      return { success: false, message: 'Failed to adjust stock: ' + error.message };
    }
  });

  // Import Products (Bulk)
  ipcMain.handle('product:import', async (event, products) => {
    try {
      console.log(`📥 Importing ${products.length} products...`);
      
      if (!Array.isArray(products) || products.length === 0) {
        return { success: false, message: 'No products to import' };
      }

      let successCount = 0;
      let errors = [];

      // Process each product individually
      for (const [index, product] of products.entries()) {
        const {
          product_name,
          product_code,
          hsn_code,
          barcode,
          category_id,
          brand_id,
          unit,
          purchase_price,
          selling_price,

          mrp,
          wholesale_price,
          dealer_price,
          discount,
          tax_rate,
          current_stock,
          minimum_stock,
          opening_stock,
          reorder_level,
          description,
          status,
          default_wastage
        } = product;

        // Basic validation
        if (!product_name) {
          errors.push({ row: index + 1, message: 'Product name is required', product: 'Unknown' });
          continue;
        }

        // Auto-generate product code if not provided
        let finalProductCode = product_code;
        if (!finalProductCode || finalProductCode.trim() === '') {
          finalProductCode = await generateNextProductCode();
          console.log('🔢 Auto-generated product code for import:', finalProductCode);
        }

        try {
          await new Promise((resolve, reject) => {
            globalDb.run(
              `INSERT INTO products (
                product_name, product_code, hsn_code, barcode, category_id, brand_id, unit,
                purchase_price, selling_price, mrp, wholesale_price, dealer_price, discount, tax_rate,
                current_stock, minimum_stock, opening_stock, reorder_level,
                description, status, product_type, default_wastage
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                product_name, 
                finalProductCode || '', 
                hsn_code || '', 
                barcode || '', 
                category_id || null, 
                brand_id || null, 
                unit || 'Piece',
                purchase_price || 0, 
                selling_price || 0, 
                mrp || 0, 
                wholesale_price || 0,
                dealer_price || 0,
                discount || 0, 
                tax_rate || 0,
                current_stock || 0, 
                minimum_stock || 0, 
                opening_stock || 0, 
                reorder_level || 0,
                description || '', 
                status || 'Active', 
                'Physical',
                default_wastage || 0
              ],
              function(err) {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          });
          successCount++;
        } catch (err) {
          let errorMessage = err.message;
          if (errorMessage.includes('UNIQUE constraint failed: products.product_code')) {
            errorMessage = `Product code "${product_code}" already exists`;
          } else if (errorMessage.includes('UNIQUE constraint failed: products.barcode')) {
            errorMessage = `Barcode "${barcode}" already exists`;
          }
          
          errors.push({ 
            row: index + 1, 
            message: errorMessage,
            product: product_name
          });
        }
      }

      return { 
        success: true, 
        message: `Import completed: ${successCount} imported, ${errors.length} failed`,
        importedCount: successCount,
        failedCount: errors.length,
        totalCount: products.length,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('❌ Import products error:', error);
      return { success: false, message: 'Failed to import products: ' + error.message };
    }
  });

  ipcMain.handle('product:export-price-sheet-pdf', async (event, payload = {}) => {
    try {
      const { rows = [], title = 'Product Price List', generatedAt = '' } = payload;

      if (!rows.length) {
        return { success: false, message: 'No products to export' };
      }

      const store = await new Promise((resolve, reject) => {
        globalDb.get(`SELECT * FROM store_settings LIMIT 1`, (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        });
      });

      const columnKeys = Object.keys(rows[0]);
      const pdfBuffer = await generateProductPriceSheetPDF({
        rows,
        store,
        title,
        generatedAt,
        columnKeys
      });

      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      const dateStamp = format(new Date(), 'dd-MM-yyyy');
      const saveResult = await dialog.showSaveDialog(parentWindow, {
        title: 'Save Product Price Sheet',
        defaultPath: `Product_Price_Sheet_${dateStamp}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, canceled: true };
      }

      await fs.promises.writeFile(saveResult.filePath, pdfBuffer);
      console.log('✅ Product price sheet PDF saved:', saveResult.filePath);

      return { success: true, filePath: saveResult.filePath };
    } catch (error) {
      console.error('❌ Product price sheet PDF export error:', error);
      return { success: false, message: 'Failed to export PDF: ' + error.message };
    }
  });

  console.log('✅ Product IPC handlers registered');
}
