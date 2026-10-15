import axios from 'axios';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export function getBackendUrl(): string {
  let url = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL;
  if (!url) {
    if (isLocal) return 'http://localhost:3000';
    throw new Error(
      'Missing VITE_BACKEND_URL. Configure the frontend build for its deployment environment.',
    );
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}

export const BACKEND_URL = getBackendUrl();

export function getBotUrl(): string {
  let url = import.meta.env.VITE_BOT_URL;
  if (url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url.replace(/\/+$/, '');
  }
  return BACKEND_URL;
}

export const BOT_URL = getBotUrl();

const API = axios.create({
  baseURL: BACKEND_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

function unwrapApiResponse<T>(response: { data?: any }): { data: T } {
  const envelope = response?.data;
  return {
    data:
      envelope &&
      typeof envelope === 'object' &&
      Object.prototype.hasOwnProperty.call(envelope, 'data')
        ? envelope.data
        : envelope,
  };
}

// Attach JWT token and salesperson filter to every request
API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('enlight_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Never attach impersonation scoping parameters to employee directory / admin management endpoints
  const url = config.url || '';
  const isEmployeeDirectory = url.startsWith('/employees') || url.includes('/employees');

  // Add salesperson_phone filter if admin is viewing a specific salesperson
  const viewingAs = sessionStorage.getItem('enlight_viewing_as');
  if (viewingAs && !isEmployeeDirectory) {
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
    const requestUrl = String(error.config?.url || '');
    const isOtpAuthRequest = /\/auth\/(?:request-otp|verify-otp)(?:$|[/?])/.test(
      requestUrl,
    );

    if (error.response?.status === 401 && !isOtpAuthRequest) {
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
  allocatePo: (params?: { reservation_token?: string; deal_id?: string }) =>
    API.get('/deals/po/allocate', { params }).then((response) =>
      unwrapApiResponse<any>(response),
    ),
  checkPoAvailability: (params: { po_number: string; reservation_token?: string; deal_id?: string }) =>
    API.get('/deals/po/availability', { params }),
  releasePoReservation: (data: { reservation_token: string; po_number?: string; deal_id?: string }) =>
    API.post('/deals/po/release', data),
  updateStage: (
    id: string,
    stage: string,
    lost_reason?: string,
    po_number?: string,
    po_date?: string,
    reference_po_number?: string,
    generated_po_number?: string,
    po_reservation_token?: string,
  ) =>
    API.patch(`/deals/${id}/stage`, {
      stage,
      lost_reason,
      po_number,
      po_date,
      reference_po_number,
      generated_po_number,
      po_reservation_token,
    }),
  processPo: (data: any) => API.post('/deals/process-po', data),
  delete: (id: string) => API.delete(`/deals/${id}`),
};

export function logPoAllocationError(
  context: string,
  error: unknown,
  reservationToken?: string,
  dealId?: string,
) {
  const apiError = error as any;
  const token = String(reservationToken || '');
  console.error(`[SystemPO] ${context} allocation failed`, {
    reservationToken: token
      ? `${token.slice(0, 24)}${token.length > 24 ? '…' : ''}`
      : null,
    dealId: dealId || null,
    message: apiError?.message || null,
    status: apiError?.response?.status || null,
    responseData: apiError?.response?.data || null,
    requestUrl: apiError?.config?.url || null,
    requestMethod: apiError?.config?.method || null,
  });
}

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
  getAttachments: (id: string) => API.get(`/kra/complaints/${id}/attachments`),
  create: (data: any) => API.post('/kra/complaints', data),
  update: (id: string, data: any) => API.patch(`/kra/complaints/${id}`, data),
  updateStatus: (id: string, status: string, resolution_notes?: string) =>
    API.patch(`/kra/complaints/${id}`, { status, resolution_notes }),
};

export const visitsApi = {
  getAll: (params?: any) => API.get('/kra/visits', { params }),
  create: (data: any) => API.post('/kra/visits', data),
  update: (id: string, data: any) => API.patch(`/kra/visits/${id}`, data),
  updateFollowUpStatus: (id: string, follow_up_status: 'pending' | 'completed') =>
    API.patch(`/kra/visits/${id}`, { follow_up_status }),
  delete: (id: string) => API.delete(`/kra/visits/${id}`),
};

export const ordersApi = {
  getAll: (params?: any) => API.get('/deals', { params: { ...params, stage: 'won' } }),
  getOne: (id: string) => API.get(`/deals/${id}`),
  create: (data: any) => API.post('/deals/order', data),
  processPo: (data: any) => API.post('/deals/process-po', data),
  allocatePo: (params?: { reservation_token?: string; deal_id?: string }) =>
    API.get('/deals/po/allocate', { params }).then((response) =>
      unwrapApiResponse<any>(response),
    ),
  checkPoAvailability: (params: { po_number: string; reservation_token?: string; deal_id?: string }) =>
    API.get('/deals/po/availability', { params }),
  releasePoReservation: (data: { reservation_token: string; po_number?: string; deal_id?: string }) =>
    API.post('/deals/po/release', data),
  delete: (id: string) => API.delete(`/deals/${id}`),
};

export const inquiriesApi = {
  getAll: (params?: any) => API.get('/inquiries', { params }),
  getOne: (id: string) => API.get(`/inquiries/${id}`),
  getReviewQueue: (params?: any) => API.get('/inquiries/review-queue', { params }),
  getStats: (params?: any) => API.get('/inquiries/stats', { params }),
  create: (data: any) => API.post('/inquiries', data),
  updateStatus: (id: string, status: string, details?: any) => API.patch(`/inquiries/${id}/status`, { status, details }),
  previewQuotation: (id: string, payload: any) => API.post(`/inquiries/quotation-preview/${id}`, payload),
  sendQuotation: (id: string, payload: any) => API.post(`/inquiries/send-quotation/${id}`, payload),
  generatePdf: (payload: any) => API.post('/inquiries/generate-pdf', payload, { responseType: 'blob' }),
  parseDocument: (payload: any) =>
    API.post('/inquiries/parse-document', payload, { timeout: 150000 }),
  parseText: (payload: { text: string }) => API.post('/inquiries/parse-text', payload),
  delete: (id: string) => API.delete(`/inquiries/${id}`),
  assignProcurement: (id: string, procurement_employee_id: string | null) =>
    API.patch(`/inquiries/${id}/procurement-assignee`, { procurement_employee_id }),
  getLinePricing: (id: string) => API.get(`/inquiries/${id}/line-pricing`),
  saveProcurementPricing: (id: string, payload: any) =>
    API.patch(`/inquiries/${id}/procurement-pricing`, payload),
  saveSalesPricing: (id: string, payload: any) =>
    API.patch(`/inquiries/${id}/sales-pricing`, payload),
  previewDecline: (id: string) => API.post(`/inquiries/${id}/decline-preview`),
  sendDecline: (id: string) => API.post(`/inquiries/${id}/decline-email`),
};

export const productsApi = {
  getAll: (params?: any) => API.get('/products', { params }),
  lookup: (name: string, dimensions?: string) => API.get('/products/lookup', { params: { name, dimensions } }),
  create: (data: { product_name: string; dimensions?: string; hsn_code?: string; category?: string }) =>
    API.post('/products', data),
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
  delete: (id: string) => API.delete(`/employees/${id}`),
};

export const chatbotApi = {
  sendMessage: (data: {
    message: string;
    sessionId?: string;
    image?: { base64: string; mimeType: string };
    gps?: { latitude: number; longitude: number; accuracy?: number };
  }) => API.post('/chat/message', data, { timeout: 120000 }),
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
  extractText: (data: { fileBase64: string; fileName?: string }) =>
    API.post('/chat/kb/extract-text', data),
  deleteDocument: (id: string) => API.delete(`/chat/kb/documents/${id}`),
};

export const zohoApi = {
  pullInitialSync: () => API.post('/zoho/pull-initial-sync'),
  sync: () => API.post('/zoho/sync'),
  getStatus: () => API.get('/zoho/status'),
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

export const authApi = {
  requestOtp: (phone: string) =>
    API.post('/auth/request-otp', {
      phone: `91${phone.replace(/\D/g, '').slice(-10)}`,
    }),
  verifyOtp: (phone: string, otp: string) =>
    API.post('/auth/verify-otp', {
      phone: `91${phone.replace(/\D/g, '').slice(-10)}`,
      otp,
    }),
};

export default API;
