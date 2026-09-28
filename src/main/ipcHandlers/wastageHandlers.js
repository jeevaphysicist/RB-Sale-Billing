import { ipcMain } from 'electron';

export function initializeWastageHandlers(db) {
  // Create new wastage return
  ipcMain.handle('wastage:create', async (event, wastageData) => {
    const { product_id, quantity, reason, wastage_date, created_by, category } = wastageData;
    
    return new Promise((resolve, reject) => {
      // Start transaction
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. Insert into wastage table
        db.run(
          `INSERT INTO wastage (product_id, quantity, reason, wastage_date, created_by, category) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [product_id, quantity, reason, wastage_date, created_by, category],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            const wastageId = this.lastID;

            // 2. Get current stock
            db.get('SELECT current_stock FROM products WHERE id = ?', [product_id], (err, row) => {
              if (err) {
                db.run('ROLLBACK');
                return reject(err);
              }

              const currentStock = row ? row.current_stock : 0;
              const newStock = currentStock - quantity;

              // 3. Update product stock
              db.run(
                'UPDATE products SET current_stock = ? WHERE id = ?',
                [newStock, product_id],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                  }

                  // 4. Log stock movement
                  db.run(
                    `INSERT INTO stock_movements (
                      product_id, reference_type, reference_id, transaction_type, 
                      quantity, previous_stock, new_stock, reason, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      product_id, 'wastage', wastageId, 'OUT',
                      quantity, currentStock, newStock, `Wastage: ${reason}`, created_by
                    ],
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }

                      db.run('COMMIT');
                      resolve({ success: true, id: wastageId });
                    }
                  );
                }
              );
            });
          }
        );
      });
    });
  });

  // Get all wastage records
  ipcMain.handle('wastage:get-all', async (event, { startDate, endDate, page = 1, pageSize = 20 } = {}) => {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * pageSize;
      let query = `
        SELECT w.*, p.product_name, p.product_code 
        FROM wastage w
        LEFT JOIN products p ON w.product_id = p.id
      `;
      const params = [];
      const whereClauses = [];

      if (startDate && endDate) {
        whereClauses.push('date(w.wastage_date) BETWEEN ? AND ?');
        params.push(startDate, endDate);
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      query += ` ORDER BY w.wastage_date DESC, w.created_at DESC LIMIT ? OFFSET ?`;
      params.push(pageSize, offset);

      // Get total count first
      let countQuery = `SELECT COUNT(*) as count FROM wastage w`;
      if (whereClauses.length > 0) {
        countQuery += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      db.get(countQuery, params.slice(0, -2), (err, countRow) => {
        if (err) return reject(err);
        
        const totalCount = countRow.count;

        db.all(query, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ 
            success: true, 
            data: rows,
            pagination: {
              page,
              pageSize,
              total: totalCount,
              totalPages: Math.ceil(totalCount / pageSize)
            }
          });
        });
      });
    });
  });

  // Delete wastage record (Optional: decide if stock should be reverted. For now, just delete log)
  // Implementing with stock reversal for data integrity
  ipcMain.handle('wastage:delete', async (event, id) => {
    return new Promise((resolve, reject) => {
       db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Get wastage record to know quantity and product
        db.get('SELECT * FROM wastage WHERE id = ?', [id], (err, wastage) => {
            if (err || !wastage) {
                db.run('ROLLBACK');
                return reject(err || new Error('Wastage not found'));
            }

            // Reverse stock
            db.get('SELECT current_stock FROM products WHERE id = ?', [wastage.product_id], (err, product) => {
                if (err) {
                    db.run('ROLLBACK');
                    return reject(err);
                }
                
                const currentStock = product ? product.current_stock : 0;
                const newStock = currentStock + wastage.quantity;

                db.run('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, wastage.product_id], (err) => {
                     if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }

                    // Delete stock movement
                    db.run("DELETE FROM stock_movements WHERE reference_type = 'wastage' AND reference_id = ?", [id], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        
                         // Delete wastage
                        db.run('DELETE FROM wastage WHERE id = ?', [id], (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                            db.run('COMMIT');
                            resolve({ success: true });
                        });
                    });
                });
            });
        });
       });
    });
  });
}
