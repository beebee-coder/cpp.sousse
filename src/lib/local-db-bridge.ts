import { isDesktop } from './platform';
import { apiClient } from './api-client';

export interface FSNode {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'collection';
  size?: number;
  timestamp?: number;
  children?: FSNode[];
  isOpen?: boolean;
  metadata?: {
    knowledgeType?: string;
    cloudId?: string;
    indexed?: boolean;
  };
}

export interface InjectMetadata {
  knowledge_type?: string;
  cloud_id?: string;
  tags?: string[];
}

export interface InjectResult {
  success: boolean;
  path: string;
  is_duplicate: boolean;
}

function normalizeTree(raw: any[]): FSNode[] {
  return raw.map(n => ({
    id: n.id,
    name: n.name,
    type: (n.node_type === 'folder' ? 'folder' : n.node_type === 'collection' ? 'collection' : 'file') as FSNode['type'],
    size: n.size,
    timestamp: n.timestamp,
    children: n.children ? normalizeTree(n.children) : undefined,
    isOpen: n.is_open ?? false,
    metadata: n.metadata ? {
      knowledgeType: n.metadata.knowledge_type,
      cloudId: n.metadata.cloud_id,
      indexed: n.metadata.indexed,
    } : undefined,
  }));
}

class LocalDBService {
  private readonly TAURI_INVOKE_TIMEOUT_MS = 30000;

  private async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    if (!isDesktop) {
      throw new Error('LocalDBService ne fonctionne qu en mode desktop Tauri');
    }
    const { invoke } = await import('@tauri-apps/api/core');
    // Toujours borner l'invocation : si le FS est bloqué, l'appel Tauri
    // resterait suspendu indéfiniment sans ce garde.
    return (await Promise.race([
      invoke<T>(command, args),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('TAURI_INVOKE_TIMEOUT')),
          this.TAURI_INVOKE_TIMEOUT_MS
        )
      ),
    ])) as T;
  }

  async getTree(): Promise<FSNode[]> {
    if (isDesktop) {
      const raw = await this.invoke<any[]>('local_db_tree');
      return normalizeTree(raw);
    }
    const res = await apiClient.get<any>('/api/local-db');
    if (res.success && Array.isArray(res.tree)) {
      return res.tree.map((n: any) => ({
        ...n,
        type: n.type || n.node_type,
        isOpen: n.isOpen ?? n.is_open,
        metadata: n.metadata ? {
          knowledgeType: n.metadata.knowledgeType ?? n.metadata.knowledge_type,
          cloudId: n.metadata.cloudId ?? n.metadata.cloud_id,
          indexed: n.metadata.indexed,
        } : undefined,
      }));
    }
    return [];
  }

  async getFile(relPath: string): Promise<string> {
    if (isDesktop) {
      return await this.invoke<string>('local_db_read', { rel_path: relPath });
    }
    const res = await apiClient.get<any>(`/api/local-db?path=${encodeURIComponent(relPath)}`);
    if (!res.success) throw new Error(res.error || 'FICHIER_INTROUVABLE');
    return res.content;
  }

  async writeFile(relPath: string, content: string): Promise<void> {
    if (isDesktop) {
      await this.invoke('local_db_write', { rel_path: relPath, content });
      return;
    }
    const res = await apiClient.put<any>('/api/local-db', { path: relPath, content });
    if (!res.success) throw new Error(res.error || 'ERREUR_ECRITURE');
  }

  async deleteItem(relPath: string): Promise<void> {
    if (isDesktop) {
      await this.invoke('local_db_delete', { rel_path: relPath });
      return;
    }
    const res = await apiClient.delete<any>(`/api/local-db?path=${encodeURIComponent(relPath)}`);
    if (!res.success) throw new Error(res.error || 'ELEMENT_INTROUVABLE');
  }

  async renameItem(oldPath: string, newName: string): Promise<void> {
    if (isDesktop) {
      await this.invoke('local_db_rename', { old_path: oldPath, new_name: newName });
      return;
    }
    const res = await apiClient.patch<any>('/api/local-db', { path: oldPath, newName });
    if (!res.success) throw new Error(res.error || 'ERREUR_RENAME');
  }

  async createFolder(relPath: string): Promise<void> {
    if (isDesktop) {
      await this.invoke('local_db_create_folder', { rel_path: relPath });
      return;
    }
    const res = await apiClient.post<any>('/api/local-db', { path: relPath, type: 'folder' });
    if (!res.success) throw new Error(res.error || 'ERREUR_CREATION');
  }

  async injectFile(fileName: string, content: string, metadata?: InjectMetadata, targetDir?: string): Promise<InjectResult> {
    if (isDesktop) {
      return await this.invoke<InjectResult>('local_db_inject', {
        file_name: fileName,
        content,
        metadata,
        target_dir: targetDir,
      });
    }
    const res = await apiClient.post<any>('/api/local-db', {
      fileName,
      content,
      metadata,
      targetDir,
    });
    if (!res.success) throw new Error(res.error || 'ERREUR_INJECTION');
    return { success: true, path: res.path, is_duplicate: res.isDuplicate };
  }
}

export const localDBBridge = new LocalDBService();
