import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';

export let globalDb = null;

// Migration function to add new columns to existing tables
const runMigrations = (db, callback) => {
  const migrations = [
    {
      name: 'add_loyalty_points_to_customers',
      sql: `
        ALTER TABLE customers 
        ADD COLUMN loyalty_points REAL DEFAULT 0
      `
    },
    {
      name: 'add_order_number_to_sales_orders',
      sql: `ALTER TABLE sales_orders ADD COLUMN order_number TEXT`
    },
    {
      name: 'add_order_date_to_sales_orders',
      sql: `ALTER TABLE sales_orders ADD COLUMN order_date DATE`
    },
    {
      name: 'add_customer_id_to_sales_orders',
      sql: `ALTER TABLE sales_orders ADD COLUMN customer_id INTEGER`
    },
    {
      name: 'add_grand_total_to_sales_orders',
      sql: `ALTER TABLE sales_orders ADD COLUMN grand_total REAL DEFAULT 0`
    },
    {
      name: 'add_payment_status_to_sales_orders',
      sql: `ALTER TABLE sales_orders ADD COLUMN payment_status TEXT DEFAULT 'paid'`
    },
    {
      name: 'add_status_to_sales_orders',
      sql: `ALTER TABLE sales_orders ADD COLUMN status TEXT DEFAULT 'completed'`
    },
    {
      name: 'add_order_time_to_sales_orders',
      sql: `ALTER TABLE sales_orders ADD COLUMN order_time TEXT`
    },
    {
      name: 'add_customer_details_to_sales_orders',
      sql: `ALTER TABLE sales_orders ADD COLUMN customer_phone TEXT`
    },
    { name: 'add_customer_email', sql: `ALTER TABLE sales_orders ADD COLUMN customer_email TEXT` },
    { name: 'add_customer_address', sql: `ALTER TABLE sales_orders ADD COLUMN customer_address TEXT` },
    { name: 'add_customer_gstin', sql: `ALTER TABLE sales_orders ADD COLUMN customer_gstin TEXT` },
    { name: 'add_store_name', sql: `ALTER TABLE sales_orders ADD COLUMN store_name TEXT` },
    { name: 'add_counter_name', sql: `ALTER TABLE sales_orders ADD COLUMN counter_name TEXT` },
    { name: 'add_cashier_name', sql: `ALTER TABLE sales_orders ADD COLUMN cashier_name TEXT` },
    { name: 'add_cashier_id', sql: `ALTER TABLE sales_orders ADD COLUMN cashier_id INTEGER` },
    { name: 'add_delivery_status', sql: `ALTER TABLE sales_orders ADD COLUMN delivery_status TEXT DEFAULT 'delivered'` },
    { name: 'add_subtotal', sql: `ALTER TABLE sales_orders ADD COLUMN subtotal REAL DEFAULT 0` },
    { name: 'add_discount_total', sql: `ALTER TABLE sales_orders ADD COLUMN discount_total REAL DEFAULT 0` },
    { name: 'add_tax_total', sql: `ALTER TABLE sales_orders ADD COLUMN tax_total REAL DEFAULT 0` },
    { name: 'add_round_off', sql: `ALTER TABLE sales_orders ADD COLUMN round_off REAL DEFAULT 0` },
    { name: 'add_payment_type', sql: `ALTER TABLE sales_orders ADD COLUMN payment_type TEXT DEFAULT 'single'` },
    { name: 'add_payment_method', sql: `ALTER TABLE sales_orders ADD COLUMN payment_method TEXT DEFAULT 'cash'` },
    { name: 'add_received_amount', sql: `ALTER TABLE sales_orders ADD COLUMN received_amount REAL DEFAULT 0` },
    { name: 'add_change_amount', sql: `ALTER TABLE sales_orders ADD COLUMN change_amount REAL DEFAULT 0` },
    { name: 'add_split_payment_cash', sql: `ALTER TABLE sales_orders ADD COLUMN split_payment_cash REAL DEFAULT 0` },
    { name: 'add_split_payment_card', sql: `ALTER TABLE sales_orders ADD COLUMN split_payment_card REAL DEFAULT 0` },
    { name: 'add_split_payment_upi', sql: `ALTER TABLE sales_orders ADD COLUMN split_payment_upi REAL DEFAULT 0` },
    { name: 'add_split_payment_credit', sql: `ALTER TABLE sales_orders ADD COLUMN split_payment_credit REAL DEFAULT 0` },
    { name: 'add_split_payment_loyalty', sql: `ALTER TABLE sales_orders ADD COLUMN split_payment_loyalty REAL DEFAULT 0` },
    { name: 'add_loyalty_points_used', sql: `ALTER TABLE sales_orders ADD COLUMN loyalty_points_used REAL DEFAULT 0` },
    { name: 'add_loyalty_points_amount', sql: `ALTER TABLE sales_orders ADD COLUMN loyalty_points_amount REAL DEFAULT 0` },
    { name: 'add_notes', sql: `ALTER TABLE sales_orders ADD COLUMN notes TEXT` },
    { name: 'add_balance_amount', sql: `ALTER TABLE sales_orders ADD COLUMN balance_amount REAL DEFAULT 0` },
    {
      name: 'add_unique_mobile_number_index',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_mobile_number ON customers(mobile_number) WHERE mobile_number != '' AND mobile_number IS NOT NULL`
    },
    {
      name: 'create_customer_transactions_table',
      sql: `CREATE TABLE IF NOT EXISTS customer_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        transaction_date DATETIME DEFAULT (datetime('now')),
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL DEFAULT 0,
        points REAL DEFAULT 0,
        reference_type TEXT,
        reference_id INTEGER,
        reference_number TEXT,
        description TEXT,
        balance_after REAL,
        points_after REAL,
        created_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )`
    },
    {
      name: 'add_district_to_store_settings',
      sql: `ALTER TABLE store_settings ADD COLUMN district TEXT`
    },
    {
      name: 'add_pan_to_store_settings',
      sql: `ALTER TABLE store_settings ADD COLUMN pan TEXT`
    },
    {
      name: 'add_unit_to_sales_order_items',
      sql: `ALTER TABLE sales_order_items ADD COLUMN unit TEXT`
    },
/*
    {
        name: 'add_a4_fields_to_sales_orders',
        sql: `
            ALTER TABLE sales_orders ADD COLUMN delivery_note TEXT;
            ALTER TABLE sales_orders ADD COLUMN supplier_ref TEXT;
            ALTER TABLE sales_orders ADD COLUMN buyer_order_no TEXT;
            ALTER TABLE sales_orders ADD COLUMN dispatch_doc_no TEXT;
            ALTER TABLE sales_orders ADD COLUMN dispatch_through TEXT;
            ALTER TABLE sales_orders ADD COLUMN destination TEXT;
            ALTER TABLE sales_orders ADD COLUMN terms_of_delivery TEXT;
            ALTER TABLE sales_orders ADD COLUMN vehicle_no TEXT;
        `
    }
*/

    {
      name: 'add_price_category_to_sales_orders',
      sql: `ALTER TABLE sales_orders ADD COLUMN price_category TEXT DEFAULT 'Retail'`
    },
    {
      name: 'add_god_name_to_store_settings',
      sql: `ALTER TABLE store_settings ADD COLUMN god_name TEXT`
    },
    {
      name: 'add_fassai_no_to_store_settings',
      sql: `ALTER TABLE store_settings ADD COLUMN fassai_no TEXT`
    },
    {
      name: 'drop_removed_modules_tables',
      sql: `
        DROP TABLE IF EXISTS purchase_order_items;
        DROP TABLE IF EXISTS purchase_order_totals;
        DROP TABLE IF EXISTS purchase_orders;
        DROP TABLE IF EXISTS product_images;
        DROP TABLE IF EXISTS wastage;
        DROP TABLE IF EXISTS stock_movements;
        DROP TABLE IF EXISTS expense_records;
        DROP TABLE IF EXISTS expenses;
        DROP TABLE IF EXISTS products;
        DROP TABLE IF EXISTS categories;
        DROP TABLE IF EXISTS brands;
      `
    }
  ];

  const runMigration = (index = 0) => {
    if (index >= migrations.length) {
      return callback();
    }

    const migration = migrations[index];

    // Handle MULTIPLE STATEMENTS (separated by semicolons) explicitly
    if (migration.sql.includes(';') && (migration.sql.match(/;/g) || []).length > 0) {
        const statements = migration.sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        
        // Helper to run sequential statements
        const runStatements = (stmtIndex) => {
            if (stmtIndex >= statements.length) {
                console.log(`✅ Migration '${migration.name}' completed successfully`);
                return runMigration(index + 1);
            }
            const stmt = statements[stmtIndex];
            
            // Check existence for ADD COLUMN if applicable
            const columnMatch = stmt.match(/ADD COLUMN (\w+)/i);
            const tableMatch = stmt.match(/ALTER TABLE (\w+)/i);

            if (columnMatch && tableMatch) {
                const tableName = tableMatch[1];
                const columnName = columnMatch[1];
                 db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
                    if (err) {
                        console.error(`Error checking columns in ${tableName}:`, err);
                        // Try running anyway
                        db.run(stmt, (err) => {
                             if(err) console.error(`Statement failed: ${stmt}`, err.message);
                             runStatements(stmtIndex + 1);
                        });
                        return;
                    }
                    if (columns.some(col => col.name === columnName)) {
                        console.log(`✅ Column '${columnName}' already exists, skipping statement`);
                        runStatements(stmtIndex + 1);
                    } else {
                         db.run(stmt, (err) => {
                             if(err) console.error(`Statement failed: ${stmt}`, err.message);
                             runStatements(stmtIndex + 1);
                        });
                    }
                 });
            } else {
                 db.run(stmt, (err) => {
                     if(err) console.error(`Statement failed: ${stmt}`, err.message);
                     runStatements(stmtIndex + 1);
                });
            }
        };
        
        runStatements(0);
        return;
    }


    
    // Handle CREATE INDEX migrations differently
    if (migration.sql.trim().startsWith('CREATE')) {
      // For CREATE INDEX, just run it directly (IF NOT EXISTS handles duplicates)
      db.run(migration.sql, (err) => {
        if (err) {
          console.error(`❌ Migration '${migration.name}' failed:`, err.message);
        } else {
          console.log(`✅ Migration '${migration.name}' completed successfully`);
        }
        runMigration(index + 1);
      });
      return;
    }

    if (migration.sql.trim().startsWith('UPDATE')) {
      db.run(migration.sql, (err) => {
        if (err) {
          console.error(`❌ Migration '${migration.name}' failed:`, err.message);
        } else {
          console.log(`✅ Migration '${migration.name}' completed successfully`);
        }
        runMigration(index + 1);
      });
      return;
    }
    
    // Extract table name and column name from ALTER TABLE migrations
    const tableMatch = migration.sql.match(/ALTER TABLE (\w+)/i);
    const columnMatch = migration.sql.match(/ADD COLUMN (\w+)/i);
    
    if (!tableMatch || !columnMatch) {
      console.error(`❌ Could not parse migration '${migration.name}'`);
      return runMigration(index + 1);
    }
    
    const tableName = tableMatch[1];
    const columnName = columnMatch[1];
    
    // Check if column already exists
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
      if (err) {
        console.error(`Error checking columns in ${tableName}:`, err);
        return runMigration(index + 1);
      }

      const columnExists = columns.some(col => col.name === columnName);
      
      if (columnExists) {
        console.log(`✅ Column '${columnName}' already exists in '${tableName}', skipping migration`);
        return runMigration(index + 1);
      }

      // Run migration
      db.run(migration.sql, (err) => {
        if (err) {
          console.error(`❌ Migration '${migration.name}' failed:`, err.message);
        } else {
          console.log(`✅ Migration '${migration.name}' completed successfully`);
        }
        runMigration(index + 1);
      });
    });
  };

  runMigration();
};

export const initDB = (dbPath) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        reject(err);
      } else {
        console.log('Connected to the SQLite database.');
        globalDb = db;
        db.run("PRAGMA foreign_keys = ON", () => {
        const tables = [
          {
            name: 'customers',
            sql: `
              CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT NOT NULL,
                customer_code TEXT UNIQUE,
                contact_person TEXT,
                mobile_number TEXT NOT NULL,
                alternate_number TEXT,
                email TEXT,
                customer_type TEXT DEFAULT 'Retail',
                customer_status TEXT DEFAULT 'Active',
                gstin TEXT,
                pan_number TEXT,
                business_name TEXT,
                billing_type TEXT DEFAULT 'B2C',
                price_category TEXT DEFAULT 'Retail Price',
                address_line_1 TEXT NOT NULL,
                address_line_2 TEXT,
                city TEXT NOT NULL,
                state TEXT NOT NULL,
                pincode TEXT NOT NULL,
                country TEXT DEFAULT 'India',
                shipping_address TEXT,
                opening_balance REAL DEFAULT 0,
                balance_type TEXT DEFAULT 'Receivable',
                credit_limit REAL DEFAULT 0,
                payment_terms TEXT DEFAULT 'Cash',
                payment_method TEXT DEFAULT 'Cash',
                price_level TEXT DEFAULT 'Retail',
                bank_name TEXT,
                account_number TEXT,
                ifsc_code TEXT,
                upi_id TEXT,
                notes TEXT,
                last_purchase_date DATETIME,
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes'))
              )
            `
          },
          {
            name: 'suppliers',
            sql: `
              CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                supplier_name TEXT NOT NULL,
                supplier_code TEXT UNIQUE,
                contact_person TEXT,
                email TEXT,
                phone TEXT NOT NULL,
                alternate_phone TEXT,
                supplier_type TEXT DEFAULT 'Local',
                gstin TEXT,
                pan TEXT,
                business_type TEXT DEFAULT 'Company',
                hsn_sac_applicable BOOLEAN DEFAULT 0,
                address_line_1 TEXT NOT NULL,
                address_line_2 TEXT,
                city TEXT NOT NULL,
                state TEXT NOT NULL,
                pincode TEXT NOT NULL,
                country TEXT DEFAULT 'India',
                bank_name TEXT,
                account_number TEXT,
                ifsc_code TEXT,
                upi_id TEXT,
                payment_terms TEXT DEFAULT 'Cash',
                opening_balance REAL DEFAULT 0,
                payment_mode TEXT DEFAULT 'Cash',
                status TEXT DEFAULT 'Active',
                notes TEXT,
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes'))
              )
            `
          },
          {
            name: 'payment_records',
            sql: `
              CREATE TABLE IF NOT EXISTS payment_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_type TEXT NOT NULL CHECK(record_type IN ('sales')),
                reference_id INTEGER NOT NULL,
                payment_date DATE NOT NULL,
                payment_amount REAL NOT NULL,
                payment_method TEXT DEFAULT 'Cash',
                reference_number TEXT,
                bank_name TEXT,
                cheque_number TEXT,
                transaction_id TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes'))
              )
            `
          }
        ];

        // Add Sales Order Tables
        tables.push(
          {
            name: 'sales_orders',
            sql: `
              CREATE TABLE IF NOT EXISTS sales_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT UNIQUE NOT NULL,
                order_date DATE NOT NULL,
                order_time TEXT,
                price_category TEXT DEFAULT 'Retail',
                
                customer_id INTEGER,
                customer_name TEXT,
                customer_phone TEXT,
                customer_email TEXT,
                customer_address TEXT,
                customer_gstin TEXT,
                
                store_name TEXT,
                counter_name TEXT,
                cashier_name TEXT,
                
                status TEXT DEFAULT 'completed',
                payment_status TEXT DEFAULT 'paid',
                delivery_status TEXT DEFAULT 'delivered',
                
                subtotal REAL DEFAULT 0,
                discount_total REAL DEFAULT 0,
                tax_total REAL DEFAULT 0,
                round_off REAL DEFAULT 0,
                grand_total REAL DEFAULT 0,
                
                payment_type TEXT DEFAULT 'single',
                payment_method TEXT DEFAULT 'cash',
                received_amount REAL DEFAULT 0,
                change_amount REAL DEFAULT 0,
                
                split_payment_cash REAL DEFAULT 0,
                split_payment_card REAL DEFAULT 0,
                split_payment_upi REAL DEFAULT 0,
                split_payment_credit REAL DEFAULT 0,
                split_payment_loyalty REAL DEFAULT 0,
                
                loyalty_points_used REAL DEFAULT 0,
                loyalty_points_amount REAL DEFAULT 0,
                
                notes TEXT,
                
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                
                FOREIGN KEY (customer_id) REFERENCES customers(id)
              )
            `
          },
          {
            name: 'sales_order_items',
            sql: `
              CREATE TABLE IF NOT EXISTS sales_order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_name TEXT,
                product_code TEXT,
                hsn_code TEXT,
                category TEXT,
                
                quantity REAL DEFAULT 0,
                unit_price REAL DEFAULT 0,
                mrp REAL DEFAULT 0,
                
                discount_percent REAL DEFAULT 0,
                discount_amount REAL DEFAULT 0,
                
                tax_rate REAL DEFAULT 0,
                sgst_amount REAL DEFAULT 0,
                cgst_amount REAL DEFAULT 0,
                igst_amount REAL DEFAULT 0,
                tax_amount REAL DEFAULT 0,
                
                gross_amount REAL DEFAULT 0,
                net_amount REAL DEFAULT 0,
                final_amount REAL DEFAULT 0,
                
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                
                FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
              )
            `
          },
          {
            name: 'sales_order_totals',
            sql: `
              CREATE TABLE IF NOT EXISTS sales_order_totals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                
                item_count INTEGER DEFAULT 0,
                total_quantity REAL DEFAULT 0,
                
                subtotal REAL DEFAULT 0,
                
                total_item_discount REAL DEFAULT 0,
                bill_discount REAL DEFAULT 0,
                bill_discount_type TEXT DEFAULT 'flat',
                bill_discount_amount REAL DEFAULT 0,
                
                taxable_amount REAL DEFAULT 0,
                total_sgst REAL DEFAULT 0,
                total_cgst REAL DEFAULT 0,
                total_igst REAL DEFAULT 0,
                total_tax_amount REAL DEFAULT 0,
                
                amount_before_tax REAL DEFAULT 0,
                amount_after_tax REAL DEFAULT 0,
                
                round_off_amount REAL DEFAULT 0,
                grand_total REAL DEFAULT 0,
                
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                
                FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
              )
            `
          },
          {
            name: 'store_settings',
            sql: `
              CREATE TABLE IF NOT EXISTS store_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_name TEXT NOT NULL,
                address_line1 TEXT,
                address_line2 TEXT,
                city TEXT,
                state TEXT,
                pincode TEXT,
                district TEXT,
                pan TEXT,
                phone TEXT,
                email TEXT,
                website TEXT,
                gstin TEXT,
                god_name TEXT,
                fassai_no TEXT,
                logo_path TEXT,
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes'))
              )
            `
          },
          {
            name: 'template_settings',
            sql: `
              CREATE TABLE IF NOT EXISTS template_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_type TEXT NOT NULL, -- 'sales_order'
                template_name TEXT DEFAULT '80mm', -- 'A4', '80mm', '50mm'
                config TEXT, -- JSON string for font, margins, etc.
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                UNIQUE(document_type)
              )
            `
          },
          {
            name: 'users',
            sql: `
              CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                photo TEXT,
                role TEXT DEFAULT 'user', -- 'admin', 'manager', 'cashier', 'sales'
                account_status TEXT DEFAULT 'active', -- 'active', 'inactive', 'suspended'
                is_active BOOLEAN DEFAULT 1,
                last_login DATETIME,
                created_by INTEGER, -- Link to the admin who created this user
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                FOREIGN KEY (created_by) REFERENCES users(id)
              )
            `
          }
        );

        tables.push({
            name: 'customer_transactions',
            sql: `
              CREATE TABLE IF NOT EXISTS customer_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                transaction_date DATETIME DEFAULT (datetime('now')),
                type TEXT NOT NULL,          -- 'DEBIT' (Increase Balance/Owe) or 'CREDIT' (Decrease Balance/Pay)
                category TEXT NOT NULL,      -- 'SALES', 'PAYMENT', 'RETURN', 'LOYALTY_USED', 'LOYALTY_ADJUSTMENT'
                amount REAL DEFAULT 0,       -- Money amount
                points REAL DEFAULT 0,       -- Loyalty points involved
                reference_type TEXT,         -- 'sales_order', 'payment_record'
                reference_id INTEGER,        -- ID of the order/payment
                reference_number TEXT,       -- Order No / Receipt No
                description TEXT,
                balance_after REAL,          -- Running balance snapshot (optional but helpful)
                points_after REAL,           -- Running points snapshot
                created_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes')),
                FOREIGN KEY (customer_id) REFERENCES customers(id)
              )
            `
          });

        tables.push({
            name: 'settings',
            sql: `
              CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT (datetime('now', '+5 hours', '30 minutes'))
              )
            `
        });


        // Insert default admin user if not exists
        // Username: admin, Password: admin123
        const adminPassword = 'admin123';
        const hashedPassword = bcrypt.hashSync(adminPassword, 10);
        
        tables.push({
          name: 'users_seed_admin',
          sql: `
            INSERT INTO users (username, email, password, role, account_status)
            SELECT 'admin', 'admin@example.com', '${hashedPassword}', 'admin', 'active'
            WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
          `
        });

        // Note: The password hash above is a placeholder. In a real app, use a valid bcrypt hash for 'admin123' or similar.
        // Let's use a valid hash for 'admin123': $2a$10$r.zZ.zZ.zZ.zZ.zZ.zZ.zO (This is just an example, I should probably generate one or let the user set it)
        // For now, I will use a known hash for 'password': $2a$10$X5.1.1.1.1.1.1.1.1.1.1 (Invalid)
        // Actually, let's just insert a dummy one and the user can reset it. 
        // Or better, let's not insert a password if we can't generate a valid one here without bcrypt.
        // But the table requires it.
        // I'll use a simple hash for 'admin' which is: $2a$10$8K1p/a0dL1.1.1.1.1.1.1 (This is fake).
        // Let's use a valid hash for 'admin': $2y$10$t.1.1.1.1.1.1.1.1.1.1 (Fake).
        // Okay, I will use a placeholder and the user will have to reset it or I'll use a known one if I had bcrypt here.
        // Since I can't run bcrypt here easily, I'll assume the user will handle the initial login or I'll use a hardcoded hash for 'admin'.
        // Hash for 'admin': $2a$10$2.1.1.1.1.1.1.1.1.1.1 (Fake).
        // I'll just put a placeholder.


        // Insert default store settings if not exists
        tables.push({
          name: 'store_settings_seed',
          sql: `
            INSERT INTO store_settings (store_name, address_line1, city, state, pincode, phone, email, gstin)
            SELECT 'My Store', '123 Main St', 'City', 'State', '123456', '9876543210', 'store@example.com', '22AAAAA0000A1Z5'
            WHERE NOT EXISTS (SELECT 1 FROM store_settings)
          `
        });

        // Insert default Walk-in Customer if not exists
        tables.push({
          name: 'customers_seed_walkin',
          sql: `
            INSERT INTO customers (
              id, customer_name, customer_code, mobile_number, customer_type, address_line_1, city, state, pincode, country
            )
            SELECT 0, 'Walk-in Customer', 'WALK-IN', '0000000000', 'Retail', '', '', '', '', 'India'
            WHERE NOT EXISTS (SELECT 1 FROM customers WHERE id = 0 OR customer_code = 'WALK-IN')
          `
        });

        // Insert default template settings if not exists
        tables.push({
          name: 'template_settings_seed_sales',
          sql: `
            INSERT INTO template_settings (document_type, template_name, config, is_active)
            SELECT 'sales_order', '80mm', '{"fontFamily":"Helvetica","showTax":true,"showDiscount":true}', 1
            WHERE NOT EXISTS (SELECT 1 FROM template_settings WHERE document_type = 'sales_order')
          `
        });

        const createTableSequentially = (index = 0) => {
          if (index >= tables.length) {
            // Run migrations after tables are created
            runMigrations(db, () => {
              return resolve(db);
            });
            return;
          }
          const table = tables[index];
          db.run(table.sql, (err) => {
            if (err) {
              return reject(err);
            }
            createTableSequentially(index + 1);
          });
        };

        createTableSequentially();
      });
    }
  });
});
};

export const debugInitDB = async (dbPath) => {
  const db = await initDB(dbPath);
  globalDb = db; // Assign to exported variable
  return db;
};

export const verifyDatabase = (db) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sales_orders';", (err, row) => {
      if (err) {
        console.error('❌ Error checking for sales_orders table:', err.message);
        return reject(err);
      }

      if (!row) {
        console.error('❌ Sales orders table does not exist in the database');
        return resolve(false);
      }

      console.log('✅ Sales orders table exists');
      resolve(true);
    });
  });
};