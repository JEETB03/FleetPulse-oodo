const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('fleetpulse_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_URL}/api/v1${path}`;
    const headers = { ...this.getHeaders(), ...options.headers };
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      let errorMsg = `HTTP error! status: ${response.status}`;
      if (typeof errBody.detail === 'string') {
        errorMsg = errBody.detail;
      } else if (Array.isArray(errBody.detail)) {
        errorMsg = errBody.detail.map((e: { msg?: string }) => e.msg || '').filter(Boolean).join(', ') || errorMsg;
      }
      throw new Error(errorMsg);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
export { API_URL };
