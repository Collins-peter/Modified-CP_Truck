import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Attach the JWT to every outgoing request automatically, so
// individual service files don't need to worry about auth headers.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cptruck_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the backend ever responds with 401 (expired/invalid token),
// clear the stored session so the app doesn't stay stuck thinking
// the user is logged in when the server disagrees.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cptruck_token');
      localStorage.removeItem('cptruck_user');
    }
    return Promise.reject(error);
  }
);

export default api;
