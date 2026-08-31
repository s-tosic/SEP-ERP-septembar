import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatsko dodavanje JWT tokena u Authorization zaglavlje svakog zahteva
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sep_mm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Obrada 401 Unauthorized odgovora (istekao token ili nevažeći nalog)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('sep_mm_token');
      localStorage.removeItem('sep_mm_user');
      if (window.location.pathname !== '/auth') {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  }
);

export function useApi() {
  return { api };
}
