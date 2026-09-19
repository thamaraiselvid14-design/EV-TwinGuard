import React, { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import CustomerLogin from './pages/CustomerLogin';
import CustomerRegister from './pages/CustomerRegister';
import OwnerLogin from './pages/OwnerLogin';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerCustomerView from './pages/OwnerCustomerView';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    const p = window.location.pathname;
    if (p === '/' || p === '') {
      const token = localStorage.getItem('customer_token');
      return token ? '/customer/dashboard' : '/customer/login';
    }
    return p;
  });

  const navigate = (toPath) => {
    window.history.pushState({}, '', toPath);
    setCurrentPath(toPath);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/customer/login');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Match /owner/customers/:customerId
  const ownerCustomerMatch = currentPath.match(/^\/owner\/customers\/([^/]+)$/);

  const renderRoute = () => {
    if (currentPath === '/customer/login' || currentPath === '/') {
      return <CustomerLogin navigate={navigate} />;
    }

    if (currentPath === '/customer/register') {
      return <CustomerRegister navigate={navigate} />;
    }

    if (currentPath === '/owner/login') {
      return <OwnerLogin navigate={navigate} />;
    }

    if (currentPath === '/owner/dashboard') {
      return <OwnerDashboard navigate={navigate} />;
    }

    if (ownerCustomerMatch) {
      const customerId = ownerCustomerMatch[1];
      return <OwnerCustomerView customerId={customerId} navigate={navigate} />;
    }

    // Customer Settings (/customer/settings or /settings)
    if (currentPath === '/customer/settings' || currentPath === '/settings') {
      return <Dashboard navigate={navigate} initialPage="settings" />;
    }

    // Default: Customer Dashboard (/customer/dashboard or fallback)
    return <Dashboard navigate={navigate} initialPage="dashboard" />;
  };

  return (
    <ErrorBoundary>
      {renderRoute()}
    </ErrorBoundary>
  );
}
