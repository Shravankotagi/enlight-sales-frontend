import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ||
    'https://enlight-sales-backend-production.up.railway.app',
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token and salesperson filter to every request
API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('enlight_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Add salesperson_phone filter if admin is viewing a specific salesperson
  const viewingAs = sessionStorage.getItem('enlight_viewing_as');
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
      sessionStorage.removeItem('enlight_token');
      sessionStorage.removeItem('enlight_employee');
      sessionStorage.removeItem('enlight_viewing_as');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const dealsApi = {
  getKanban: (params?: any) => API.get('/deals/kanban', { params }),
  getPipeline: (params?: any) => API.get('/deals/pipeline', { params }),
  getAll: (params?: any) => API.get('/deals', { params }),
  getOne: (id: string) => API.get(`/deals/${id}`),
  updateStage: (id: string, stage: string, lost_reason?: string) =>
    API.patch(`/deals/${id}/stage`, { stage, lost_reason }),
};

export const customersApi = {
  getAll: (params?: any) => API.get('/customers', { params }),
  getOne: (id: string) => API.get(`/customers/${id}`),
  getChurnRisk: (params?: any) => API.get('/customers/churn-risk', { params }),
  getReorderQueue: (params?: any) => API.get('/customers/reorder-queue', { params }),
  getLossAnalytics: (params?: any) => API.get('/customers/loss-analytics', { params }),
  importClients: (data: any) => API.post('/customers/import', data),
};

export const kraApi = {
  getDashboard: (params?: any) => API.get('/kra/dashboard', { params }),
  getSheets: (params?: any) => API.get('/kra/sheets', { params }),
  getLogs: (params?: any) => API.get('/kra/logs', { params }),
  getActionQueue: (params?: any) => API.get('/kra/action-queue', { params }),
};

export const complaintsApi = {
  getAll: (params?: any) => API.get('/kra/complaints', { params }),
  create: (data: any) => API.post('/kra/complaints', data),
  updateStatus: (id: string, status: string, resolution_notes?: string) =>
    API.patch(`/kra/complaints/${id}`, { status, resolution_notes }),
};

export const visitsApi = {
  getAll: (params?: any) => API.get('/kra/visits', { params }),
  create: (data: any) => API.post('/kra/visits', data),
};

export const ordersApi = {
  getAll: (params?: any) => API.get('/deals', { params: { ...params, stage: 'won' } }),
  create: (data: any) => API.post('/deals/order', data),
};

export const inquiriesApi = {
  getAll: (params?: any) => API.get('/inquiries', { params }),
  getReviewQueue: (params?: any) => API.get('/inquiries/review-queue', { params }),
  getStats: (params?: any) => API.get('/inquiries/stats', { params }),
  create: (data: any) => API.post('/inquiries', data),
};

export const reportsApi = {
  getMonthly: (params?: any) => API.get('/reports/monthly', { params }),
  getFunnel: (params?: any) => API.get('/reports/funnel', { params }),
  getSalesperson: (params?: any) => API.get('/reports/salesperson', { params }),
  getSku: (params?: any) => API.get('/reports/sku', { params }),
};

export const employeesApi = {
  getAll: () => API.get('/employees'),
};


export const pricingApi = {
  getToday: () => API.get('/pricing/today'),
  getHistory: () => API.get('/pricing/history'),
  getFloorMargins: () => API.get('/pricing/floor-margins'),
  createRateSheet: (items: any[]) => API.post('/pricing/rate-sheet', { items }),
  updateRateSheet: (id: string, items: any[]) => API.put(`/pricing/rate-sheet/${id}`, { items }),
  lockRateSheet: (id: string) => API.post(`/pricing/rate-sheet/${id}/lock`),
  updateFloorMargin: (id: string, floor_pct: number) =>
    API.patch(`/pricing/floor-margins/${id}`, { floor_pct }),
  checkMargin: (sku_text: string, quoted_price: number, rate_sheet_price: number) =>
    API.post('/pricing/check-margin', { sku_text, quoted_price, rate_sheet_price }),
};

export default API;
