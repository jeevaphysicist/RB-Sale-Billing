import { appConfig } from './ipcHandlers/appConfig.js'
import { initializeUserHandlers } from './ipcHandlers/userHandlers.js'
import { initializeSupplierHandlers } from './ipcHandlers/supplierHandlers.js'
import { initializeCustomerHandlers } from './ipcHandlers/customerHandlers.js'
import { initializeFileHandlers } from './ipcHandlers/fileHandlers.js'
import { initializePaymentRecordHandlers } from './ipcHandlers/paymentRecordHandlers.js'
import { initializeSalesOrderHandlers } from './ipcHandlers/salesOrderHandlers.js'
import { initializeSettingsHandlers } from './ipcHandlers/settingsHandlers.js'
import { registerTemplateHandlers } from './ipcHandlers/templateHandlers.js'
import { registerPrinterHandlers } from './ipcHandlers/printerHandlers.js'

export function registerIpcHandlers(mainWindow, app, db, dbPath) {
  // Initialize supplier and customer handlers first since they don't depend on the mainWindow
  initializeSupplierHandlers(db);
  initializeCustomerHandlers(db);
  initializePaymentRecordHandlers(db);
  initializeSalesOrderHandlers(db);
  initializeSettingsHandlers(db);
  registerTemplateHandlers();
  registerPrinterHandlers(mainWindow);
  initializeFileHandlers(db, dbPath);

  // Then initialize user handlers
  initializeUserHandlers(db);

  // Finally initialize app config which might need the mainWindow
  appConfig(mainWindow, app, db);

  console.log('✅ All IPC handlers registered successfully');
}
