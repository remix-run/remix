/**
 * A decoded CBOR value. Maps keep their original key types (WebAuthn COSE keys use negative
 * integer labels), so they decode to `Map` rather than plain objects.
 */
export type CBORValue =
  | number
  | string
  | boolean
  | null
  | undefined
  | Uint8Array<ArrayBuffer>
  | CBORValue[]
  | Map<CBORValue, CBORValue>

const textDecoder = new TextDecoder('utf-8', { fatal: true })
const maxDepth = 16

// Decodes the first CBOR item in `bytes` and returns it with the number of bytes it used.
// Supports the subset WebAuthn needs: integers, byte and text strings, arrays, maps, and the
// `false`/`true`/`null`/`undefined` simple values. Indefinite lengths, tags, and floats throw,
// since CTAP2 canonical CBOR never produces them.
export function decodeCBORItem(bytes: Uint8Array): { value: CBORValue; length: number } {
  let offset = 0

  function readLength(info: number): number {
    if (info < 24) return info

    let size = info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : info === 27 ? 8 : 0
    if (size === 0) {
      throw new Error('Unsupported CBOR length encoding.')
    }
    if (offset + size > bytes.length) {
      throw new Error('Unexpected end of CBOR data.')
    }

    let value = 0
    for (let index = 0; index < size; index++) {
      value = value * 256 + bytes[offset + index]!
    }
    offset += size

    if (!Number.isSafeInteger(value)) {
      throw new Error('CBOR integer is too large.')
    }

    return value
  }

  function readBytes(length: number): Uint8Array<ArrayBuffer> {
    if (offset + length > bytes.length) {
      throw new Error('Unexpected end of CBOR data.')
    }

    let value = bytes.slice(offset, offset + length)
    offset += length
    return value
  }

  function readItem(depth: number): CBORValue {
    if (depth > maxDepth) {
      throw new Error('CBOR data is nested too deeply.')
    }
    if (offset >= bytes.length) {
      throw new Error('Unexpected end of CBOR data.')
    }

    let initial = bytes[offset++]!
    let major = initial >> 5
    let info = initial & 0x1f

    switch (major) {
      case 0:
        return readLength(info)
      case 1:
        return -1 - readLength(info)
      case 2:
        return readBytes(readLength(info))
      case 3:
        return textDecoder.decode(readBytes(readLength(info)))
      case 4: {
        let length = readLength(info)
        let array: CBORValue[] = []
        for (let index = 0; index < length; index++) {
          array.push(readItem(depth + 1))
        }
        return array
      }
      case 5: {
        let length = readLength(info)
        let map = new Map<CBORValue, CBORValue>()
        for (let index = 0; index < length; index++) {
          let key = readItem(depth + 1)
          if (map.has(key)) {
            throw new Error('Duplicate CBOR map key.')
          }
          map.set(key, readItem(depth + 1))
        }
        return map
      }
      case 7:
        if (info === 20) return false
        if (info === 21) return true
        if (info === 22) return null
        if (info === 23) return undefined
        throw new Error('Unsupported CBOR simple value.')
      default:
        throw new Error('Unsupported CBOR tag.')
    }
  }

  let value = readItem(0)
  return { value, length: offset }
}

// Decodes `bytes` as exactly one CBOR item.
export function decodeCBOR(bytes: Uint8Array): CBORValue {
  let { value, length } = decodeCBORItem(bytes)
  if (length !== bytes.length) {
    throw new Error('Unexpected trailing bytes after CBOR data.')
  }

  return value
}
