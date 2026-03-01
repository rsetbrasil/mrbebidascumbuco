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
import CashAuditPage from './components/modules/CashRegister/CashAuditPage';
import PresalesPage from './components/modules/Presales/PresalesPage';
import TablesPage from './components/modules/Tables/TablesPage';
import FinancialPage from './components/modules/Financial/FinancialPage';
import SettingsPage from './components/modules/Settings/SettingsPage';
import ResetDataPage from './components/modules/Settings/ResetDataPage';
import SalesHistoryPage from './components/modules/Sales/SalesHistoryPage';
import LoginPage from './components/modules/Auth/LoginPage';
import DeliveryFeesPage from './components/modules/DeliveryFees/DeliveryFeesPage';
import ErrorBoundary from './components/common/ErrorBoundary';
import QuickSummaryPage from './components/modules/Financial/QuickSummaryPage';


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

// Private Route Component
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
            <ErrorBoundary>
              <Routes>
                <Route path="/login" element={<LoginPage />} />


                <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/painel" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/pdv" element={<Navigate to="/vendas" replace />} />
                <Route path="/vendas" element={<PrivateRoute><SalesPage /></PrivateRoute>} />
                <Route path="/sales" element={<Navigate to="/vendas" replace />} />
                <Route path="/historico-vendas" element={<PrivateRoute><SalesHistoryPage /></PrivateRoute>} />
                <Route path="/sales-history" element={<Navigate to="/historico-vendas" replace />} />
                <Route path="/pre-vendas" element={<PrivateRoute><PresalesPage /></PrivateRoute>} />
                <Route path="/presales" element={<Navigate to="/pre-vendas" replace />} />
                <Route path="/mesas" element={<PrivateRoute><TablesPage /></PrivateRoute>} />
                <Route path="/tables" element={<Navigate to="/mesas" replace />} />
                <Route path="/caixa" element={<PrivateRoute><CashRegisterPage /></PrivateRoute>} />
                <Route path="/cash-register" element={<Navigate to="/caixa" replace />} />
                <Route path="/financeiro" element={<PrivateRoute><FinancialPage /></PrivateRoute>} />
                <Route path="/financial" element={<Navigate to="/financeiro" replace />} />
                <Route path="/resumo" element={<PrivateRoute><QuickSummaryPage /></PrivateRoute>} />
                <Route path="/quick-summary" element={<Navigate to="/resumo" replace />} />
                <Route path="/produtos" element={<PrivateRoute><ProductsPage /></PrivateRoute>} />
                <Route path="/products" element={<Navigate to="/produtos" replace />} />
                <Route path="/categorias" element={<PrivateRoute><CategoriesPage /></PrivateRoute>} />
                <Route path="/categories" element={<Navigate to="/categorias" replace />} />
                <Route path="/clientes" element={<PrivateRoute><CustomersPage /></PrivateRoute>} />
                <Route path="/customers" element={<Navigate to="/clientes" replace />} />
                <Route path="/configuracoes" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
                <Route path="/settings" element={<Navigate to="/configuracoes" replace />} />
                <Route path="/taxas-entrega" element={<PrivateRoute><DeliveryFeesPage /></PrivateRoute>} />
                <Route path="/delivery-fees" element={<Navigate to="/taxas-entrega" replace />} />
                <Route path="/auditoria-caixa" element={<PrivateRoute><CashAuditPage /></PrivateRoute>} />
                <Route path="/cash-audit" element={<Navigate to="/auditoria-caixa" replace />} />
                <Route path="/zerar-dados" element={<PrivateRoute><ResetDataPage /></PrivateRoute>} />
                <Route path="/reset-data" element={<Navigate to="/zerar-dados" replace />} />
                <Route path="/entrar" element={<LoginPage />} />
              </Routes>
            </ErrorBoundary>
          </CartProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
