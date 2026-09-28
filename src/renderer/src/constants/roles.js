export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  SALES: 'sales'
};

export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',
  
  // Products
  VIEW_PRODUCTS: 'view_products',
  MANAGE_PRODUCTS: 'manage_products', // Create, Edit, Delete
  ADJUST_STOCK: 'adjust_stock',
  
  // Sales
  CREATE_SALE: 'create_sale',
  VIEW_SALES: 'view_sales',
  MANAGE_SALES: 'manage_sales', // Edit, Cancel, Delete
  
  // Purchase
  MANAGE_PURCHASE: 'manage_purchase',
  
  // Expenses
  MANAGE_EXPENSES: 'manage_expenses',
  
  // Customers & Suppliers
  MANAGE_PARTNERS: 'manage_partners',
  
  // Users
  MANAGE_USERS: 'manage_users',
  
  // Reports
  VIEW_REPORTS: 'view_reports',
  
  // Settings
  MANAGE_SETTINGS: 'manage_settings'
};

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.ADJUST_STOCK,
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.MANAGE_SALES,
    PERMISSIONS.MANAGE_PURCHASE,
    PERMISSIONS.MANAGE_EXPENSES,
    PERMISSIONS.MANAGE_PARTNERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_SETTINGS
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.ADJUST_STOCK,
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.MANAGE_SALES, // Maybe restricted?
    PERMISSIONS.MANAGE_PURCHASE,
    PERMISSIONS.MANAGE_EXPENSES,
    PERMISSIONS.MANAGE_PARTNERS,
    PERMISSIONS.VIEW_REPORTS
  ],
  [ROLES.CASHIER]: [
    PERMISSIONS.VIEW_DASHBOARD, // Limited view usually
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_SALES, // Own sales only?
    PERMISSIONS.MANAGE_PARTNERS // Add customers
  ],
  [ROLES.SALES]: [
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_SALES
  ]
};

export const hasPermission = (userRole, permission) => {
  if (!userRole) return false;
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
};
