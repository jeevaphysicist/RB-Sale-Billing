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

  // Category Management
  createCategory: (categoryData) => ipcRenderer.invoke('category:create', categoryData),
  getCategories: (filterParams) => ipcRenderer.invoke('category:get-all', filterParams),
  getCategoryById: (categoryId) => ipcRenderer.invoke('category:get-by-id', categoryId),
  updateCategory: (categoryData) => ipcRenderer.invoke('category:update', categoryData),
  deleteCategory: (categoryId) => ipcRenderer.invoke('category:delete', categoryId),

  // Brand Management
  createBrand: (brandData) => ipcRenderer.invoke('brand:create', brandData),
  getBrands: (filterParams) => ipcRenderer.invoke('brand:get-all', filterParams),
  getBrandById: (brandId) => ipcRenderer.invoke('brand:get-by-id', brandId),
  updateBrand: (brandData) => ipcRenderer.invoke('brand:update', brandData),
  deleteBrand: (brandId) => ipcRenderer.invoke('brand:delete', brandId),

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

  // Product Management
  createProduct: (productData) => ipcRenderer.invoke('product:create', productData),
  getProducts: (filterParams) => ipcRenderer.invoke('product:get-all', filterParams),
  getProductById: (productId) => ipcRenderer.invoke('product:get-by-id', productId),
  updateProduct: (productData) => ipcRenderer.invoke('product:update', productData),
  deleteProduct: (productId) => ipcRenderer.invoke('product:delete', productId),
  importProducts: (products) => ipcRenderer.invoke('product:import', products),
  exportProductPriceSheetPdf: (payload) => ipcRenderer.invoke('product:export-price-sheet-pdf', payload),

  // File Management
  uploadProductImage: (imageData) => ipcRenderer.invoke('file:upload-product-image', imageData),
  getProductImages: (productId) => ipcRenderer.invoke('file:get-product-images', productId),
  deleteProductImage: (imageId) => ipcRenderer.invoke('file:delete-product-image', imageId),
  getImagePath: (imageId) => ipcRenderer.invoke('file:get-image-path', imageId),
  uploadProfileImage: (imageData) => ipcRenderer.invoke('file:upload-profile-image', imageData),
  getProfileImage: (userId) => ipcRenderer.invoke('file:get-profile-image', userId),

  // Expense Management
  createExpense: (expenseData) => ipcRenderer.invoke('expense:create', expenseData),
  getExpenses: (filterParams) => ipcRenderer.invoke('expense:get-all', filterParams),
  getExpenseById: (expenseId) => ipcRenderer.invoke('expense:get-by-id', expenseId),
  updateExpense: (expenseData) => ipcRenderer.invoke('expense:update', expenseData),
  deleteExpense: (expenseId) => ipcRenderer.invoke('expense:delete', expenseId),

  // Purchase Order Management
  createPurchaseOrder: (orderData) => ipcRenderer.invoke('purchase-order:create', orderData),
  getPurchaseOrders: (filterParams) => ipcRenderer.invoke('purchase-order:get-all', filterParams),
  getPurchaseOrderById: (poId) => ipcRenderer.invoke('purchase-order:get-by-id', poId),
  updatePurchaseOrder: (orderData) => ipcRenderer.invoke('purchase-order:update', orderData),
  deletePurchaseOrder: (poId) => ipcRenderer.invoke('purchase-order:delete', poId),
  getNextPONumber: () => ipcRenderer.invoke('purchase-order:get-next-number'),

  // Payment Record Management
  createPaymentRecord: (paymentData) => ipcRenderer.invoke('payment-record:create', paymentData),
  getPaymentRecords: (filterParams) => ipcRenderer.invoke('payment-record:get-all', filterParams),
  getPaymentRecordById: (paymentId) => ipcRenderer.invoke('payment-record:get-by-id', paymentId),
  getPaymentRecordsByPO: (poId) => ipcRenderer.invoke('payment-record:get-by-po', poId),
  updatePaymentRecord: (paymentData) => ipcRenderer.invoke('payment-record:update', paymentData),
  deletePaymentRecord: (paymentId) => ipcRenderer.invoke('payment-record:delete', paymentId),
  getPOSummary: (filterParams) => ipcRenderer.invoke('payment-record:get-po-summary', filterParams),

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

  // Sales Report
  getSalesSummary: (filters) => ipcRenderer.invoke('sales-report:get-summary', filters),
  getDailySales: (filters) => ipcRenderer.invoke('sales-report:get-daily-sales', filters),
  getTopProducts: (filters) => ipcRenderer.invoke('sales-report:get-top-products', filters),
  getCategoryBreakdown: (filters) => ipcRenderer.invoke('sales-report:get-category-breakdown', filters),
  getPaymentBreakdown: (filters) => ipcRenderer.invoke('sales-report:get-payment-breakdown', filters),
  getDetailedSales: (filters) => ipcRenderer.invoke('sales-report:get-detailed-sales', filters),

  // Purchase Report
  getPurchaseSummary: (filters) => ipcRenderer.invoke('purchase-report:get-summary', filters),
  getDailyPurchases: (filters) => ipcRenderer.invoke('purchase-report:get-daily-purchases', filters),
  getPurchaseTopProducts: (filters) => ipcRenderer.invoke('purchase-report:get-top-products', filters),
  getPurchaseCategoryBreakdown: (filters) => ipcRenderer.invoke('purchase-report:get-category-breakdown', filters),
  getPurchasePaymentBreakdown: (filters) => ipcRenderer.invoke('purchase-report:get-payment-breakdown', filters),
  getDetailedPurchases: (filters) => ipcRenderer.invoke('purchase-report:get-detailed-purchases', filters),

  // Profit & Loss Report
  getProfitLossSummary: (filters) => ipcRenderer.invoke('profit-loss-report:get-summary', filters),
  getProfitLossDaily: (filters) => ipcRenderer.invoke('profit-loss-report:get-daily', filters),

  // Stock Report
  getStockSummary: (filters) => ipcRenderer.invoke('stock-report:get-summary', filters),
  getStockCategoryBreakdown: (filters) => ipcRenderer.invoke('stock-report:get-category-breakdown', filters),
  getStockList: (filters) => ipcRenderer.invoke('stock-report:get-stock-list', filters),

  // Customer Report
  getCustomerSummary: (filters) => ipcRenderer.invoke('customer-report:get-summary', filters),
  getTopCustomers: (limit) => ipcRenderer.invoke('customer-report:get-top-customers', limit),
  getCustomerList: (filters) => ipcRenderer.invoke('customer-report:get-customer-list', filters),
  
  // Customer Insights Enhancements
  getCustomerGrowthTrends: (filters) => ipcRenderer.invoke('customer-report:get-growth-trends', filters),
  getAtRiskCustomers: (filters) => ipcRenderer.invoke('customer-report:get-at-risk-customers', filters),
  getCustomerSegments: (filters) => ipcRenderer.invoke('customer-report:get-customer-segments', filters),
  getPaymentBehavior: (filters) => ipcRenderer.invoke('customer-report:get-payment-behavior', filters),
  getAOVMetrics: (filters) => ipcRenderer.invoke('customer-report:get-aov-metrics', filters),

  // Supplier Report
  getSupplierSummary: (filters) => ipcRenderer.invoke('supplier-report:get-summary', filters),
  getTopSuppliers: (limit) => ipcRenderer.invoke('supplier-report:get-top-suppliers', limit),
  getSupplierReportList: (filters) => ipcRenderer.invoke('supplier-report:get-supplier-list', filters),

  // Supplier Insights Enhancements
  getSupplierGrowthTrends: (filters) => ipcRenderer.invoke('supplier-report:get-growth-trends', filters),
  getSupplierSegments: (filters) => ipcRenderer.invoke('supplier-report:get-supplier-segments', filters),
  getPurchaseTrends: (filters) => ipcRenderer.invoke('supplier-report:get-purchase-trends', filters),
  getSupplierPaymentBehavior: (filters) => ipcRenderer.invoke('supplier-report:get-payment-behavior', filters),
  getAPVMetrics: (filters) => ipcRenderer.invoke('supplier-report:get-apv-metrics', filters),
  
  // Payment Report
  getPaymentSummary: (filters) => ipcRenderer.invoke('payment-report:get-summary', filters),
  getPaymentChartData: (filters) => ipcRenderer.invoke('payment-report:get-chart-data', filters),
  getPaymentTransactions: (filters) => ipcRenderer.invoke('payment-report:get-transactions', filters),

  // Expense Report
  getExpenseReportSummary: (filters) => ipcRenderer.invoke('expense-report:get-summary', filters),
  getExpenseCategoryBreakdown: (filters) => ipcRenderer.invoke('expense-report:get-category-breakdown', filters),
  getExpenseTrend: (filters) => ipcRenderer.invoke('expense-report:get-trend', filters),
  getExpenseReportList: (filters) => ipcRenderer.invoke('expense-report:get-list', filters),

  // Product Performance Report
  getProductPerformanceSummary: (filters) => ipcRenderer.invoke('product-performance:get-summary', filters),
  getTopSellingProducts: (filters) => ipcRenderer.invoke('product-performance:get-top-products', filters),
  getProductPerformanceList: (filters) => ipcRenderer.invoke('product-performance:get-list', filters),

  // Daily Summary Report
  getDailySummary: (date) => ipcRenderer.invoke('daily-report:get-summary', date),
  getDailyHourlyTrend: (date) => ipcRenderer.invoke('daily-report:get-hourly-trend', date),

  // Wastage Report
  getWastageReportSummary: (filters) => ipcRenderer.invoke('wastage-report:get-summary', filters),
  getWastageReportDetailed: (filters) => ipcRenderer.invoke('wastage-report:get-detailed', filters),

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