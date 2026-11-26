import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import {
  uint8ArrayToHex,
  hexToUint8Array,
  uint8ArrayToBase64,
  base64ToUint8Array,
  decodeYjsState,
} from '../encoding'

describe('Yjs CRDT synchronization & encoding', () => {
  it('converges to identical state on concurrent edits regardless of delivery order', () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    const docC = new Y.Doc()

    const updatesA: Uint8Array[] = []
    const updatesB: Uint8Array[] = []

    docA.on('update', (u: Uint8Array) => updatesA.push(u))
    docB.on('update', (u: Uint8Array) => updatesB.push(u))

    // Concurrent offline edits on docA and docB
    docA.getText('content').insert(0, 'Hello ')
    docB.getText('content').insert(0, 'World!')

    // Apply updates in opposite orders to docA/docB vs docC
    for (const u of updatesB) Y.applyUpdate(docA, u, 'remote')
    for (const u of updatesA) Y.applyUpdate(docB, u, 'remote')

    // docC receives B's updates first, then A's
    for (const u of updatesB) Y.applyUpdate(docC, u, 'remote')
    for (const u of updatesA) Y.applyUpdate(docC, u, 'remote')

    const textA = docA.getText('content').toString()
    const textB = docB.getText('content').toString()
    const textC = docC.getText('content').toString()

    expect(textA).toBe(textB)
    expect(textB).toBe(textC)
    expect(textA).toContain('Hello ')
    expect(textA).toContain('World!')
  })

  it('synchronizes missing state via state-vector diff (sync-step-1 / sync-step-2)', () => {
    const source = new Y.Doc()
    source.getXmlFragment('default').insert(0, [new Y.XmlText('Initial paragraph')])

    const target = new Y.Doc()
    target.getXmlFragment('default').insert(0, [new Y.XmlText('Peer note')])

    // Step 1: target sends its state vector to source
    const targetSV = Y.encodeStateVector(target)
    // Step 2: source computes minimal diff for target
    const diffForTarget = Y.encodeStateAsUpdate(source, targetSV)
    Y.applyUpdate(target, diffForTarget, 'remote')

    // Reverse step so source gets target's edit too
    const sourceSV = Y.encodeStateVector(source)
    const diffForSource = Y.encodeStateAsUpdate(target, sourceSV)
    Y.applyUpdate(source, diffForSource, 'remote')

    expect(Y.encodeStateAsUpdate(source).length).toBeGreaterThan(0)
    expect(source.getXmlFragment('default').toString()).toBe(
      target.getXmlFragment('default').toString()
    )
  })

  it('round-trips Yjs binary state through PostgreSQL bytea hex and base64', () => {
    const original = new Y.Doc()
    original.getText('prosemirror').insert(0, 'CloudSync persisted state 🚀')
    const rawState = Y.encodeStateAsUpdate(original)

    // PostgreSQL bytea hex round-trip
    const hex = uint8ArrayToHex(rawState)
    expect(hex.startsWith('\\x')).toBe(true)
    expect(hexToUint8Array(hex)).toEqual(rawState)
    expect(decodeYjsState(hex)).toEqual(rawState)

    // Base64 round-trip (Realtime broadcast)
    const b64 = uint8ArrayToBase64(rawState)
    expect(base64ToUint8Array(b64)).toEqual(rawState)
    expect(decodeYjsState(b64)).toEqual(rawState)

    // Hydrate a fresh Y.Doc from decoded state
    const restored = new Y.Doc()
    Y.applyUpdate(restored, decodeYjsState(hex), 'persistence')
    expect(restored.getText('prosemirror').toString()).toBe(
      'CloudSync persisted state 🚀'
    )
  })
})
