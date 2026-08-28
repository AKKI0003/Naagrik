/**
 * API client for communicating with the backend.
 * Handles authentication tokens and provides typed methods for all endpoints.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('nagrik.auth.token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error ?? `HTTP ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  isModerator: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ReportInput {
  lat: number;
  lng: number;
  category: string;
  photoUrl?: string | null;
  photoObjectKey?: string | null;
  modelConfidence?: number;
  userConfirmed?: boolean;
}

export interface NearbyReportsParams {
  lat: number;
  lng: number;
  radius?: number;
}

export interface FlagResponse {
  error?: string;
}

export interface AccountStats {
  reportsSubmitted: number;
  upvotesReceived: number;
  flagsReceived: number;
  reportsRemoved: number;
  reportsPendingReview: number;
  reportsFlaggedByMe: number;
  flaggedReports: (import('../types/report').ReportModel & { flaggedAt: number })[];
}

export const api = {
  // Auth
  async register(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    return handleResponse(res);
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async logout(): Promise<void> {
    const res = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async me(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getMyStats(): Promise<AccountStats> {
    const res = await fetch(`${API_BASE}/api/users/me/stats`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  // Reports
  async getReports(params?: { status?: string; reporterId?: string }): Promise<any[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.reporterId) searchParams.set('reporterId', params.reporterId);
    const res = await fetch(`${API_BASE}/api/reports?${searchParams.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async getNearbyReports(params: NearbyReportsParams): Promise<any[]> {
    const searchParams = new URLSearchParams({
      lat: params.lat.toString(),
      lng: params.lng.toString(),
      radius: (params.radius ?? 30).toString(),
    });
    const res = await fetch(`${API_BASE}/api/reports/nearby?${searchParams.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async createReport(report: ReportInput): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(report),
    });
    return handleResponse(res);
  },

  async confirmReport(reportId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/confirm`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async flagReport(reportId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/flag`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async deleteReport(reportId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async moderateReport(reportId: string, action: 'remove' | 'restore'): Promise<void> {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ action }),
    });
    return handleResponse(res);
  },

  async resolveReport(reportId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/resolve`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res);
  },

  async updateReportCategory(reportId: string, category: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/category`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ category }),
    });
    return handleResponse(res);
  },
};

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem('nagrik.auth.token', token);
  else localStorage.removeItem('nagrik.auth.token');
}

export function getAuthToken(): string | null {
  return localStorage.getItem('nagrik.auth.token');
}

export function clearAuth() {
  localStorage.removeItem('nagrik.auth.token');
}