import axios from 'axios';

// Získat URL API ze systémových proměnných nebo použít výchozí
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Vytvoření instance Axios s předkonfigurovanou URL
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Přidání interceptoru pro přidání autorizačního tokenu ke každému požadavku
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Přidání interceptoru pro zpracování odpovědí a chyb
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Při chybě 401 (Unauthorized) odhlásit uživatele
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/sign-in';
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default apiClient; 