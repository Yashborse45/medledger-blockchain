import axios from 'axios';

// Create a configured axios instance pointing to the backend API
// baseURL is empty so requests are relative to the dev server, which proxies
// them to the backend (see "proxy" in package.json). Set REACT_APP_API_URL
// to override (e.g. a deployed backend URL).
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
});

const clearPersistedAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('medledger:auth-cleared'));
};

// Attach JWT token from localStorage to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const method = (error.config?.method || 'request').toUpperCase();
    const url = error.config?.url || '(unknown)';
    const requestUrl = error.config?.url || '';
    const isPublicAuthRequest =
      requestUrl.includes('/api/auth/login') || requestUrl.includes('/api/auth/register');

    if (!error.response) {
      // Network-level failure — server unreachable, timeout, CORS preflight blocked, etc.
      console.error(
        `[MedLedger] Network error — ${method} ${url}`,
        `code: ${error.code || 'none'}`,
        error.message,
      );
    } else {
      // HTTP error response received from the server
      const responseBody = error.response.data;
      console.error(
        `[MedLedger] API error — ${method} ${url} → ${status}`,
        responseBody,
      );
    }

    if (!isPublicAuthRequest && status === 401 && localStorage.getItem('token')) {
      clearPersistedAuth();
    }

    return Promise.reject(error);
  }
);

// --- Auth ---
export const loginUser = (data) => api.post('/api/auth/login', data);
export const registerUser = (data) => api.post('/api/auth/register', data);

// --- Admin ---
export const getUsers = () => api.get('/api/admin/users');
export const createDoctor = (data) => api.post('/api/admin/doctors', data);
export const approvePatient = (id) => api.patch(`/api/admin/users/${id}/approve`);
export const deactivateUser = (id) => api.patch(`/api/admin/users/${id}/deactivate`);
export const getAuditLogs = () => api.get('/api/admin/audit-logs');
export const verifyAuditLog = (id) => api.get(`/api/admin/audit-logs/${id}/verify`);

// --- Doctor ---
export const searchPatients = (q) => api.get('/api/doctor/patients/search', { params: { q } });
export const getMyPatients = () => api.get('/api/doctor/patients');
export const requestAccess = (patientId) => api.post(`/api/doctor/access-requests/${patientId}`);
export const getAccessRequests = () => api.get('/api/doctor/access-requests');
export const getPatientRecords = (patientId) => api.get(`/api/doctor/patients/${patientId}/records`);

// --- Patient ---
export const getMyRecords = () => api.get('/api/patient/records');
export const createRecord = (data) => api.post('/api/patient/records', data);
export const getIncomingRequests = () => api.get('/api/patient/access-requests');
export const grantAccess = (reqId) => api.patch(`/api/patient/access-requests/${reqId}/grant`);
export const revokeAccess = (reqId) => api.patch(`/api/patient/access-requests/${reqId}/revoke`);

export default api;
