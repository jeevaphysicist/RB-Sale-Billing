import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createSalesOrder } from './services/orderService.js';
import os from 'os';

let server = null;
let dbInstance = null;

const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

export const initializeServer = (db) => {
  if (server) return; // Already running

  dbInstance = db;
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json());

  // Middleware to log requests
  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.url}`);
    next();
  });

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // GET Products (Menu)
  app.get('/api/products', (req, res) => {
    const query = `
      SELECT p.id, p.product_name as name, p.selling_price as price, 
             p.category_id, c.name as category_name, p.product_image as image,
             p.description, p.tax_rate
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'Active'
    `;

    dbInstance.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: 'Failed to fetch products' });
      } else {
        res.json(rows);
      }
    });
  });

  // GET Categories
  app.get('/api/categories', (req, res) => {
    const query = `SELECT id, name FROM categories WHERE status = 'active'`;
    dbInstance.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ error: 'Failed to fetch categories' });
      } else {
        res.json(rows);
      }
    });
  });

  // POST Create Order
  app.post('/api/orders', async (req, res) => {
    try {
      const orderData = req.body;
      console.log('Received order from mobile:', orderData);

      // Validate basic structure
      if (!orderData || !orderData.items || orderData.items.length === 0) {
        return res.status(400).json({ error: 'Invalid order data' });
      }

      // Call the service
      const result = await createSalesOrder(dbInstance, orderData);
      
      res.json(result);
    } catch (error) {
      console.error('Error creating order via API:', error);
      res.status(500).json({ error: error.message });
    }
  });

  try {
    server = app.listen(PORT, '0.0.0.0', () => {
      const localIp = getLocalIp();
      console.log(`🚀 Local API Server running at http://${localIp}:${PORT}`);
      console.log(`   Internal access at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start local server:', err);
  }
};
