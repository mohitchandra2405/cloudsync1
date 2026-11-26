'use client'

import { useState, useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatRelativeDate } from '@/lib/utils'
import type { DocumentMeta } from '@/types'

interface Props {
  documents: DocumentMeta[]
  user: { id: string; full_name?: string | null; email?: string; avatar_url?: string | null }
}

export default function DashboardClient({ documents: initialDocs, user }: Props) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [isPending, startTransition] = useTransition()
  const [optimisticDocs, dispatchDocs] = useOptimistic(
    initialDocs,
    (state: DocumentMeta[], action: { type: 'add'; doc: DocumentMeta } | { type: 'delete'; id: string }) => {
      if (action.type === 'add') return [action.doc, ...state]
      if (action.type === 'delete') return state.filter((d) => d.id !== action.id)
      return state
    }
  )
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function handleCreateDocument() {
    setCreating(true)
    const { data, error } = await supabase
      .from('documents')
      .insert({ owner_id: user.id, title: 'Untitled Document' })
      .select()
      .single()
    setCreating(false)
    if (!error && data) {
      router.push(`/doc/${data.id}`)
    }
  }

  async function handleDeleteDocument(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      dispatchDocs({ type: 'delete', id })
      await supabase.from('documents').delete().eq('id', id)
      setDeletingId(null)
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const filtered = optimisticDocs.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
              </svg>
            </div>
            <span className="font-bold text-lg">CloudSync</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground hidden sm:block">
              {user.full_name || user.email}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Title + Create button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">My Documents</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {optimisticDocs.length} document{optimisticDocs.length !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={handleCreateDocument}
            disabled={creating}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            {creating ? 'Creating…' : 'New Document'}
          </button>
        </div>

        {/* Search bar */}
        {optimisticDocs.length > 0 && (
          <div className="relative mb-6">
            <svg viewBox="0 0 24 24" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="w-full border border-input rounded-lg pl-10 pr-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {/* Document grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-muted-foreground">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {search ? 'No documents match your search' : 'No documents yet'}
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              {search ? 'Try a different search term' : 'Create your first document to get started'}
            </p>
            {!search && (
              <button
                onClick={handleCreateDocument}
                disabled={creating}
                className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Create Document
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                isDeleting={deletingId === doc.id}
                onDelete={() => handleDeleteDocument(doc.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function DocumentCard({
  doc,
  isDeleting,
  onDelete,
}: {
  doc: DocumentMeta
  isDeleting: boolean
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      className={`group relative bg-card border border-border rounded-xl p-5 hover:shadow-md transition-all ${
        isDeleting ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <Link href={`/doc/${doc.id}`} className="block">
        {/* Doc icon */}
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-primary">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
          </svg>
        </div>

        <h3 className="font-semibold text-sm truncate mb-1">{doc.title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2.5rem]">
          {doc.content_text?.slice(0, 120) || 'Empty document'}
        </p>
        <span className="text-xs text-muted-foreground">
          {formatRelativeDate(doc.updated_at)}
        </span>
      </Link>

      {/* Delete button */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.preventDefault(); onDelete() }}
              className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded-md hover:bg-destructive/90"
            >
              Delete
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setConfirmDelete(false) }}
              className="text-xs bg-muted px-2 py-1 rounded-md hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.preventDefault(); setConfirmDelete(true) }}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete document"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
