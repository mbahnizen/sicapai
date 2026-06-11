/**
 * API Service — Backend communication layer
 * All API calls go through here with automatic JWT auth
 */

import { getAuth } from 'firebase/auth';

const API_BASE = '/api';

/**
 * Get current user's ID token, waiting for Firebase auth to be ready first.
 * authStateReady() resolves immediately if already initialized, preventing
 * the race condition where currentUser is null on the very first API call.
 */
async function getIdToken() {
  const auth = getAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sesi login sudah habis. Silakan login ulang.');
  }
  return user.getIdToken();
}

/**
 * Make authenticated API request
 * @param {string} endpoint - API endpoint (e.g., '/students')
 * @param {object} options - fetch options
 * @returns {Promise<any>}
 */
async function apiRequest(endpoint, options = {}) {
  const token = await getIdToken();

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Terjadi kesalahan server' }));
    throw new Error(error.message || `Error ${response.status}`);
  }

  if (response.status === 204) return null;

  return response.json();
}

export const api = {
  // ---- Institutions ----
  getInstitutions: () => apiRequest('/institutions'),
  getInstitutionDetails: (id) => apiRequest(`/institutions/${id}/details`),
  createInstitution: (data) => apiRequest('/institutions', { method: 'POST', body: data }),
  joinInstitution: (inviteCode) => apiRequest('/institutions/join', { method: 'POST', body: { inviteCode } }),
  updateInstitution: (id, data) => apiRequest(`/institutions/${id}`, { method: 'PUT', body: data }),
  leaveInstitution: (id) => apiRequest(`/institutions/${id}/leave`, { method: 'DELETE' }),
  deleteInstitution: (id) => apiRequest(`/institutions/${id}`, { method: 'DELETE' }),

  // ---- Students ----
  getStudents: (institutionId) => apiRequest(`/institutions/${institutionId}/students`),
  createStudent: (data) => apiRequest('/students', { method: 'POST', body: data }),
  createStudentsBatch: (institutionId, students) => apiRequest('/students/batch', { method: 'POST', body: { institutionId, students } }),
  updateStudent: (id, data) => apiRequest(`/students/${id}`, { method: 'PUT', body: data }),
  deleteStudent: (id) => apiRequest(`/students/${id}`, { method: 'DELETE' }),

  // ---- Reports ----
  saveReport: (data) => apiRequest('/reports', { method: 'POST', body: data }),
  getStudentReports: (studentId) => apiRequest(`/reports/${studentId}`),
  getInstitutionReports: (institutionId) => apiRequest(`/reports/institution/${institutionId}`),

  // ---- AI ----
  generateAI: (data) => apiRequest('/generate-ai', { method: 'POST', body: data }),

  // ---- Quota ----
  getQuota: () => apiRequest('/quota'),

  // ---- Progress ----
  loadProgress: (studentId) => apiRequest(`/progress/${studentId}`),
  saveProgress: (studentId, data) => apiRequest(`/progress/${studentId}`, { method: 'POST', body: data }),
  resetProgress: (studentId) => apiRequest(`/progress/${studentId}`, { method: 'DELETE' }),
};
