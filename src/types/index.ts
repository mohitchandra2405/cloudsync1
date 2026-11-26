// ============================================================
// Shared application types
// ============================================================

export interface CollaboratorPresence {
  userId: string
  name: string
  color: string
  cursor?: { anchor: number; head: number }
}

export interface DocumentMeta {
  id: string
  title: string
  owner_id: string
  content_text: string | null
  created_at: string
  updated_at: string
}

export interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}
