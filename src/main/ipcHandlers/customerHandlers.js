import { ipcMain } from 'electron';

let globalDb = null;

export function initializeCustomerHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for customer handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Customer handlers initialized with database:', !!db);

  const handlers = [
    'customer:create',
    'customer:get-all',
    'customer:get-by-id',
    'customer:update',
    'customer:delete',
    'customer:import'
  ];
  
  console.log('📋 Registered customer handlers:', handlers);

  // Helper function to generate next customer code
  async function generateNextCustomerCode() {
    return new Promise((resolve, reject) => {
      globalDb.get(
        `SELECT customer_code FROM customers 
         WHERE customer_code LIKE 'CUST%' 
         ORDER BY CAST(SUBSTR(customer_code, 5) AS INTEGER) DESC 
         LIMIT 1`,
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row && row.customer_code) {
            // Extract number and increment
            const match = row.customer_code.match(/CUST(\d+)/);
            if (match) {
              const nextNumber = parseInt(match[1]) + 1;
              resolve(`CUST${String(nextNumber).padStart(3, '0')}`);
            } else {
              resolve('CUST001');
            }
          } else {
            // No existing codes, start with CUST001
            resolve('CUST001');
          }
        }
      );
    });
  }

  // Create Customer
  ipcMain.handle('customer:create', async (event, customerData) => {
    try {
      console.log('📥 Creating customer with data:', customerData);
      
      const {
        customer_name,
        customer_code,
        contact_person,
        mobile_number,
        alternate_number,
        email,
        customer_type,
        customer_status,
        gstin,
        pan_number,
        business_name,
        billing_type,
        price_category,
        address_line_1,
        address_line_2,
        city,
        state,
        pincode,
        country,
        shipping_address,
        opening_balance,
        balance_type,
        credit_limit,
        payment_terms,
        payment_method,
        price_level,
        bank_name,
        account_number,
        ifsc_code,
        upi_id,
        notes,
        loyalty_points
      } = customerData;

      // Validation
      if (!customer_name) {
        return { success: false, message: 'Customer name is required' };
      }

      // Auto-generate customer code if not provided
      let finalCustomerCode = customer_code;
      if (!finalCustomerCode || finalCustomerCode.trim() === '') {
        finalCustomerCode = await generateNextCustomerCode();
        console.log('🔢 Auto-generated customer code:', finalCustomerCode);
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `INSERT INTO customers (
            customer_name, customer_code, contact_person, mobile_number, alternate_number, email,
            customer_type, customer_status, gstin, pan_number, business_name, billing_type, price_category,
            address_line_1, address_line_2, city, state, pincode, country, shipping_address,
            opening_balance, balance_type, credit_limit, payment_terms, payment_method, price_level,
            bank_name, account_number, ifsc_code, upi_id, notes, loyalty_points
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            customer_name, finalCustomerCode || '', contact_person || '', mobile_number || '', alternate_number || '', email || '',
            customer_type || 'Individual', customer_status || 'Active', gstin || '', pan_number || '', business_name || '', billing_type || 'B2C', price_category || 'Retail',
            address_line_1 || '', address_line_2 || '', city || '', state || '', pincode || '', country || 'India', shipping_address || '',
            opening_balance || 0, balance_type || 'Debit', credit_limit || 0, payment_terms || 'Immediate', payment_method || 'Cash', price_level || 'Standard',
            bank_name || '', account_number || '', ifsc_code || '', upi_id || '', notes || '', loyalty_points || 0
          ],
          function(err) {
            if (err) {
              console.error('❌ Create customer error:', err.message);
              if (err.message.includes('UNIQUE constraint')) {
                if (err.message.includes('customer_code')) {
                  reject(new Error('Customer code already exists'));
                } else if (err.message.includes('mobile_number')) {
                  reject(new Error('Mobile number already exists'));
                } else {
                  reject(new Error('Duplicate entry detected'));
                }
              } else {
                reject(err);
              }
            } else {
              console.log('✅ Customer created with ID:', this.lastID);
              resolve({ id: this.lastID });
            }
          }
        );
      });

      return { 
        success: true, 
        message: 'Customer created successfully',
        customerId: result.id 
      };
    } catch (error) {
      console.error('❌ Create customer error:', error);
      return { success: false, message: error.message || 'Failed to create customer' };
    }
  });

  // Get All Customers with Filters
  ipcMain.handle('customer:get-all', async (event, filterParams = {}) => {
    try {
      console.log('📥 Getting customers with filter params:', filterParams);
      const { searchTerm, sortKey = 'id', sortDirection = 'DESC', page = 1, limit = 10, status } = filterParams;
      const offset = (page - 1) * limit;
      
      const validSortKeys = ['id', 'customer_name', 'customer_code', 'contact_person', 'mobile_number', 'email', 'city', 'state', 'customer_type', 'customer_status', 'created_at'];
      const safeSortKey = validSortKeys.includes(sortKey) ? sortKey : 'id';
      const safeSortDirection = sortDirection.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      
      let query = `SELECT * FROM customers`;
      let countQuery = `SELECT COUNT(*) as total FROM customers`;
      const params = [];
      const countParams = [];
      const conditions = [];
      
      // Add status filter
      if (status) {
        conditions.push(`customer_status = ?`);
        params.push(status);
        countParams.push(status);
      }
      
      // Add search filter
      if (searchTerm) {
        conditions.push(`(customer_name LIKE ? OR customer_code LIKE ? OR contact_person LIKE ? OR mobile_number LIKE ? OR email LIKE ? OR city LIKE ?)`);
        const searchParam = `%${searchTerm}%`;
        params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
        countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
      }
      
      // Apply conditions
      if (conditions.length > 0) {
        const whereClause = ` WHERE ${conditions.join(' AND ')}`;
        query += whereClause;
        countQuery += whereClause;
      }
      
      query += ` ORDER BY ${safeSortKey} ${safeSortDirection}`;
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
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

      const customers = await new Promise((resolve, reject) => {
        globalDb.all(query, params, (err, rows) => {
          if (err) {
            console.error('Error fetching customers:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });

      return {
        success: true,
        data: customers,
        total: countResult,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      };
    } catch (error) {
      console.error('❌ Get customers error:', error);
      return { success: false, message: 'Failed to fetch customers', error: error.message };
    }
  });

  // Get Customer by ID
  ipcMain.handle('customer:get-by-id', async (event, customerId) => {
    try {
      if (!customerId) {
        return { success: false, message: 'Customer ID is required' };
      }

      const customer = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT * FROM customers WHERE id = ?`,
          [customerId],
          (err, row) => {
            if (err) {
              console.error('❌ Get customer error:', err.message);
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (!customer) {
        return { success: false, message: 'Customer not found' };
      }

      return { success: true, customer };
    } catch (error) {
      console.error('❌ Get customer error:', error);
      return { success: false, message: 'Failed to fetch customer' };
    }
  });

  // Update Customer
  ipcMain.handle('customer:update', async (event, customerData) => {
    try {
      const {
        id,
        customer_name,
        customer_code,
        contact_person,
        mobile_number,
        alternate_number,
        email,
        customer_type,
        customer_status,
        gstin,
        pan_number,
        business_name,
        billing_type,
        price_category,
        address_line_1,
        address_line_2,
        city,
        state,
        pincode,
        country,
        shipping_address,
        opening_balance,
        balance_type,
        credit_limit,
        payment_terms,
        payment_method,
        price_level,
        bank_name,
        account_number,
        ifsc_code,
        upi_id,
        notes,
        loyalty_points
      } = customerData;

      if (!id) {
        return { success: false, message: 'Customer ID is required' };
      }

      if (!customer_name) {
        return { success: false, message: 'Customer name is required' };
      }



      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE customers SET 
            customer_name = ?, customer_code = ?, contact_person = ?, mobile_number = ?, alternate_number = ?, email = ?,
            customer_type = ?, customer_status = ?, gstin = ?, pan_number = ?, business_name = ?, billing_type = ?, price_category = ?,
            address_line_1 = ?, address_line_2 = ?, city = ?, state = ?, pincode = ?, country = ?, shipping_address = ?,
            opening_balance = ?, balance_type = ?, credit_limit = ?, payment_terms = ?, payment_method = ?, price_level = ?,
            bank_name = ?, account_number = ?, ifsc_code = ?, upi_id = ?, notes = ?, loyalty_points = ?,
            updated_at = datetime('now', '+5 hours', '30 minutes')
          WHERE id = ?`,
          [
            customer_name, customer_code, contact_person, mobile_number || '', alternate_number, email,
            customer_type, customer_status, gstin, pan_number, business_name, billing_type, price_category,
            address_line_1, address_line_2, city, state, pincode, country, shipping_address,
            opening_balance || 0, balance_type, credit_limit || 0, payment_terms, payment_method, price_level,
            bank_name, account_number, ifsc_code, upi_id, notes, loyalty_points || 0,
            id
          ],
          (err) => {
            if (err) {
              console.error('❌ Update customer error:', err.message);
              if (err.message.includes('UNIQUE constraint')) {
                if (err.message.includes('customer_code')) {
                  reject(new Error('Customer code already exists'));
                } else if (err.message.includes('mobile_number')) {
                  reject(new Error('Mobile number already exists'));
                } else {
                  reject(new Error('Duplicate entry detected'));
                }
              } else {
                reject(err);
              }
            } else {
              console.log(`✅ Customer ${id} updated successfully`);
              resolve();
            }
          }
        );
      });

      return { success: true, message: 'Customer updated successfully' };
    } catch (error) {
      console.error('❌ Update customer error:', error);
      return { success: false, message: error.message || 'Failed to update customer' };
    }
  });

  // Delete Customer
  ipcMain.handle('customer:delete', async (event, customerId) => {
    try {
      if (!customerId) {
        return { success: false, message: 'Customer ID is required' };
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `DELETE FROM customers WHERE id = ?`,
          [customerId],
          function(err) {
            if (err) {
              console.error('❌ Delete customer error:', err.message);
              reject(err);
            } else {
              if (this.changes === 0) {
                resolve({ success: false, message: 'Customer not found' });
              } else {
                console.log(`✅ Customer ${customerId} deleted successfully`);
                resolve({ success: true, message: 'Customer deleted successfully' });
              }
            }
          }
        );
      });

      return result;
    } catch (error) {
      console.error('❌ Delete customer error:', error);
      return { 
        success: false, 
        message: error.message.includes('FOREIGN KEY') 
          ? 'Cannot delete customer as it is being used by other records' 
          : 'Failed to delete customer' 
      };
    }
  });

  // Import Customers (Bulk)
  ipcMain.handle('customer:import', async (event, customers) => {
    try {
      console.log(`📥 Importing ${customers.length} customers...`);
      
      if (!Array.isArray(customers) || customers.length === 0) {
        return { success: false, message: 'No customers to import' };
      }

      let successCount = 0;
      let errors = [];

      // Process each customer individually
      for (const [index, customer] of customers.entries()) {
        const {
          customer_name,
          customer_code,
          contact_person,
          mobile_number,
          alternate_number,
          email,
          customer_type,
          customer_status,
          gstin,
          pan_number,
          business_name,
          billing_type,
          price_category,
          address_line_1,
          address_line_2,
          city,
          state,
          pincode,
          country,
          shipping_address,
          opening_balance,
          balance_type,
          credit_limit,
          payment_terms,
          payment_method,
          price_level,
          bank_name,
          account_number,
          ifsc_code,
          upi_id,
          notes,
          loyalty_points
        } = customer;

        // Basic validation
        if (!customer_name) {
          errors.push({ row: index + 1, message: 'Customer name is required', customer: 'Unknown' });
          continue;
        }

        // Auto-generate customer code if not provided
        let finalCustomerCode = customer_code;
        if (!finalCustomerCode || finalCustomerCode.trim() === '') {
          finalCustomerCode = await generateNextCustomerCode();
          console.log('🔢 Auto-generated customer code for import:', finalCustomerCode);
        }

        try {
          await new Promise((resolve, reject) => {
            globalDb.run(
              `INSERT INTO customers (
                customer_name, customer_code, contact_person, mobile_number, alternate_number, email,
                customer_type, customer_status, gstin, pan_number, business_name, billing_type, price_category,
                address_line_1, address_line_2, city, state, pincode, country, shipping_address,
                opening_balance, balance_type, credit_limit, payment_terms, payment_method, price_level,
                bank_name, account_number, ifsc_code, upi_id, notes, loyalty_points
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                customer_name, 
                finalCustomerCode, 
                contact_person || '', 
                mobile_number || '', // Treat empty as empty string to avoid NOT NULL constraint
                alternate_number || '', 
                email || '',
                customer_type || 'Individual', 
                customer_status || 'Active', 
                gstin || '', 
                pan_number || '', 
                business_name || '', 
                billing_type || 'B2C', 
                price_category || 'Retail',
                address_line_1 || '', 
                address_line_2 || '', 
                city || '', 
                state || '', 
                pincode || '', 
                country || 'India', 
                shipping_address || '',
                opening_balance || 0, 
                balance_type || 'Debit', 
                credit_limit || 0, 
                payment_terms || 'Immediate', 
                payment_method || 'Cash', 
                price_level || 'Standard',
                bank_name || '', 
                account_number || '', 
                ifsc_code || '', 
                upi_id || '', 
                notes || '', 
                loyalty_points || 0
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
          if (errorMessage.includes('UNIQUE constraint failed: customers.customer_code')) {
            errorMessage = `Customer code "${customer_code}" already exists`;
          } else if (errorMessage.includes('UNIQUE constraint failed: customers.mobile_number')) {
            errorMessage = `Mobile number "${mobile_number}" already exists`;
          }
          
          errors.push({ 
            row: index + 1, 
            message: errorMessage,
            customer: customer_name
          });
        }
      }

      return { 
        success: true, 
        message: `Import completed: ${successCount} imported, ${errors.length} failed`,
        importedCount: successCount,
        failedCount: errors.length,
        totalCount: customers.length,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('❌ Import customers error:', error);
      return { success: false, message: 'Failed to import customers: ' + error.message };
    }
  });

  console.log('✅ Customer IPC handlers registered');
}
