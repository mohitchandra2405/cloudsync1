import * as Y from 'yjs'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { decodeYjsState, uint8ArrayToHex } from './encoding'

/**
 * Loads the persisted Yjs binary snapshot from PostgreSQL and applies it
 * to `doc` with origin `'persistence'`.
 */
export async function loadDocumentState(
  doc: Y.Doc,
  documentId: string
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient()

  const { data, error } = await supabase
    .from('documents')
    .select('yjs_state')
    .eq('id', documentId)
    .single()

  if (error) {
    console.error('[yjs/persistence] Failed to load document state:', error.message)
    return false
  }

  if (data?.yjs_state) {
    try {
      const bytes = decodeYjsState(data.yjs_state)
      if (bytes.byteLength > 0) {
        Y.applyUpdate(doc, bytes, 'persistence')
      }
    } catch (err) {
      console.error('[yjs/persistence] Failed to apply stored Yjs state:', err)
      return false
    }
  }

  return true
}

/**
 * Encodes the full Yjs document state as PostgreSQL `bytea` (`\x...` hex)
 * and persists it alongside a plain-text preview for search.
 */
export async function saveDocumentState(
  doc: Y.Doc,
  documentId: string,
  contentText?: string
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient()
  const state = Y.encodeStateAsUpdate(doc)
  const hexState = uint8ArrayToHex(state)

  const updatePayload: {
    yjs_state: string
    content_text?: string
    updated_at: string
  } = {
    yjs_state: hexState,
    updated_at: new Date().toISOString(),
  }

  if (typeof contentText === 'string') {
    updatePayload.content_text = contentText.slice(0, 5000)
  }

  const { error } = await supabase
    .from('documents')
    .update(updatePayload)
    .eq('id', documentId)

  if (error) {
    console.error('[yjs/persistence] Failed to save document state:', error.message)
    return false
  }

  return true
}
