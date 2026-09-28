import { ipcMain } from 'electron';

let globalDb = null;

export function initializeStockMovementHandlers(db) {
  if (!db) {
    console.error('❌ Database instance is required for stock movement handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ Stock Movement handlers initialized');

  ipcMain.handle('stock-movement:get-history', async (event, filterParams = {}) => {
    try {
      const { productId, startDate, endDate, limit = 50 } = filterParams;
      
      let query = `
        SELECT sm.*, p.product_name 
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
      `;
      const params = [];
      const conditions = [];

      if (productId) {
        conditions.push('sm.product_id = ?');
        params.push(productId);
      }

      if (startDate) {
        conditions.push('sm.created_at >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('sm.created_at <= ?');
        params.push(endDate);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY sm.created_at DESC LIMIT ?';
      params.push(limit);

      const movements = await new Promise((resolve, reject) => {
        globalDb.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      return { success: true, data: movements };
    } catch (error) {
      console.error('❌ Get stock history error:', error);
      return { success: false, message: 'Failed to fetch stock history' };
    }
  });
}

// Helper function to log stock movement (to be used by other handlers)
export const logStockMovement = async (db, movementData) => {
  const {
    productId,
    referenceType,
    referenceId,
    referenceNumber,
    transactionType,
    quantity,
    previousStock,
    newStock,
    reason,
    createdBy
  } = movementData;

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO stock_movements (
        product_id, reference_type, reference_id, reference_number,
        transaction_type, quantity, previous_stock, new_stock,
        reason, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId, referenceType, referenceId, referenceNumber,
        transactionType, quantity, previousStock, newStock,
        reason, createdBy
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};
