
/**
 * @fileOverview Client API centralisé pour VisioNode.
 * Gère les appels vers les API Routes Next.js avec audit iconographié et mode dégradé.
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
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * Envoie une requête POST vers un endpoint API.
   * Intègre l'audit iconographié (🚀, 📡, ✅).
   */
  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`🚀 [${timestamp}] [API_CLIENT] Transmission vers ${endpoint}...`);

    try {
      const result = await executeHybridRequest<any, any>(
        endpoint,
        data,
        async () => {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            throw new Error(`HTTP_ERROR_${response.status}`);
          }

          return await response.json();
        }
      );

      console.log(`✅ [${timestamp}] [API_CLIENT] Réponse reçue de ${endpoint}.`);
      
      return {
        ...result,
        timestamp,
      };
    } catch (error: any) {
      console.error(`❌ [${timestamp}] [API_CLIENT] Échec de liaison :`, error.message);
      
      // Mode dégradé (Fallback industriel)
      return {
        error: "LIAISON_INTERROMPUE : Le centre de commande est injoignable.",
        offline: true,
        timestamp,
      } as unknown as ApiResponse<T>;
    }
  }
}

export const apiClient = ApiClient.getInstance();
