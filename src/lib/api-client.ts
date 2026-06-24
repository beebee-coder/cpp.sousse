
/**
 * @fileOverview Client API centralisé pour VisioNode.
 * Version : Audité pour la gestion fidèle des succès/échecs.
 */

import { executeHybridRequest } from './api-hybrid';

export type ApiResponse<T> = T & {
  error?: string;
  offline?: boolean;
  provider?: string;
  timestamp?: string;
  success?: boolean;
};

class ApiClient {
  private static instance: ApiClient;
  private constructor() {}

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) ApiClient.instance = new ApiClient();
    return ApiClient.instance;
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeout = 15000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  private async requestWithBody<T>(endpoint: string, method: string, data: any): Promise<ApiResponse<T>> {
    const timestamp = new Date().toLocaleTimeString();
    try {
      const result = await executeHybridRequest<any, any>(endpoint, data, async () => {
        const response = await this.fetchWithTimeout(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: data ? JSON.stringify(data) : undefined,
        });
        const json = await response.json();
        // Crucial : Ne pas forcer success:true si le serveur renvoie false
        if (!response.ok) return { success: false, error: json.error || `HTTP_${response.status}` };
        return json;
      });
      return { ...result, timestamp, success: result.success ?? true } as ApiResponse<T>;
    } catch (error: any) {
      return { error: error.message, offline: true, timestamp, success: false } as any;
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const timestamp = new Date().toLocaleTimeString();
    try {
      const result = await executeHybridRequest<any, any>(endpoint, null, async () => {
        const response = await this.fetchWithTimeout(endpoint, { method: 'GET' });
        const json = await response.json();
        if (!response.ok) return { success: false, error: json.error };
        return json;
      });
      return { ...result, timestamp, success: result.success ?? true } as ApiResponse<T>;
    } catch (error: any) {
      return { error: error.message, offline: true, timestamp, success: false } as any;
    }
  }

  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.requestWithBody<T>(endpoint, 'POST', data);
  }

  async put<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.requestWithBody<T>(endpoint, 'PUT', data);
  }

  async patch<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.requestWithBody<T>(endpoint, 'PATCH', data);
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const timestamp = new Date().toLocaleTimeString();
    try {
      const result = await executeHybridRequest<any, any>(endpoint, null, async () => {
        const response = await this.fetchWithTimeout(endpoint, { method: 'DELETE' });
        const json = await response.json();
        if (!response.ok) return { success: false, error: json.error || "ECHEC_SUPPRESSION" };
        return json;
      });
      // Si result.success est explicitement false, on le préserve
      return { ...result, timestamp, success: result.success === false ? false : (result.success ?? true) } as ApiResponse<T>;
    } catch (error: any) {
      return { error: error.message, offline: true, timestamp, success: false } as any;
    }
  }
}

export const apiClient = ApiClient.getInstance();
