import { appConfig } from './ipcHandlers/appConfig.js'
import { initializeUserHandlers } from './ipcHandlers/userHandlers.js'
import { initializeCategoryHandlers } from './ipcHandlers/categoryHandlers.js'
import { initializeBrandHandlers } from './ipcHandlers/brandHandlers.js'
import { initializeSupplierHandlers } from './ipcHandlers/supplierHandlers.js'
import { initializeCustomerHandlers } from './ipcHandlers/customerHandlers.js'
import { initializeProductHandlers } from './ipcHandlers/productHandlers.js'
import { initializeFileHandlers } from './ipcHandlers/fileHandlers.js'
import { initializeExpenseHandlers } from './ipcHandlers/expenseHandlers.js'
import { initializePurchaseOrderHandlers } from './ipcHandlers/purchaseOrderHandlers.js'
import { initializePaymentRecordHandlers } from './ipcHandlers/paymentRecordHandlers.js'
import { initializeSalesOrderHandlers } from './ipcHandlers/salesOrderHandlers.js'
import { initializeSettingsHandlers } from './ipcHandlers/settingsHandlers.js'
import { registerTemplateHandlers } from './ipcHandlers/templateHandlers.js'
import { initializeStockMovementHandlers } from './ipcHandlers/stockMovementHandlers.js'
import { initializeExpenseRecordHandlers } from './ipcHandlers/expenseRecordHandlers.js'
import { initializeBarcodeHandlers } from './ipcHandlers/barcodeHandlers.js'
import { initializeSalesReportHandlers } from './ipcHandlers/salesReportHandlers.js'
import { initializePurchaseReportHandlers } from './ipcHandlers/purchaseReportHandlers.js'
import { initializeProfitLossReportHandlers } from './ipcHandlers/profitLossReportHandlers.js'
import { initializeStockReportHandlers } from './ipcHandlers/stockReportHandlers.js'
import { initializeCustomerReportHandlers } from './ipcHandlers/customerReportHandlers.js'
import { initializeSupplierReportHandlers } from './ipcHandlers/supplierReportHandlers.js'
import { initializePaymentReportHandlers } from './ipcHandlers/paymentReportHandlers.js'
import { initializeExpenseReportHandlers } from './ipcHandlers/expenseReportHandlers.js'
import { initializeProductPerformanceReportHandlers } from './ipcHandlers/productPerformanceReportHandlers.js'
import { initializeDailySummaryReportHandlers } from './ipcHandlers/dailySummaryReportHandlers.js'
import { initializeWastageReportHandlers } from './ipcHandlers/wastageReportHandlers.js'
import { initializeWastageHandlers } from './ipcHandlers/wastageHandlers.js'


import { registerPrinterHandlers } from './ipcHandlers/printerHandlers.js'

export function registerIpcHandlers(mainWindow, app, db, dbPath) {
  // Initialize category, brand, supplier, customer, product, and expense handlers first since they don't depend on the mainWindow
  initializeCategoryHandlers(db);
  initializeBrandHandlers(db);
  initializeSupplierHandlers(db);
  initializeCustomerHandlers(db);
  initializeProductHandlers(db);
  initializeExpenseHandlers(db);
  initializeExpenseRecordHandlers(db);
  initializePurchaseOrderHandlers(db);
  initializePaymentRecordHandlers(db);
  initializeSalesOrderHandlers(db);
  initializeSettingsHandlers(db);
  registerTemplateHandlers();
  registerPrinterHandlers(mainWindow);
  initializeStockMovementHandlers(db);
  initializeBarcodeHandlers(db);
  initializeFileHandlers(db, dbPath);
  initializeSalesReportHandlers(db);
  initializePurchaseReportHandlers(db);
  initializeProfitLossReportHandlers(db);
  initializeStockReportHandlers(db);
  initializeCustomerReportHandlers(db);
  initializeSupplierReportHandlers(db);
  initializePaymentReportHandlers(db);
  initializeExpenseReportHandlers(db);
  initializeProductPerformanceReportHandlers(db);

  initializeDailySummaryReportHandlers(db);
  initializeWastageReportHandlers(db);
  initializeWastageHandlers(db);
  
  // Then initialize user handlers
  initializeUserHandlers(db);
  
  // Finally initialize app config which might need the mainWindow
  appConfig(mainWindow, app, db);
  
  console.log('✅ All IPC handlers registered successfully');
}