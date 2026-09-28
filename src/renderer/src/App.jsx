import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n'; // Initialize i18n
import Layout from './components/Layout';
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from './contexts/authContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { GlobalJobProvider } from './contexts/GlobalJobContext';
// import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Auth/Login';
import ProtectedRoute from './components/ProtectedRoute';
import ImportProducts from './pages/Products/ImportProducts';
import ImportCustomers from './pages/Masters/Customer/ImportCustomers';
import ImportSuppliers from './pages/Masters/Supplier/ImportSuppliers';

const Home = React.lazy(() => import("./pages/Homepage/Index"));
const SalesList = React.lazy(() => import("./pages/Sales/Orders/Index"));
const SalesAddEdit = React.lazy(() => import("./pages/Sales/Orders/AddEditForm"));
const SalesView = React.lazy(() => import("./pages/Sales/Orders/ViewOrderPage"));
const SalesOrderForm = React.lazy(() => import("./pages/Sales/Orders/SalesOrderForm"));
const SalesPaymentRecord = React.lazy(() => import("./pages/Sales/Payment record/Index"));
const PetpoojaSalesAdd = React.lazy(() => import("./pages/Sales/Orders/PetpoojaSalesAdd"));
const Categories = React.lazy(() => import("./pages/Category/Index"));
const Brands = React.lazy(() => import("./pages/Brands/Index"));
const Suppliers = React.lazy(() => import("./pages/Masters/Supplier/Index"));
const Customers = React.lazy(() => import("./pages/Masters/Customer/Index"));
const Products = React.lazy(() => import("./pages/Products/Index"));
const Expenses = React.lazy(() => import("./pages/Masters/Expense/Index"));
const PurchaseOrders = React.lazy(() => import("./pages/PurcahseOrders/Orders/Index"));
const PurchaseOrdersAddEdit = React.lazy(() => import("./pages/PurcahseOrders/Orders/AddEditForm"));
const PurchaseOrdersView = React.lazy(() => import("./pages/PurcahseOrders/Orders/View"));
const PurchaseOrdersPaymentRecord = React.lazy(() => import("./pages/PurcahseOrders/Payment record/Index"));
const PetpoojaPurchaseAdd = React.lazy(() => import("./pages/PurcahseOrders/Orders/PetpoojaPurchaseAdd"));
const Settings = React.lazy(() => import("./pages/Settings/Index"));
const ExpenseRecords = React.lazy(() => import("./pages/Expenses/Index"));
const ExpenseRecordAddEdit = React.lazy(() => import("./pages/Expenses/AddEditForm"));
const BarcodeGenerator = React.lazy(() => import("./pages/Barcode/Index"));
const BarcodeLabelGenerator = React.lazy(() => import("./pages/Barcode/BarcodeLabelGenerator"));
const UsersIndex = React.lazy(() => import("./pages/Users/Index"));
const SalesReport = React.lazy(() => import("./pages/Reports/SalesReport/Index"));
const PurchaseReport = React.lazy(() => import("./pages/Reports/PurchaseReport/Index"));
const ProfitLossReport = React.lazy(() => import("./pages/Reports/ProfitLossReport/Index"));
const StockReport = React.lazy(() => import("./pages/Reports/StockReport/Index"));
const LowStockReport = React.lazy(() => import("./pages/Reports/LowStockReport/Index"));
const CustomerReport = React.lazy(() => import("./pages/Reports/CustomerReport/Index"));
const SupplierReport = React.lazy(() => import("./pages/Reports/SupplierReport/Index"));
const PaymentReport = React.lazy(() => import("./pages/Reports/PaymentReport/Index"));
const ExpenseReport = React.lazy(() => import("./pages/Reports/Expense/Index"));
const ProductPerformanceReport = React.lazy(() => import("./pages/Reports/ProductPerformanceReport/Index"));
const WastageReport = React.lazy(() => import("./pages/Reports/WastageReport/Index"));
const DailySummaryReport = React.lazy(() => import("./pages/Reports/DailySummaryReport/Index"));
const WastageIndex = React.lazy(() => import("./pages/Wastage/Index"));
const WastageAdd = React.lazy(() => import("./pages/Wastage/AddEditForm"));

// Main App Content Component (needs to be inside AuthProvider to use useAuth)
function AppContent() {
  const { currentUser, logout } = useAuth();
  const { t } = useTranslation();

  const mainRoutes = [
    { path: "/", element: <Home /> },
    { path: "/sales", element: <SalesList /> },
    { path: "/sales/new", element: <SalesAddEdit />, noLayout: true },
    { path: "/sales/edit/:id", element: <SalesAddEdit /> },
    { path: "/sales/view/:id", element: <SalesView /> },
    { path: "/sales/order/new", element: <SalesOrderForm /> },
    { path: "/sales/order/edit/:id", element: <SalesOrderForm /> },
    { path: "/sales/payments", element: <SalesPaymentRecord /> },
    { path: "/sales/pos", element: <PetpoojaSalesAdd />, noLayout: true },
    { path: "/categories", element: <Categories /> },
    { path: "/brands", element: <Brands /> },
    { path: "/suppliers", element: <Suppliers /> },
    { path: "/suppliers/import", element: <ImportSuppliers /> },
    { path: "/customers", element: <Customers /> },
    { path: "/customers/import", element: <ImportCustomers /> },
    { path: "/products", element: <Products /> },
    { path: "/products/import", element: <ImportProducts /> },
    { path: "/expenses", element: <Expenses /> },
    { path: "/purchases", element: <PurchaseOrders /> },
    { path: "/purchases/new", element: <PurchaseOrdersAddEdit /> },
    { path: "/purchases/edit/:id", element: <PurchaseOrdersAddEdit /> },
    { path: "/purchases/view/:id", element: <PurchaseOrdersView /> },
    { path: "/purchases/payments", element: <PurchaseOrdersPaymentRecord /> },
    { path: "/purchases/pos", element: <PetpoojaPurchaseAdd />, noLayout: true },
    { path: "/settings", element: <Settings /> },
    { path: "/expense-management", element: <ExpenseRecords /> },
    { path: "/expense-management/new", element: <ExpenseRecordAddEdit /> },
    { path: "/expense-management/edit/:id", element: <ExpenseRecordAddEdit /> },
    { path: "/barcode-generator", element: <BarcodeGenerator /> },
    { path: "/barcode-labels-v2", element: <BarcodeLabelGenerator /> },
    { path: "/users", element: <UsersIndex currentUser={currentUser} />, allowedRoles: ['admin'] },
    { path: "/reports/sales", element: <SalesReport /> },
    { path: "/reports", element: <SalesReport /> },
    { path: "/reports/purchase", element: <PurchaseReport /> },
    { path: "/reports/profit-loss", element: <ProfitLossReport /> },
    { path: "/reports/stock", element: <StockReport /> },
    { path: "/reports/low-stock", element: <LowStockReport /> },
    { path: "/reports/customer", element: <CustomerReport /> },
    { path: "/reports/supplier", element: <SupplierReport /> },
    { path: "/reports/payment", element: <PaymentReport /> },
    { path: "/reports/expense", element: <ExpenseReport /> },
    { path: "/reports/product-performance", element: <ProductPerformanceReport /> },
    { path: "/reports/product-performance", element: <ProductPerformanceReport /> },
    { path: "/reports/wastage", element: <WastageReport /> },
    { path: "/reports/daily-summary", element: <DailySummaryReport /> },
    { path: "/wastage", element: <WastageIndex /> },
    { path: "/wastage/new", element: <WastageAdd /> },
  ];

  return (
    <Routes>
      {/* Public Route - Login */}
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      {mainRoutes.map((route, index) => (
        <Route
          key={index}
          path={route.path}
          element={
            <ProtectedRoute allowedRoles={route.allowedRoles}>
              {route.noLayout ? (
                <ErrorBoundary>
                  <Suspense fallback={<div className="p-4">{t('common.loading')}</div>}>
                    {route.element}
                  </Suspense>
                </ErrorBoundary>
              ) : (
                <Layout onLogout={logout} currentUser={currentUser}>
                  <ErrorBoundary>
                    <Suspense fallback={<div className="p-4">{t('common.loading')}</div>}>
                      {route.element}
                    </Suspense>
                  </ErrorBoundary>
                </Layout>
              )}
            </ProtectedRoute>
          }
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <LanguageProvider>
        <AccessibilityProvider>
          <AuthProvider>
            <GlobalJobProvider>
              <AppContent />
              <Toaster position="top-right" richColors visibleToasts={1} />
            </GlobalJobProvider>
          </AuthProvider>
        </AccessibilityProvider>
      </LanguageProvider>
    </Router>
  );
}

export default App;