import { ipcMain } from 'electron';

let globalDb = null;

export function initializeSupplierHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for supplier handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Supplier handlers initialized with database:', !!db);

  // Log all registered handlers
  const handlers = [
    'supplier:create',
    'supplier:get-all',
    'supplier:get-by-id',
    'supplier:update',
    'supplier:delete',
    'supplier:import'
  ];
  
  console.log('📋 Registered supplier handlers:', handlers);

  // Helper function to generate next supplier code
  async function generateNextSupplierCode() {
    return new Promise((resolve, reject) => {
      globalDb.get(
        `SELECT supplier_code FROM suppliers 
         WHERE supplier_code LIKE 'SUP%' 
         ORDER BY CAST(SUBSTR(supplier_code, 4) AS INTEGER) DESC 
         LIMIT 1`,
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row && row.supplier_code) {
            const match = row.supplier_code.match(/SUP(\d+)/);
            if (match) {
              const nextNumber = parseInt(match[1]) + 1;
              resolve(`SUP${String(nextNumber).padStart(3, '0')}`);
            } else {
              resolve('SUP001');
            }
          } else {
            resolve('SUP001');
          }
        }
      );
    });
  }

  // Create Supplier
  ipcMain.handle('supplier:create', async (event, supplierData) => {
    try {
      console.log('📥 Creating supplier with data:', supplierData);
      
      const {
        supplier_name,
        supplier_code,
        contact_person,
        email,
        phone,
        alternate_phone,
        supplier_type,
        gstin,
        pan,
        business_type,
        hsn_sac_applicable,
        address_line_1,
        address_line_2,
        city,
        state,
        pincode,
        country,
        bank_name,
        account_number,
        ifsc_code,
        upi_id,
        payment_terms,
        opening_balance,
        payment_mode,
        status,
        notes
      } = supplierData;

      // Validation
      if (!supplier_name) {
        return { success: false, message: 'Supplier name is required' };
      }

      // Auto-generate supplier code if not provided
      let finalSupplierCode = supplier_code;
      if (!finalSupplierCode || finalSupplierCode.trim() === '') {
        finalSupplierCode = await generateNextSupplierCode();
        console.log('🔢 Auto-generated supplier code:', finalSupplierCode);
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `INSERT INTO suppliers (
            supplier_name, supplier_code, contact_person, email, phone, alternate_phone,
            supplier_type, gstin, pan, business_type, hsn_sac_applicable,
            address_line_1, address_line_2, city, state, pincode, country,
            bank_name, account_number, ifsc_code, upi_id,
            payment_terms, opening_balance, payment_mode, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            supplier_name, finalSupplierCode || '', contact_person || '', email || '', phone || '', alternate_phone || '',
            supplier_type || 'Vendor', gstin || '', pan || '', business_type || '', hsn_sac_applicable ? 1 : 0,
            address_line_1 || '', address_line_2 || '', city || '', state || '', pincode || '', country || 'India',
            bank_name || '', account_number || '', ifsc_code || '', upi_id || '',
            payment_terms || 'Immediate', opening_balance || 0, payment_mode || 'Cash', status || 'Active', notes || ''
          ],
          function(err) {
            if (err) {
              console.error('❌ Create supplier error:', err.message);
              if (err.message.includes('UNIQUE constraint failed: suppliers.supplier_code')) {
                reject(new Error('Supplier code already exists'));
              } else if (err.message.includes('UNIQUE constraint failed: suppliers.phone')) {
                reject(new Error(`Phone number "${phone}" is already registered with another supplier`));
              } else if (err.message.includes('UNIQUE constraint')) {
                reject(new Error('A supplier with this information already exists'));
              } else {
                reject(err);
              }
            } else {
              console.log('✅ Supplier created with ID:', this.lastID);
              resolve({ id: this.lastID });
            }
          }
        );
      });

      return { 
        success: true, 
        message: 'Supplier created successfully',
        supplierId: result.id 
      };
    } catch (error) {
      console.error('❌ Create supplier error:', error);
      return { success: false, message: error.message || 'Failed to create supplier' };
    }
  });

  // Get All Suppliers with Filters
  ipcMain.handle('supplier:get-all', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting suppliers with filter params:', filterParams);
      const { searchTerm, sortKey = 'id', sortDirection = 'DESC', page = 1, limit = 10 } = filterParams;
      const offset = (page - 1) * limit;
      
      // Validate sortKey to prevent SQL injection
      const validSortKeys = ['id', 'supplier_name', 'supplier_code', 'contact_person', 'phone', 'email', 'city', 'state', 'status', 'created_at'];
      const safeSortKey = validSortKeys.includes(sortKey) ? sortKey : 'id';
      const safeSortDirection = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      
      let query = `SELECT * FROM suppliers`;
      let countQuery = `SELECT COUNT(*) as total FROM suppliers`;
      const params = [];
      const countParams = [];
      
      // Add search filter
      if (searchTerm) {
        const searchCondition = ` WHERE supplier_name LIKE ? OR supplier_code LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ? OR city LIKE ?`;
        query += searchCondition;
        countQuery += searchCondition;
        const searchParam = `%${searchTerm}%`;
        params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
        countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
      }
      
      // Add sorting
      query += ` ORDER BY ${safeSortKey} ${safeSortDirection}`;
      
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
      const suppliers = await new Promise((resolve, reject) => {
        globalDb.all(query, params, (err, rows) => {
          if (err) {
            console.error('Error fetching suppliers:', err);
            reject(err);
          } else {
            // Convert boolean fields
            const processedRows = rows.map(row => ({
              ...row,
              hsn_sac_applicable: row.hsn_sac_applicable === 1
            }));
            resolve(processedRows || []);
          }
        });
      });

      return {
        success: true,
        data: suppliers,
        total: countResult,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      };
    } catch (error) {
      console.error('❌ Get suppliers error:', error);
      return { success: false, message: 'Failed to fetch suppliers', error: error.message };
    }
  });

  // Get Supplier by ID
  ipcMain.handle('supplier:get-by-id', async (event, supplierId) => {
    try {
      if (!supplierId) {
        return { success: false, message: 'Supplier ID is required' };
      }

      const supplier = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT * FROM suppliers WHERE id = ?`,
          [supplierId],
          (err, row) => {
            if (err) {
              console.error('❌ Get supplier error:', err.message);
              reject(err);
            } else {
              if (row) {
                // Convert boolean fields
                row.hsn_sac_applicable = row.hsn_sac_applicable === 1;
              }
              resolve(row);
            }
          }
        );
      });

      if (!supplier) {
        return { success: false, message: 'Supplier not found' };
      }

      return { success: true, supplier };
    } catch (error) {
      console.error('❌ Get supplier error:', error);
      return { success: false, message: 'Failed to fetch supplier' };
    }
  });

  // Update Supplier
  ipcMain.handle('supplier:update', async (event, supplierData) => {
    try {
      const {
        id,
        supplier_name,
        supplier_code,
        contact_person,
        email,
        phone,
        alternate_phone,
        supplier_type,
        gstin,
        pan,
        business_type,
        hsn_sac_applicable,
        address_line_1,
        address_line_2,
        city,
        state,
        pincode,
        country,
        bank_name,
        account_number,
        ifsc_code,
        upi_id,
        payment_terms,
        opening_balance,
        payment_mode,
        status,
        notes
      } = supplierData;

      if (!id) {
        return { success: false, message: 'Supplier ID is required' };
      }

      if (!supplier_name) {
        return { success: false, message: 'Supplier name is required' };
      }

      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE suppliers SET 
            supplier_name = ?, supplier_code = ?, contact_person = ?, email = ?, 
            phone = ?, alternate_phone = ?, supplier_type = ?, gstin = ?, pan = ?, 
            business_type = ?, hsn_sac_applicable = ?, address_line_1 = ?, address_line_2 = ?, 
            city = ?, state = ?, pincode = ?, country = ?, bank_name = ?, account_number = ?, 
            ifsc_code = ?, upi_id = ?, payment_terms = ?, opening_balance = ?, payment_mode = ?, 
            status = ?, notes = ?, updated_at = datetime('now', '+5 hours', '30 minutes')
          WHERE id = ?`,
          [
            supplier_name, supplier_code, contact_person, email, phone, alternate_phone,
            supplier_type, gstin, pan, business_type, hsn_sac_applicable ? 1 : 0,
            address_line_1, address_line_2, city, state, pincode, country,
            bank_name, account_number, ifsc_code, upi_id,
            payment_terms, opening_balance || 0, payment_mode, status, notes,
            id
          ],
          (err) => {
            if (err) {
              console.error('❌ Update supplier error:', err.message);
              reject(err);
            } else {
              console.log(`✅ Supplier ${id} updated successfully`);
              resolve();
            }
          }
        );
      });

      return { success: true, message: 'Supplier updated successfully' };
    } catch (error) {
      console.error('❌ Update supplier error:', error);
      return { success: false, message: 'Failed to update supplier' };
    }
  });

  // Delete Supplier
  ipcMain.handle('supplier:delete', async (event, supplierId) => {
    try {
      if (!supplierId) {
        return { success: false, message: 'Supplier ID is required' };
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `DELETE FROM suppliers WHERE id = ?`,
          [supplierId],
          function(err) {
            if (err) {
              console.error('❌ Delete supplier error:', err.message);
              reject(err);
            } else {
              if (this.changes === 0) {
                resolve({ success: false, message: 'Supplier not found' });
              } else {
                console.log(`✅ Supplier ${supplierId} deleted successfully`);
                resolve({ success: true, message: 'Supplier deleted successfully' });
              }
            }
          }
        );
      });

      return result;
    } catch (error) {
      console.error('❌ Delete supplier error:', error);
      return { 
        success: false, 
        message: error.message.includes('FOREIGN KEY') 
          ? 'Cannot delete supplier as it is being used by other records' 
          : 'Failed to delete supplier' 
      };
    }
  });

  // Import Suppliers
  ipcMain.handle('supplier:import', async (event, suppliers) => {
    try {
      console.log(`📥 Importing ${suppliers.length} suppliers...`);
      
      if (!Array.isArray(suppliers) || suppliers.length === 0) {
        return { success: false, message: 'No suppliers to import' };
      }

      let successCount = 0;
      let errors = [];

      // Process each supplier individually
      for (const [index, supplier] of suppliers.entries()) {
        const {
          supplier_name,
          supplier_code,
          contact_person,
          email,
          phone,
          alternate_phone,
          supplier_type,
          gstin,
          pan,
          business_type,
          hsn_sac_applicable,
          address_line_1,
          address_line_2,
          city,
          state,
          pincode,
          country,
          bank_name,
          account_number,
          ifsc_code,
          upi_id,
          payment_terms,
          opening_balance,
          payment_mode,
          status,
          notes
        } = supplier;

        // Basic validation
        if (!supplier_name) {
          errors.push({ row: index + 1, message: 'Supplier name is required', supplier: 'Unknown' });
          continue;
        }

        // Auto-generate supplier code if not provided
        let finalSupplierCode = supplier_code;
        if (!finalSupplierCode || finalSupplierCode.trim() === '') {
          finalSupplierCode = await generateNextSupplierCode();
          console.log('🔢 Auto-generated supplier code for import:', finalSupplierCode);
        }

        try {
          await new Promise((resolve, reject) => {
            globalDb.run(
              `INSERT INTO suppliers (
                supplier_name, supplier_code, contact_person, email, phone, alternate_phone,
                supplier_type, gstin, pan, business_type, hsn_sac_applicable,
                address_line_1, address_line_2, city, state, pincode, country,
                bank_name, account_number, ifsc_code, upi_id,
                payment_terms, opening_balance, payment_mode, status, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                supplier_name, 
                finalSupplierCode, 
                contact_person || '', 
                email || '',
                phone || '',
                alternate_phone || '', 
                supplier_type || 'Vendor', 
                gstin || '', 
                pan || '', 
                business_type || '', 
                hsn_sac_applicable ? 1 : 0,
                address_line_1 || '', 
                address_line_2 || '', 
                city || '', 
                state || '', 
                pincode || '', 
                country || 'India', 
                bank_name || '', 
                account_number || '', 
                ifsc_code || '', 
                upi_id || '', 
                payment_terms || 'Immediate', 
                opening_balance || 0, 
                payment_mode || 'Cash', 
                status || 'Active', 
                notes || ''
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
          if (errorMessage.includes('UNIQUE constraint failed: suppliers.supplier_code')) {
            errorMessage = `Supplier code "${finalSupplierCode}" already exists`;
          } else if (errorMessage.includes('UNIQUE constraint failed: suppliers.phone')) {
            errorMessage = `Phone number "${phone}" already exists`;
          }
          
          errors.push({ 
            row: index + 1, 
            message: errorMessage,
            supplier: supplier_name
          });
        }
      }

      return { 
        success: true, 
        message: `Import completed: ${successCount} imported, ${errors.length} failed`,
        importedCount: successCount,
        failedCount: errors.length,
        totalCount: suppliers.length,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('❌ Import suppliers error:', error);
      return { success: false, message: 'Failed to import suppliers: ' + error.message };
    }
  });

  console.log('✅ Supplier IPC handlers registered');
}
