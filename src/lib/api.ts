import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 
    'https://enlight-sales-backend-production.up.railway.app',
  headers: { 'Content-Type': 'application/json' }
});
// Attach JWT token and salesperson filter to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('enlight_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add salesperson_phone filter if admin is viewing a specific salesperson
  const viewingAs = localStorage.getItem('enlight_viewing_as');
  if (viewingAs) {
    const emp = JSON.parse(viewingAs);
    config.params = { ...config.params, salesperson_phone: emp.phone };
  }

  return config;
});

// Redirect to login on 401
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('enlight_token');
      localStorage.removeItem('enlight_employee');
      localStorage.removeItem('enlight_viewing_as');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const dealsApi = {
  getKanban: () => API.get('/deals/kanban'),
  getPipeline: () => API.get('/deals/pipeline'),
  getAll: (params?: any) => API.get('/deals', { params }),
  getOne: (id: string) => API.get(`/deals/${id}`),
  updateStage: (id: string, stage: string, lost_reason?: string) =>
    API.patch(`/deals/${id}/stage`, { stage, lost_reason }),
};

export const customersApi = {
  getAll: () => API.get('/customers'),
  getOne: (id: string) => API.get(`/customers/${id}`),
  getChurnRisk: () => API.get('/customers/churn-risk'),
};

export const kraApi = {
  getDashboard: () => API.get('/kra/dashboard'),
  getLogs: () => API.get('/kra/logs'),
};

export const inquiriesApi = {
  getAll: (params?: any) => API.get('/inquiries', { params }),
  getReviewQueue: () => API.get('/inquiries/review-queue'),
  getStats: () => API.get('/inquiries/stats'),
};

export const reportsApi = {
  getMonthly: () => API.get('/reports/monthly'),
  getFunnel: () => API.get('/reports/funnel'),
};

export default API;
