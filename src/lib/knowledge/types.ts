// lib/knowledge/types.ts
export interface QRPair {
  id: string
  question: string
  response: string
  context?: string
  tags: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  category?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface QRFile {
  id: string
  name: string
  description?: string
  domainId?: string
  pairs: QRPair[]
  totalPairs: number
  createdAt: string
  updatedAt: string
  url?: string // Vercel Blob URL
  size?: number
  isPublic: boolean
}

export interface QRCreationRequest {
  name: string
  description?: string
  pairs: Omit<QRPair, 'id' | 'createdAt' | 'updatedAt'>[]
  domainId?: string
  isPublic?: boolean
}

export interface QRImportRequest {
  name: string
  description?: string
  content: string // CSV, JSON, etc.
  format: 'json' | 'csv' | 'markdown'
  domainId?: string
}