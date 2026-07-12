// src/lib/api-client.ts
/**
 * @fileOverview Client API centralisé pour VisioNode (Version hybride unifiée).
 *
 * RÈGLE UNIQUE pour les deux cibles (Vercel web + Tauri desktop) :
 *   - Web       : les routes sont servies par le même hôte (URL relative /api).
 *   - Desktop   : la webview Tauri n'a PAS d'API locale ; elle appelle l'API
 *                 cloud déployée sur Vercel via NEXT_PUBLIC_API_URL.
 *
 * Toute nouvelle feature doit passer par ce client (apiClient.get/post/...).
 * Ainsi le code est écrit UNE fois et fonctionne dans les deux builds.
 */

import { isDesktop } from './platform';
import { executeHybridRequest } from './api-hybrid';

export type ApiResponse<T> = T & {
  error?: string;
  message?: string;
  offline?: boolean;
  provider?: string;
  timestamp?: string;
  success?: boolean;
};

/**
 * Résout l'URL finale d'un endpoint API.
 *  - Desktop (Tauri) : on préfixe par NEXT_PUBLIC_API_URL (backend cloud).
 *  - Web             : on garde l'URL relative (/api/...).
 */
export function resolveApiUrl(endpoint: string): string {
  if (isDesktop) {
    const cloudBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    if (cloudBase) {
      const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      return `${cloudBase}${path}`;
    }
    // Fallback (ne devrait pas arriver) : appel relatif.
    console.warn('[API_CLIENT] NEXT_PUBLIC_API_URL manquant en mode desktop.');
  }
  return endpoint;
}

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
    const url = resolveApiUrl(endpoint);
    const timestamp = new Date().toLocaleTimeString();
    try {
      const result = await executeHybridRequest<any, any>(url, data, async () => {
        const response = await this.fetchWithTimeout(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: isDesktop ? 'include' : 'same-origin',
          body: data ? JSON.stringify(data) : undefined,
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) return { success: false, error: json.error || json.message || `HTTP_${response.status}` };
        return json;
      });
      return { ...result, timestamp, success: result.success ?? true } as ApiResponse<T>;
    } catch (error: any) {
      return { error: error.message, offline: true, timestamp, success: false } as any;
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const url = resolveApiUrl(endpoint);
    const timestamp = new Date().toLocaleTimeString();
    try {
      const result = await executeHybridRequest<any, any>(url, null, async () => {
        const response = await this.fetchWithTimeout(url, {
          method: 'GET',
          credentials: isDesktop ? 'include' : 'same-origin',
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) return { success: false, error: json.error || json.message };
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
    const url = resolveApiUrl(endpoint);
    const timestamp = new Date().toLocaleTimeString();
    try {
      const result = await executeHybridRequest<any, any>(url, null, async () => {
        const response = await this.fetchWithTimeout(url, {
          method: 'DELETE',
          credentials: isDesktop ? 'include' : 'same-origin',
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) return { success: false, error: json.error || json.message || 'ECHEC_SUPPRESSION' };
        return json;
      });
      return { ...result, timestamp, success: result.success !== false } as ApiResponse<T>;
    } catch (error: any) {
      return { error: error.message, offline: true, timestamp, success: false } as any;
    }
  }
}

export const apiClient = ApiClient.getInstance();
