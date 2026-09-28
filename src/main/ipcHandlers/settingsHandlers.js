import { ipcMain } from 'electron';

let globalDb = null;

export function initializeSettingsHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for settings handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Settings handlers initialized with database:', !!db);

  // Get Store Details
  ipcMain.handle('settings:get-store-details', async () => {
    try {
      const storeDetails = await new Promise((resolve, reject) => {
        globalDb.get(`SELECT * FROM store_settings LIMIT 1`, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      return { success: true, data: storeDetails };
    } catch (error) {
      console.error('❌ Get store details error:', error);
      return { success: false, message: 'Failed to fetch store details' };
    }
  });

  // Update Store Details
  ipcMain.handle('settings:update-store-details', async (event, details) => {
    try {
      const {
        store_name, address_line1, address_line2, city, state, pincode,
        district, pan, phone, email, website, gstin, god_name, fassai_no
      } = details;

      // Ensure god_name and fassai_no columns exist (safe for old DBs)
      const existingColumns = await new Promise((resolve, reject) => {
        globalDb.all(`PRAGMA table_info(store_settings)`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(r => r.name));
        });
      });

      if (!existingColumns.includes('god_name')) {
        await new Promise((resolve, reject) => {
          globalDb.run(`ALTER TABLE store_settings ADD COLUMN god_name TEXT`, (err) => {
            if (err) reject(err); else resolve();
          });
        });
        console.log('✅ Added god_name column to store_settings');
      }

      if (!existingColumns.includes('fassai_no')) {
        await new Promise((resolve, reject) => {
          globalDb.run(`ALTER TABLE store_settings ADD COLUMN fassai_no TEXT`, (err) => {
            if (err) reject(err); else resolve();
          });
        });
        console.log('✅ Added fassai_no column to store_settings');
      }

      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE store_settings SET
            store_name = ?, address_line1 = ?, address_line2 = ?,
            city = ?, state = ?, pincode = ?, district = ?, pan = ?,
            phone = ?, email = ?, website = ?, gstin = ?,
            god_name = ?, fassai_no = ?,
            updated_at = datetime('now', '+5 hours', '30 minutes')
           WHERE id = (SELECT id FROM store_settings LIMIT 1)`,
          [
            store_name, address_line1, address_line2, city, state, pincode,
            district, pan, phone, email, website, gstin,
            god_name || null, fassai_no || null
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      return { success: true, message: 'Store details updated successfully' };
    } catch (error) {
      console.error('❌ Update store details error:', error);
      return { success: false, message: 'Failed to update store details' };
    }
  });

  console.log('✅ Settings IPC handlers registered');
}
