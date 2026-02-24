import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * PrivateRoute guards a route behind authentication.
 * Optionally accepts a `role` prop to enforce role-based access.
 * Unauthenticated users are redirected to /login.
 * Users with the wrong role are redirected to their own dashboard.
 */
const PrivateRoute = ({ children, role }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    // Redirect to the user's appropriate dashboard
    const dashboardMap = { admin: '/admin', doctor: '/doctor', patient: '/patient' };
    return <Navigate to={dashboardMap[user.role] || '/login'} replace />;
  }

  return children;
};

export default PrivateRoute;
