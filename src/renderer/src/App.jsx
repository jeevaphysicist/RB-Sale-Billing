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
// import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Auth/Login';
import ProtectedRoute from './components/ProtectedRoute';
import ImportCustomers from './pages/Masters/Customer/ImportCustomers';
import ImportSuppliers from './pages/Masters/Supplier/ImportSuppliers';

const Home = React.lazy(() => import("./pages/Homepage/Index"));
const SalesList = React.lazy(() => import("./pages/Sales/Orders/Index"));
const SalesAddEdit = React.lazy(() => import("./pages/Sales/Orders/AddEditForm"));
const SalesView = React.lazy(() => import("./pages/Sales/Orders/ViewOrderPage"));
const SalesOrderForm = React.lazy(() => import("./pages/Sales/Orders/SalesOrderForm"));
const SalesPaymentRecord = React.lazy(() => import("./pages/Sales/Payment record/Index"));
const PetpoojaSalesAdd = React.lazy(() => import("./pages/Sales/Orders/PetpoojaSalesAdd"));
const Suppliers = React.lazy(() => import("./pages/Masters/Supplier/Index"));
const Customers = React.lazy(() => import("./pages/Masters/Customer/Index"));
const Settings = React.lazy(() => import("./pages/Settings/Index"));
const UsersIndex = React.lazy(() => import("./pages/Users/Index"));

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
    { path: "/suppliers", element: <Suppliers /> },
    { path: "/suppliers/import", element: <ImportSuppliers /> },
    { path: "/customers", element: <Customers /> },
    { path: "/customers/import", element: <ImportCustomers /> },
    { path: "/settings", element: <Settings /> },
    { path: "/users", element: <UsersIndex currentUser={currentUser} />, allowedRoles: ['admin'] },
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
            <AppContent />
            <Toaster position="top-right" richColors visibleToasts={1} />
          </AuthProvider>
        </AccessibilityProvider>
      </LanguageProvider>
    </Router>
  );
}

export default App;
