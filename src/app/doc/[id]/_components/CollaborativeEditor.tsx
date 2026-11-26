'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Highlight from '@tiptap/extension-highlight'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import { ArrowLeft, Check, Cloud, CloudOff, Loader2, Wifi, WifiOff } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { colorFromUserId, debounce } from '@/lib/utils'
import { SupabaseYjsProvider, type ConnectionStatus } from '@/lib/yjs/supabase-provider'
import { loadDocumentState, saveDocumentState } from '@/lib/yjs/persistence'
import type { CollaboratorPresence } from '@/types'
import EditorToolbar from './EditorToolbar'
import PresenceBar from './PresenceBar'

interface CollaborativeEditorProps {
  documentId: string
  initialTitle: string
  readOnly?: boolean
  user: {
    id: string
    name: string
  }
}

interface EditorSurfaceProps {
  doc: Y.Doc
  provider: SupabaseYjsProvider
  userName: string
  userColor: string
  readOnly: boolean
  onTextChange: (plainText: string) => void
}

function EditorSurface({
  doc,
  provider,
  userName,
  userColor,
  readOnly,
  onTextChange,
}: EditorSurfaceProps) {
  const editor = useEditor(
    {
      editable: !readOnly,
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          history: false, // Yjs handles collaborative undo/redo
        }),
        Collaboration.configure({
          document: doc,
        }),
        CollaborationCursor.configure({
          provider,
          user: {
            name: userName,
            color: userColor,
          },
        }),
        Highlight.configure({ multicolor: true }),
        LinkExtension.configure({ openOnClick: false }),
        Placeholder.configure({
          placeholder: 'Start writing your collaborative document…',
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Typography,
        Underline,
      ],
      onUpdate: ({ editor: ed }) => {
        onTextChange(ed.getText())
      },
    },
    [doc, provider, readOnly]
  )

  return (
    <>
      <EditorToolbar editor={editor} readOnly={readOnly} />
      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-xl border border-border bg-card p-8 shadow-sm sm:p-12">
          <EditorContent editor={editor} />
        </div>
      </main>
    </>
  )
}

export default function CollaborativeEditor({
  documentId,
  initialTitle,
  readOnly = false,
  user,
}: CollaborativeEditorProps) {
  const supabase = createSupabaseBrowserClient()
  const [title, setTitle] = useState(initialTitle)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [presenceUsers, setPresenceUsers] = useState<CollaboratorPresence[]>([])
  const [provider, setProvider] = useState<SupabaseYjsProvider | null>(null)
  const [ready, setReady] = useState(false)

  const latestTextRef = useRef<string>('')
  const userColor = useMemo(() => colorFromUserId(user.id), [user.id])

  // Debounced auto-save to Supabase PostgreSQL
  const debouncedSave = useMemo(
    () =>
      debounce(async (doc: Y.Doc) => {
        if (readOnly) return
        setSaveState('saving')
        const ok = await saveDocumentState(doc, documentId, latestTextRef.current)
        setSaveState(ok ? 'saved' : 'error')
      }, 1500),
    [documentId, readOnly]
  )

  useEffect(() => {
    let active = true
    const doc = new Y.Doc()

    // Local-first IndexedDB cache for instant reloads & offline resilience
    const indexeddb = new IndexeddbPersistence(`cloudsync:${documentId}`, doc)

    const yjsProvider = new SupabaseYjsProvider({
      documentId,
      doc,
      user: {
        id: user.id,
        name: user.name,
        color: userColor,
      },
      onStatusChange: (nextStatus) => {
        if (active) setStatus(nextStatus)
      },
      onPresenceChange: (users) => {
        if (active) setPresenceUsers(users)
      },
    })

    const handleDocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote' && origin !== 'persistence') {
        debouncedSave(doc)
      }
    }

    doc.on('update', handleDocUpdate)

    // Hydrate from PostgreSQL before mounting TipTap
    loadDocumentState(doc, documentId).finally(() => {
      if (active) {
        setProvider(yjsProvider)
        setReady(true)
      }
    })

    return () => {
      active = false
      doc.off('update', handleDocUpdate)
      if (!readOnly) {
        void saveDocumentState(doc, documentId, latestTextRef.current)
      }
      yjsProvider.destroy()
      void indexeddb.destroy()
      doc.destroy()
    }
  }, [documentId, user.id, user.name, userColor, readOnly, debouncedSave])

  async function handleTitleBlur() {
    if (readOnly) return
    const trimmed = title.trim() || 'Untitled Document'
    setTitle(trimmed)
    await supabase
      .from('documents')
      .update({ title: trimmed })
      .eq('id', documentId)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <input
            type="text"
            value={title}
            disabled={readOnly}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            className="min-w-0 truncate rounded-md bg-transparent px-2 py-1 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-80"
            aria-label="Document title"
          />
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveState === 'saving' && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving…</span>
              </>
            )}
            {saveState === 'saved' && (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Saved</span>
              </>
            )}
            {saveState === 'error' && (
              <>
                <CloudOff className="h-3.5 w-3.5 text-destructive" />
                <span className="text-destructive">Save failed</span>
              </>
            )}
            {saveState === 'idle' && (
              <>
                <Cloud className="h-3.5 w-3.5" />
                <span>Ready</span>
              </>
            )}
          </div>

          <div
            className="flex items-center"
            title={
              status === 'connected'
                ? 'Connected to real-time sync'
                : status === 'connecting'
                ? 'Connecting…'
                : 'Disconnected'
            }
          >
            {status === 'connected' && <Wifi className="h-4 w-4 text-emerald-500" />}
            {status === 'connecting' && (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            )}
            {status === 'disconnected' && (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
          </div>

          <PresenceBar users={presenceUsers} />
        </div>
      </header>

      {ready && provider ? (
        <EditorSurface
          doc={provider.doc}
          provider={provider}
          userName={user.name}
          userColor={userColor}
          readOnly={readOnly}
          onTextChange={(text) => {
            latestTextRef.current = text
          }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
