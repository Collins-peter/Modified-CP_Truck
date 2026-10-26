import { Routes, Route } from 'react-router-dom';

import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import NotFound from './pages/NotFound';

import CustomerDashboard from './pages/customer/Dashboard';
import NewRequest from './pages/customer/NewRequest';
import MyRequests from './pages/customer/MyRequests';
import Track from './pages/customer/Track';
import Chat from './pages/customer/Chat';
import PaymentCallback from './pages/customer/PaymentCallback';

import AdminDashboard from './pages/admin/Dashboard';
import RiderDashboard from './pages/rider/Dashboard';

import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Customer routes */}
      <Route
        path="/customer/dashboard"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/requests/new"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <NewRequest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/requests"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <MyRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/track"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <Track />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/chat"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <Chat />
          </ProtectedRoute>
        }
      />

      {/* Payment callback — Paystack redirects here after checkout.
          Lives at the top level (not nested under /customer) because
          that's the exact callback_url configured in the backend. */}
      <Route
        path="/payment/callback"
        element={
          <ProtectedRoute allowedRoles={['customer']}>
            <PaymentCallback />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Rider routes */}
      <Route
        path="/rider/dashboard"
        element={
          <ProtectedRoute allowedRoles={['rider']}>
            <RiderDashboard />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
