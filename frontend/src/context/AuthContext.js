import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// AuthContext provides authentication state across the entire app
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Persist user and token to localStorage on login
  const login = useCallback((userData, authToken) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  }, []);

  // Clear auth state from memory and localStorage on logout
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  // Rehydrate auth state from localStorage
  const loadStoredAuth = useCallback(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!storedToken || !storedUser) {
      setToken(null);
      setUser(null);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setToken(storedToken);
      setUser(parsedUser);
    } catch (error) {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === 'token' || event.key === 'user') {
        loadStoredAuth();
      }
    };

    const handleAuthCleared = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('medledger:auth-cleared', handleAuthCleared);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('medledger:auth-cleared', handleAuthCleared);
    };
  }, [loadStoredAuth]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: Boolean(user && token) }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for consuming auth context
export const useAuth = () => useContext(AuthContext);

export default AuthContext;
