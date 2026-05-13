import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const tokens = localStorage.getItem('auth-tokens');
    if (tokens) {
      try {
        const { accessToken } = JSON.parse(tokens);
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
      } catch {
        // Token inválido, se ignora
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const tokens = localStorage.getItem('auth-tokens');
      if (tokens) {
        try {
          const { refreshToken } = JSON.parse(tokens);
          const response = await axios.post(
            `${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`,
            { refreshToken }
          );

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          localStorage.setItem(
            'auth-tokens',
            JSON.stringify({ accessToken, refreshToken: newRefreshToken })
          );

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('auth-tokens');
          localStorage.removeItem('auth-store');
          window.location.href = '/login';
          return Promise.reject(error);
        }
      }

      localStorage.removeItem('auth-tokens');
      localStorage.removeItem('auth-store');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
