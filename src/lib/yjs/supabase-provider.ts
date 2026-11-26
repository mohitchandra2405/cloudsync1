'use client'

import * as Y from 'yjs'
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { base64ToUint8Array, uint8ArrayToBase64 } from './encoding'
import type { CollaboratorPresence } from '@/types'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface SupabaseYjsProviderConfig {
  documentId: string
  doc: Y.Doc
  user: {
    id: string
    name: string
    color: string
  }
  onStatusChange?: (status: ConnectionStatus) => void
  onSynced?: (synced: boolean) => void
  onPresenceChange?: (users: CollaboratorPresence[]) => void
}

type SyncMessageType = 'sync-step-1' | 'sync-step-2' | 'update' | 'awareness'

interface BroadcastPayload {
  type: SyncMessageType
  data: string
  senderId: string
}

/**
 * Yjs CRDT provider backed by Supabase Realtime Broadcast & Presence.
 *
 * Works seamlessly on Vercel serverless/edge deployments with zero
 * separate WebSocket server required.
 */
export class SupabaseYjsProvider {
  public readonly doc: Y.Doc
  public readonly awareness: Awareness
  private readonly documentId: string
  private readonly user: SupabaseYjsProviderConfig['user']
  private readonly supabase = createSupabaseBrowserClient()
  private channel: RealtimeChannel | null = null
  private destroyed = false
  private synced = false

  private readonly onStatusChange?: (status: ConnectionStatus) => void
  private readonly onSynced?: (synced: boolean) => void
  private readonly onPresenceChange?: (users: CollaboratorPresence[]) => void

  constructor(config: SupabaseYjsProviderConfig) {
    this.doc = config.doc
    this.documentId = config.documentId
    this.user = config.user
    this.onStatusChange = config.onStatusChange
    this.onSynced = config.onSynced
    this.onPresenceChange = config.onPresenceChange

    this.awareness = new Awareness(this.doc)
    this.awareness.setLocalStateField('user', {
      userId: this.user.id,
      name: this.user.name,
      color: this.user.color,
    })

    this.doc.on('update', this.handleDocUpdate)
    this.awareness.on('update', this.handleAwarenessUpdate)

    this.connect()
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    // Do not re-broadcast updates received from remote peers or DB load
    if (origin === 'remote' || origin === 'persistence') return
    this.broadcast('update', update)
  }

  private handleAwarenessUpdate = ({
    added,
    updated,
    removed,
  }: {
    added: number[]
    updated: number[]
    removed: number[]
  }) => {
    const changed = added.concat(updated, removed)
    if (changed.length === 0) return
    const encoded = encodeAwarenessUpdate(this.awareness, changed)
    this.broadcast('awareness', encoded)
    this.emitPresenceFromAwareness()
  }

  private emitPresenceFromAwareness() {
    if (!this.onPresenceChange) return
    const list: CollaboratorPresence[] = []
    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId === this.awareness.clientID) return
      const u = state?.user as
        | { userId?: string; name?: string; color?: string }
        | undefined
      if (u?.name && u?.color) {
        list.push({
          userId: u.userId ?? String(clientId),
          name: u.name,
          color: u.color,
        })
      }
    })
    this.onPresenceChange(list)
  }

  private connect() {
    if (this.destroyed) return
    this.onStatusChange?.('connecting')

    this.channel = this.supabase.channel(`doc:${this.documentId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: String(this.awareness.clientID) },
      },
    })

    this.channel.on('broadcast', { event: 'yjs' }, ({ payload }) => {
      this.handleBroadcast(payload as BroadcastPayload)
    })

    this.channel.on('presence', { event: 'join' }, () => {
      // Send our state vector to newly joined peers
      this.sendSyncStep1()
      const localAwareness = encodeAwarenessUpdate(this.awareness, [
        this.awareness.clientID,
      ])
      this.broadcast('awareness', localAwareness)
    })

    this.channel.on('presence', { event: 'leave' }, ({ key }) => {
      const clientId = Number(key)
      if (!Number.isNaN(clientId)) {
        removeAwarenessStates(this.awareness, [clientId], 'remote')
      }
    })

    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        this.onStatusChange?.('connected')
        await this.channel?.track({
          userId: this.user.id,
          name: this.user.name,
          color: this.user.color,
        })
        this.sendSyncStep1()
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        this.onStatusChange?.('disconnected')
      }
    })
  }

  private sendSyncStep1() {
    const stateVector = Y.encodeStateVector(this.doc)
    this.broadcast('sync-step-1', stateVector)
  }

  private broadcast(type: SyncMessageType, data: Uint8Array) {
    if (!this.channel || this.destroyed) return
    this.channel.send({
      type: 'broadcast',
      event: 'yjs',
      payload: {
        type,
        data: uint8ArrayToBase64(data),
        senderId: this.user.id,
      } satisfies BroadcastPayload,
    })
  }

  private handleBroadcast(payload: BroadcastPayload) {
    if (this.destroyed || payload.senderId === this.user.id) return

    const bytes = base64ToUint8Array(payload.data)

    switch (payload.type) {
      case 'sync-step-1': {
        const diff = Y.encodeStateAsUpdate(this.doc, bytes)
        this.broadcast('sync-step-2', diff)
        break
      }
      case 'sync-step-2': {
        Y.applyUpdate(this.doc, bytes, 'remote')
        if (!this.synced) {
          this.synced = true
          this.onSynced?.(true)
        }
        break
      }
      case 'update': {
        Y.applyUpdate(this.doc, bytes, 'remote')
        break
      }
      case 'awareness': {
        applyAwarenessUpdate(this.awareness, bytes, 'remote')
        this.emitPresenceFromAwareness()
        break
      }
    }
  }

  public destroy() {
    if (this.destroyed) return
    this.destroyed = true

    this.doc.off('update', this.handleDocUpdate)
    this.awareness.off('update', this.handleAwarenessUpdate)
    removeAwarenessStates(this.awareness, [this.awareness.clientID], 'local')
    this.awareness.destroy()

    if (this.channel) {
      this.channel.untrack()
      this.supabase.removeChannel(this.channel)
      this.channel = null
    }

    this.onStatusChange?.('disconnected')
  }
}
