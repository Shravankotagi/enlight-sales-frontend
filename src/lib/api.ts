import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 
    'https://enlight-sales-backend-production.up.railway.app',
  headers: { 'Content-Type': 'application/json' }
});

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
