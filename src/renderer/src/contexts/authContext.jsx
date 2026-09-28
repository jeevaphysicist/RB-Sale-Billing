import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize - check for existing token on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);

        if (storedToken && storedUser) {
          // Defensive check for window.api (prevents crash if preload didn't run)
          if (!window.api) {
            console.warn('window.api is missing in AuthProvider initialization');
            setIsLoading(false);
            return;
          }
          // Verify token with backend
          const response = await window.api.verifyToken(storedToken);
          
          if (response.success) {
            setToken(storedToken);
            setCurrentUser(response.user);
            setIsAuthenticated(true);
          } else {
            // Token is invalid or expired, clear storage
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await window.api.userLogin({ username, password });
      
      if (response.success) {
        // Store token and user data
        localStorage.setItem(TOKEN_KEY, response.token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        
        setToken(response.token);
        setCurrentUser(response.user);
        setIsAuthenticated(true);
        
        return { success: true };
      } else {
        return { success: false, message: response.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed' };
    }
  };

  const logout = async () => {
    try {
      // Call backend logout handler
      if (currentUser) {
        await window.api.userLogout(currentUser.id);
      }

      // Clear local storage
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      
      // Clear state
      setToken(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, message: 'Logout failed' };
    }
  };

  const checkPermission = (requiredRole) => {
    if (!currentUser) return false;
    
    // Admin has access to everything
    if (currentUser.role === 'admin') return true;
    
    // Check if user has required role
    if (requiredRole && currentUser.role !== requiredRole) return false;
    
    return true;
  };

  const hasRole = (role) => {
    return currentUser?.role === role;
  };

  const refreshUser = async () => {
    try {
      if (!token) return { success: false, message: 'No token found' };
      
      const response = await window.api.verifyToken(token);
      
      if (response.success) {
        setCurrentUser(response.user);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        return { success: true, user: response.user };
      } else {
        return { success: false, message: 'Failed to refresh user data' };
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      return { success: false, message: 'Error refreshing user data' };
    }
  };

  const value = {
    currentUser,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshUser,
    checkPermission,
    hasRole
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
