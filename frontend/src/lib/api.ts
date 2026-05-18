import axios from 'axios';

// Create an Axios instance with base URL targeting our proxy
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '', // Handled by Vite proxy in dev: /api -> http://localhost:3001/api
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  async (config) => {
    try {
      const { default: useAuthStore } = await import('../store/authStore');
      const token = useAuthStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // Ignore dynamic import errors during tests/SSR
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Check if unauthorized
    if (error.response?.status === 401) {
      try {
        const { default: useAuthStore } = await import('../store/authStore');
        await useAuthStore.getState().logout();
      } catch (e) {
        console.error('Failed to auto-logout on 401', e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
