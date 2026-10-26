import { createContext, useContext, useState, useEffect } from 'react';
import { registerUser, loginUser, getCurrentUser } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session
  const [error, setError] = useState(null);

  // On first load, check localStorage for a saved token. If one exists,
  // verify it's still valid by asking the backend who it belongs to —
  // this handles the case where the token expired or was revoked
  // since the last visit.
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('cptruck_token');

      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const { user: freshUser } = await getCurrentUser();
        setUser(freshUser);
      } catch (err) {
        // Token invalid/expired — clear it silently
        localStorage.removeItem('cptruck_token');
        localStorage.removeItem('cptruck_user');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const data = await loginUser(email, password);
      localStorage.setItem('cptruck_token', data.token);
      localStorage.setItem('cptruck_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please try again.';
      setError(message);
      throw new Error(message);
    }
  };

  const register = async (formData) => {
    setError(null);
    try {
      const data = await registerUser(formData);
      localStorage.setItem('cptruck_token', data.token);
      localStorage.setItem('cptruck_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = () => {
    localStorage.removeItem('cptruck_token');
    localStorage.removeItem('cptruck_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for consuming the context — keeps components from
// having to import both useContext and AuthContext separately.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
