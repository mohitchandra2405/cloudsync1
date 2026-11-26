// ============================================================
// Supabase Database Types (auto-synced from schema)
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          owner_id: string
          title: string
          yjs_state: string | null
          content_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title?: string
          yjs_state?: string | null
          content_text?: string | null
        }
        Update: {
          title?: string
          yjs_state?: string | null
          content_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_collaborators: {
        Row: {
          id: string
          document_id: string
          user_id: string
          role: 'viewer' | 'editor' | 'owner'
          created_at: string
        }
        Insert: {
          document_id: string
          user_id: string
          role?: 'viewer' | 'editor' | 'owner'
        }
        Update: {
          role?: 'viewer' | 'editor' | 'owner'
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Document = Database['public']['Tables']['documents']['Row']
export type DocumentCollaborator = Database['public']['Tables']['document_collaborators']['Row']
