import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { CartProvider } from './contexts/CartContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Dashboard from './components/modules/Dashboard';
import SalesPage from './components/modules/Sales/SalesPage';
import './styles/index.css';

import ProductsPage from './components/modules/Products/ProductsPage';
import CategoriesPage from './components/modules/Categories/CategoriesPage';
import CustomersPage from './components/modules/Customers/CustomersPage';
import CashRegisterPage from './components/modules/CashRegister/CashRegisterPage';
import CashRegisterHistoryPage from './components/modules/CashRegister/CashRegisterHistoryPage';
import PresalesPage from './components/modules/Presales/PresalesPage';
import FinancialPage from './components/modules/Financial/FinancialPage';
import SettingsPage from './components/modules/Settings/SettingsPage';
import ResetDataPage from './components/modules/Settings/ResetDataPage';
import SalesHistoryPage from './components/modules/Sales/SalesHistoryPage';
import LoginPage from './components/modules/Auth/LoginPage';

if (typeof window !== 'undefined') {
  const patterns = ['google.firestore.v1.Firestore/Listen', 'net::ERR_ABORTED', 'firestore.googleapis.com'];
  const shouldSuppress = (args) => {
    try {
      return args.some(a => patterns.some(p => String(a).includes(p)));
    } catch {
      return false;
    }
  };
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  console.error = (...args) => {
    if (shouldSuppress(args)) return;
    originalConsoleError(...args);
  };
  console.warn = (...args) => {
    if (shouldSuppress(args)) return;
    originalConsoleWarn(...args);
  };

  window.addEventListener('error', (e) => {
    const msg = String(e.message || '');
    const src = String(e.filename || '');
    if (patterns.some(p => msg.includes(p)) || patterns.some(p => src.includes(p))) {
      e.preventDefault();
      return false;
    }
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e && e.reason ? String(e.reason.message || e.reason) : '';
    if (patterns.some(p => reason.includes(p))) {
      e.preventDefault();
      return false;
    }
  });
}

// Protected Route Component
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Carregando...</div>; // Or a proper loading spinner
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <CartProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/sales" element={<PrivateRoute><SalesPage /></PrivateRoute>} />
              <Route path="/sales-history" element={<PrivateRoute><SalesHistoryPage /></PrivateRoute>} />
              <Route path="/presales" element={<PrivateRoute><PresalesPage /></PrivateRoute>} />
              <Route path="/cash-register" element={<PrivateRoute><CashRegisterPage /></PrivateRoute>} />
              <Route path="/cash-register-history" element={<PrivateRoute><CashRegisterHistoryPage /></PrivateRoute>} />
              <Route path="/financial" element={<PrivateRoute><FinancialPage /></PrivateRoute>} />
              <Route path="/products" element={<PrivateRoute><ProductsPage /></PrivateRoute>} />
              <Route path="/categories" element={<PrivateRoute><CategoriesPage /></PrivateRoute>} />
              <Route path="/customers" element={<PrivateRoute><CustomersPage /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
              <Route path="/reset-data" element={<PrivateRoute><ResetDataPage /></PrivateRoute>} />
            </Routes>
          </CartProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
