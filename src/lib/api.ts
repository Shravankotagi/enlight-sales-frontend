import axios from 'axios';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const defaultBackend = isLocal ? 'http://localhost:3000' : 'https://enlight-sales-backend-production-b720.up.railway.app';
let rawBackend = import.meta.env.VITE_BACKEND_URL || defaultBackend;
if (rawBackend && !rawBackend.startsWith('http://') && !rawBackend.startsWith('https://')) {
  rawBackend = `https://${rawBackend}`;
}

const API = axios.create({
  baseURL: rawBackend.replace(/\/+$/, ''),
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
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
    const isPersonalMode =
      emp.mode === 'personal' ||
      emp.role === 'salesperson' ||
      emp.is_personal === true;
    config.params = {
      ...config.params,
      salesperson_phone: config.params?.salesperson_phone || emp.phone,
      mode: config.params?.mode || (isPersonalMode ? 'personal' : 'manager'),
    };
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
  processPo: (data: any) => API.post('/deals/process-po', data),
  delete: (id: string) => API.delete(`/deals/${id}`),
};

export const customersApi = {
  getAll: (params?: any) => API.get('/customers', { params }),
  getOne: (id: string) => API.get(`/customers/${encodeURIComponent(id)}`),
  getChurnRisk: (params?: any) => API.get('/customers/churn-risk', { params }),
  getReorderQueue: (params?: any) => API.get('/customers/reorder-queue', { params }),
  getLossAnalytics: (params?: any) => API.get('/customers/loss-analytics', { params }),
  importClients: (data: any) => API.post('/customers/import', data),
  update: (id: string, data: any) => API.patch(`/customers/${encodeURIComponent(id)}`, data),
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
  update: (id: string, data: any) => API.patch(`/kra/complaints/${id}`, data),
  updateStatus: (id: string, status: string, resolution_notes?: string) =>
    API.patch(`/kra/complaints/${id}`, { status, resolution_notes }),
};

export const visitsApi = {
  getAll: (params?: any) => API.get('/kra/visits', { params }),
  create: (data: any) => API.post('/kra/visits', data),
  update: (id: string, data: any) => API.patch(`/kra/visits/${id}`, data),
  delete: (id: string) => API.delete(`/kra/visits/${id}`),
};

export const ordersApi = {
  getAll: (params?: any) => API.get('/deals', { params: { ...params, stage: 'won' } }),
  getOne: (id: string) => API.get(`/deals/${id}`),
  create: (data: any) => API.post('/deals/order', data),
  processPo: (data: any) => API.post('/deals/process-po', data),
  delete: (id: string) => API.delete(`/deals/${id}`),
};

export const inquiriesApi = {
  getAll: (params?: any) => API.get('/inquiries', { params }),
  getOne: (id: string) => API.get(`/inquiries/${id}`),
  getReviewQueue: (params?: any) => API.get('/inquiries/review-queue', { params }),
  getStats: (params?: any) => API.get('/inquiries/stats', { params }),
  create: (data: any) => API.post('/inquiries', data),
  updateStatus: (id: string, status: string, details?: any) => API.patch(`/inquiries/${id}/status`, { status, details }),
  sendQuotation: (id: string, payload: any) => API.post(`/inquiries/send-quotation/${id}`, payload),
  generatePdf: (payload: any) => API.post('/inquiries/generate-pdf', payload, { responseType: 'blob' }),
  parseDocument: (payload: any) => API.post('/inquiries/parse-document', payload),
  parseText: (payload: { text: string }) => API.post('/inquiries/parse-text', payload),
};

export const productsApi = {
  getAll: (params?: any) => API.get('/products', { params }),
  lookup: (name: string, dimensions?: string) => API.get('/products/lookup', { params: { name, dimensions } }),
};

export const reportsApi = {
  getOverview: (params?: any) => API.get('/reports/overview', { params }),
  getMonthly: (params?: any) => API.get('/reports/monthly', { params }),
  getFunnel: (params?: any) => API.get('/reports/funnel', { params }),
  getSalesperson: (params?: any) => API.get('/reports/salesperson', { params }),
  getSku: (params?: any) => API.get('/reports/sku', { params }),
};

export const employeesApi = {
  getAll: (params?: { salesperson_phone?: string }) =>
    API.get('/employees', { params }),
  getNextId: () => API.get('/employees/next-id'),
  create: (data: any) => API.post('/employees', data),
  update: (id: string, data: any) => API.patch(`/employees/${id}`, data),
  deactivate: (id: string) => API.patch(`/employees/${id}/deactivate`),
};

export const chatbotApi = {
  sendMessage: (data: { message: string; sessionId?: string }) =>
    API.post('/chat/message', data),
  getSessions: () => API.get('/chat/sessions'),
  getSessionMessages: (sessionId: string) =>
    API.get(`/chat/sessions/${sessionId}/messages`),
};

export const kbApi = {
  listDocuments: () => API.get('/chat/kb/documents'),
  uploadDocument: (data: {
    title: string;
    content: string;
    visibilityRole: string;
    sourceFileUrl?: string;
  }) => API.post('/chat/kb/upload', data),
  deleteDocument: (id: string) => API.delete(`/chat/kb/documents/${id}`),
};

export const activityLogsApi = {
  getAll: (params?: {
    from?: string;
    to?: string;
    module?: string;
    search?: string;
    salesperson_phone?: string;
    mode?: string;
    limit?: number;
  }) => API.get('/activity-logs', { params }),
};

export default API;
