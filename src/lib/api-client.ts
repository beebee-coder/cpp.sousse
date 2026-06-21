
/**
 * @fileOverview Client API centralisé pour VisioNode.
 * Supporte les appels hybrides avec audit iconographié.
 */

import { executeHybridRequest } from './api-hybrid';

export type ApiResponse<T> = T & {
  error?: string;
  offline?: boolean;
  provider?: string;
  timestamp?: string;
};

class ApiClient {
  private static instance: ApiClient;
  private constructor() {}

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) ApiClient.instance = new ApiClient();
    return ApiClient.instance;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const timestamp = new Date().toLocaleTimeString();
    try {
      const result = await executeHybridRequest<any, any>(endpoint, null, async () => {
        const response = await fetch(endpoint, { method: 'GET' });
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        return await response.json();
      });
      return { ...result, timestamp };
    } catch (error: any) {
      return { error: error.message, offline: true, timestamp } as any;
    }
  }

  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    const timestamp = new Date().toLocaleTimeString();
    try {
      const result = await executeHybridRequest<any, any>(endpoint, data, async () => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        return await response.json();
      });
      return { ...result, timestamp };
    } catch (error: any) {
      return { error: error.message, offline: true, timestamp } as any;
    }
  }
}

export const apiClient = ApiClient.getInstance();
