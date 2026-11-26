/**
 * Binary encoding utilities for Yjs state <-> Supabase PostgreSQL bytea.
 *
 * Supabase PostgREST returns `bytea` columns as `\x<hex>` strings and
 * accepts `\x<hex>` strings on insert/update. Base64 helpers are also
 * provided for Realtime broadcast payloads.
 */

export function uint8ArrayToHex(bytes: Uint8Array): string {
  let hex = '\\x'
  for (let i = 0; i < bytes.byteLength; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

export function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.startsWith('\\x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Decodes a stored `yjs_state` string (either PostgreSQL `\x` hex or base64)
 * into a `Uint8Array` ready for `Y.applyUpdate`.
 */
export function decodeYjsState(encoded: string): Uint8Array {
  if (encoded.startsWith('\\x')) {
    return hexToUint8Array(encoded)
  }
  return base64ToUint8Array(encoded)
}
