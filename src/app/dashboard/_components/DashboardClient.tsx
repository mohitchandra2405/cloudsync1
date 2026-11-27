'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Clock3,
  FilePlus2,
  FileText,
  LogOut,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
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
  const [documents, setDocuments] = useState(initialDocs)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [actionMessage, setActionMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const displayName = user.full_name?.trim() || user.email?.split('@')[0] || 'there'
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return documents
    return documents.filter((doc) =>
      `${doc.title} ${doc.content_text ?? ''}`.toLowerCase().includes(term)
    )
  }, [documents, search])

  async function handleCreateDocument() {
    if (creating) return
    setCreating(true)
    setActionMessage(null)

    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({ owner_id: user.id, title: 'Untitled Document' })
        .select('id, title, content_text, created_at, updated_at, owner_id')
        .single()

      if (error) {
        setActionMessage({
          type: 'error',
          text: `Couldn’t create your document. ${error.message}`,
        })
        return
      }

      const newDocument: DocumentMeta = {
        id: data.id,
        title: data.title,
        content_text: data.content_text,
        created_at: data.created_at,
        updated_at: data.updated_at,
        owner_id: data.owner_id,
      }
      setDocuments((current) => [newDocument, ...current.filter((doc) => doc.id !== newDocument.id)])
      setSearch('')
      setActionMessage({ type: 'success', text: 'Document created. Open it below to start writing.' })
    } catch (error) {
      setActionMessage({
        type: 'error',
        text: error instanceof Error ? `Couldn’t create your document. ${error.message}` : 'Couldn’t create your document. Check your connection and try again.',
      })
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteDocument(id: string) {
    setDeletingId(id)
    setActionMessage(null)

    try {
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) {
        setActionMessage({ type: 'error', text: `Couldn’t delete this document. ${error.message}` })
      } else {
        setDocuments((current) => current.filter((doc) => doc.id !== id))
        setActionMessage({ type: 'success', text: 'Document deleted.' })
      }
    } catch (error) {
      setActionMessage({
        type: 'error',
        text: error instanceof Error ? `Couldn’t delete this document. ${error.message}` : 'Couldn’t delete this document. Check your connection and try again.',
      })
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-3" aria-label="CloudSync home">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200/60">
              <FileText className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <span className="block text-[15px] font-bold tracking-tight">CloudSync</span>
              <span className="hidden text-[11px] font-medium text-slate-500 sm:block">Your writing workspace</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-3 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
                {initials || 'U'}
              </div>
              <div className="max-w-40">
                <p className="truncate text-sm font-semibold text-slate-800">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-11">
        <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-6 py-8 text-white shadow-xl shadow-indigo-950/10 sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full border-[48px] border-white/[0.06]" />
          <div className="pointer-events-none absolute right-36 top-20 -z-10 h-40 w-40 rounded-full bg-violet-400/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-indigo-100">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                A little space for big ideas
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Good to see you, {displayName}.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100/75 sm:text-base">
                Pick up where you left off or start something new. Your documents are ready whenever inspiration strikes.
              </p>
            </div>
            <button
              onClick={handleCreateDocument}
              disabled={creating}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-950 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-70"
            >
              {creating ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-900" />
              ) : (
                <FilePlus2 className="h-4 w-4" />
              )}
              {creating ? 'Creating document…' : 'New document'}
            </button>
          </div>
          <div className="mt-8 flex items-center gap-2 border-t border-white/10 pt-5 text-xs font-medium text-indigo-100/80">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
              <Check className="h-3.5 w-3.5" />
            </span>
            {documents.length} {documents.length === 1 ? 'document' : 'documents'} in your workspace
          </div>
        </section>

        {actionMessage && (
          <div
            role={actionMessage.type === 'error' ? 'alert' : 'status'}
            className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
              actionMessage.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {actionMessage.type === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}
            <p className="min-w-0 flex-1">{actionMessage.text}</p>
            <button onClick={() => setActionMessage(null)} className="rounded-md p-0.5 opacity-70 transition hover:opacity-100" aria-label="Dismiss message">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="mt-10 sm:mt-12">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Your library</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Recent documents</h2>
              <p className="mt-1 text-sm text-slate-500">Everything you’ve been working on, all in one place.</p>
            </div>

            {documents.length > 0 && (
              <label className="relative block w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search documents"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
            )}
          </div>

          {filteredDocuments.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDocuments.map((doc, index) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  index={index}
                  isDeleting={deletingId === doc.id}
                  isConfirmingDelete={confirmDeleteId === doc.id}
                  onRequestDelete={() => setConfirmDeleteId(doc.id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onDelete={() => void handleDeleteDocument(doc.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center sm:py-16">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                {search ? <Search className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">
                {search ? 'No documents found' : 'Your first idea starts here'}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {search
                  ? 'Try another title or phrase to find the document you’re looking for.'
                  : 'Create a document to capture a thought, plan a project, or work together with your team.'}
              </p>
              {!search && (
                <button
                  onClick={handleCreateDocument}
                  disabled={creating}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:opacity-70"
                >
                  <FilePlus2 className="h-4 w-4" />
                  {creating ? 'Creating…' : 'Create your first document'}
                </button>
              )}
            </div>
          )}
        </section>

        <footer className="mt-12 flex items-center justify-center gap-2 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Your workspace is up to date
        </footer>
      </main>
    </div>
  )
}

const iconStyles = [
  'bg-indigo-50 text-indigo-600 ring-indigo-100',
  'bg-sky-50 text-sky-600 ring-sky-100',
  'bg-violet-50 text-violet-600 ring-violet-100',
]

function DocumentCard({
  doc,
  index,
  isDeleting,
  isConfirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: {
  doc: DocumentMeta
  index: number
  isDeleting: boolean
  isConfirmingDelete: boolean
  onRequestDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  return (
    <article className={`group relative flex min-h-[218px] flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-950/[0.06] ${isDeleting ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-[14px] ring-1 ${iconStyles[index % iconStyles.length]}`}>
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Document</span>
          <button
            onClick={onRequestDelete}
            className="ml-1 rounded-lg p-2 text-slate-400 opacity-100 transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            title="Delete document"
            aria-label={`Delete ${doc.title}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Link href={`/doc/${doc.id}`} className="mt-4 block flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
        <h3 className="truncate text-base font-semibold text-slate-900 transition group-hover:text-indigo-700">{doc.title}</h3>
        <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">
          {doc.content_text?.trim()
            ? `${doc.content_text.trim().slice(0, 105)}${doc.content_text.trim().length > 105 ? '…' : ''}`
            : 'An empty page, ready for your next idea.'}
        </p>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Clock3 className="h-3.5 w-3.5" />
            Edited {formatRelativeDate(doc.updated_at)}
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition group-hover:bg-indigo-50 group-hover:text-indigo-600">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </Link>

      {isConfirmingDelete && (
        <div className="absolute inset-0 z-10 flex flex-col justify-center rounded-2xl bg-white/95 p-5 text-center backdrop-blur-sm">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Trash2 className="h-4 w-4" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900">Delete this document?</p>
          <p className="mt-1 truncate text-xs text-slate-500">{doc.title}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={onCancelDelete} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50">Cancel</button>
            <button onClick={onDelete} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700">Delete</button>
          </div>
        </div>
      )}
    </article>
  )
}
