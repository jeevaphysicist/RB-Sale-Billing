// preload/index.js
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  toggleFullscreen: () => ipcRenderer.invoke('window-toggle-fullscreen'),

  // Window state
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  isFullscreen: () => ipcRenderer.invoke('window-is-fullscreen'),

  // Window events
  onWindowMaximized: (callback) => {
    ipcRenderer.on('window-maximized', callback)
    return () => ipcRenderer.removeListener('window-maximized', callback)
  },
  onWindowUnmaximized: (callback) => {
    ipcRenderer.on('window-unmaximized', callback)
    return () => ipcRenderer.removeListener('window-unmaximized', callback)
  },
  onWindowFullscreen: (callback) => {
    ipcRenderer.on('window-fullscreen', callback)
    return () => ipcRenderer.removeListener('window-fullscreen', callback)
  },
  onWindowUnfullscreen: (callback) => {
    ipcRenderer.on('window-unfullscreen', callback)
    return () => ipcRenderer.removeListener('window-unfullscreen', callback)
  },

  // Supplier Management
  getSuppliers: (filters) => ipcRenderer.invoke('supplier:get-all', filters),
  getSupplierById: (id) => ipcRenderer.invoke('supplier:get-by-id', id),
  createSupplier: (supplierData) => ipcRenderer.invoke('supplier:create', supplierData),
  updateSupplier: (supplierData) => ipcRenderer.invoke('supplier:update', supplierData),
  deleteSupplier: (id) => ipcRenderer.invoke('supplier:delete', id),
  importSuppliers: (suppliers) => ipcRenderer.invoke('supplier:import', suppliers),

  // Customer Management
  createCustomer: (customerData) => ipcRenderer.invoke('customer:create', customerData),
  getCustomers: (filterParams) => ipcRenderer.invoke('customer:get-all', filterParams),
  getCustomerById: (customerId) => ipcRenderer.invoke('customer:get-by-id', customerId),
  updateCustomer: (customerData) => ipcRenderer.invoke('customer:update', customerData),
  deleteCustomer: (customerId) => ipcRenderer.invoke('customer:delete', customerId),
  importCustomers: (customers) => ipcRenderer.invoke('customer:import', customers),

  // File Management
  uploadProfileImage: (imageData) => ipcRenderer.invoke('file:upload-profile-image', imageData),
  getProfileImage: (userId) => ipcRenderer.invoke('file:get-profile-image', userId),

  // Payment Record Management
  createPaymentRecord: (paymentData) => ipcRenderer.invoke('payment-record:create', paymentData),
  getPaymentRecords: (filterParams) => ipcRenderer.invoke('payment-record:get-all', filterParams),
  getPaymentRecordById: (paymentId) => ipcRenderer.invoke('payment-record:get-by-id', paymentId),
  getPaymentRecordsByPO: (params) => ipcRenderer.invoke('payment-record:get-by-po', params),
  updatePaymentRecord: (paymentData) => ipcRenderer.invoke('payment-record:update', paymentData),
  deletePaymentRecord: (paymentId) => ipcRenderer.invoke('payment-record:delete', paymentId),

  // Sales Order Management
  // Sales Order Management
  createSalesOrder: (orderData) => ipcRenderer.invoke('sales-order:create', orderData),
  getSalesOrders: (filterParams) => ipcRenderer.invoke('sales-order:get-all', filterParams),
  getSalesOrderById: (orderId) => ipcRenderer.invoke('sales-order:get-by-id', orderId),
  updateSalesOrder: (orderData) => ipcRenderer.invoke('sales-order:update', orderData),
  cancelSalesOrder: (orderId) => ipcRenderer.invoke('sales-order:cancel', orderId),
  returnSalesOrder: (orderId) => ipcRenderer.invoke('sales-order:return', orderId),
  deleteSalesOrder: (orderId) => ipcRenderer.invoke('sales-order:delete', orderId),
  generateInvoicePDF: (orderData, templateType, orderId) => ipcRenderer.invoke('sales-order:generate-pdf', { orderData, templateType, orderId }),
  getSOSummary: (filterParams) => ipcRenderer.invoke('sales-order:get-payment-summary', filterParams),
  getNextOrderNumber: () => ipcRenderer.invoke('sales-order:get-next-number'),
  printESCPOS: (orderId) => ipcRenderer.invoke('printer:print-escpos', orderId),
  scanUSBDevices: () => ipcRenderer.invoke('printer:scan-usb'),
  scanSystemPrinters: () => ipcRenderer.invoke('printer:scan-system'),
  savePrinterSettings: (settings) => ipcRenderer.invoke('printer:save-settings', settings),
  getPrinterSettings: () => ipcRenderer.invoke('printer:get-settings'),
  testPrint: () => ipcRenderer.invoke('printer:test-print'),
  generatePreview: (data) => ipcRenderer.invoke('printer:generate-preview', data),
  printPDF: (pdfData, settings) => ipcRenderer.invoke('printer:print-pdf', { pdfData, settings }),
  saveTempPDF: (pdfData) => ipcRenderer.invoke('printer:save-temp-pdf', pdfData),
  printPDFFile: (filePath, settings) => ipcRenderer.invoke('printer:print-pdf-file', { filePath, settings }),
  onOrderSequenceUpdated: (callback) => {
    const subscription = (_, nextNumber) => callback(nextNumber);
    ipcRenderer.on('sales-order:sequence-updated', subscription);
    return () => ipcRenderer.removeListener('sales-order:sequence-updated', subscription);
  },

  // Settings Management
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // User Management
  userLogin: (credentials) => ipcRenderer.invoke('user:login', credentials),
  verifyToken: (token) => ipcRenderer.invoke('user:verify-token', token),
  userLogout: (userId) => ipcRenderer.invoke('user:logout', userId),
  createUser: (userData) => ipcRenderer.invoke('user:create', userData),
  updateUser: (userData) => ipcRenderer.invoke('user:update', userData),
  updateUserPassword: (passwordData) => ipcRenderer.invoke('user:update-password', passwordData),
  getUserById: (userId) => ipcRenderer.invoke('user:get-by-id', userId),
  resetUserPassword: (data) => ipcRenderer.invoke('user:reset-password', data),
  getAppPassword: () => ipcRenderer.invoke('app-password:get'),
  setAppPassword: (password) => ipcRenderer.invoke('app-password:set', password),
  verifyAppPassword: (password) => ipcRenderer.invoke('app-password:verify', password),
  removeAppPassword: () => ipcRenderer.invoke('app-password:remove'),

  // Application info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Generic Event Listener
  on: (channel, callback) => {
    const subscription = (_event, ...args) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  }
}

// Expose APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}