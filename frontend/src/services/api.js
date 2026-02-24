import axios from 'axios';

// Create a configured axios instance pointing to the backend API
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
});

// Attach JWT token from localStorage to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Auth ---
export const loginUser = (data) => api.post('/api/auth/login', data);
export const registerUser = (data) => api.post('/api/auth/register', data);

// --- Admin ---
export const getUsers = () => api.get('/api/admin/users');
export const createDoctor = (data) => api.post('/api/admin/doctors', data);
export const approvePatient = (id) => api.patch(`/api/admin/users/${id}/approve`);
export const deactivateUser = (id) => api.patch(`/api/admin/users/${id}/deactivate`);
export const getAuditLogs = () => api.get('/api/admin/audit-logs');

// --- Doctor ---
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
