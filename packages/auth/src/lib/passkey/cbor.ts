export type CborValue =
  | number
  | string
  | boolean
  | null
  | undefined
  | Uint8Array<ArrayBuffer>
  | CborValue[]
  | CborMap

export type CborMap = Map<number | string, CborValue>

export interface CborDecodeResult {
  value: CborValue
  offset: number
}

const maxDepth = 16
const textDecoder = new TextDecoder('utf-8', { fatal: true })

// Decodes a single CBOR item that must span the entire input. Supports the definite-length subset
// WebAuthn authenticators emit: integers, byte and text strings, arrays, maps keyed by integers or
// strings, and simple values. Throws for anything else.
export function decodeCbor(bytes: Uint8Array<ArrayBuffer>): CborValue {
  let result = decodeCborItem(bytes, 0)
  if (result.offset !== bytes.length) {
    throw new Error('Unexpected trailing bytes after CBOR item.')
  }

  return result.value
}

// Decodes the CBOR item starting at `offset` and reports where it ends, so callers can read values
// embedded in a larger binary structure such as authenticator data.
export function decodeCborItem(bytes: Uint8Array<ArrayBuffer>, offset: number): CborDecodeResult {
  let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return readItem(bytes, view, offset, 0)
}

function readItem(
  bytes: Uint8Array<ArrayBuffer>,
  view: DataView,
  offset: number,
  depth: number,
): CborDecodeResult {
  if (depth > maxDepth) {
    throw new Error('CBOR item is nested too deeply.')
  }

  let initialByte = readUint8(view, offset)
  let majorType = initialByte >> 5
  let additionalInfo = initialByte & 0x1f
  offset += 1

  if (majorType === 7) {
    return readSimpleValue(additionalInfo, offset)
  }

  let argument = readArgument(view, offset, additionalInfo)
  offset = argument.offset

  switch (majorType) {
    case 0:
      return { value: argument.value, offset }
    case 1:
      return { value: -1 - argument.value, offset }
    case 2: {
      let end = getEnd(bytes, offset, argument.value)
      return { value: bytes.slice(offset, end), offset: end }
    }
    case 3: {
      let end = getEnd(bytes, offset, argument.value)
      return { value: textDecoder.decode(bytes.subarray(offset, end)), offset: end }
    }
    case 4: {
      let items: CborValue[] = []
      for (let index = 0; index < argument.value; index++) {
        let item = readItem(bytes, view, offset, depth + 1)
        items.push(item.value)
        offset = item.offset
      }
      return { value: items, offset }
    }
    case 5: {
      let map: CborMap = new Map()
      for (let index = 0; index < argument.value; index++) {
        let key = readItem(bytes, view, offset, depth + 1)
        if (typeof key.value !== 'number' && typeof key.value !== 'string') {
          throw new Error('CBOR map keys must be integers or text strings.')
        }
        if (map.has(key.value)) {
          throw new Error('CBOR map contains a duplicate key.')
        }

        let entry = readItem(bytes, view, key.offset, depth + 1)
        map.set(key.value, entry.value)
        offset = entry.offset
      }
      return { value: map, offset }
    }
    default:
      throw new Error('CBOR tags are not supported.')
  }
}

function readSimpleValue(additionalInfo: number, offset: number): CborDecodeResult {
  switch (additionalInfo) {
    case 20:
      return { value: false, offset }
    case 21:
      return { value: true, offset }
    case 22:
      return { value: null, offset }
    case 23:
      return { value: undefined, offset }
    default:
      throw new Error('Unsupported CBOR simple value.')
  }
}

function readArgument(
  view: DataView,
  offset: number,
  additionalInfo: number,
): { value: number; offset: number } {
  if (additionalInfo < 24) {
    return { value: additionalInfo, offset }
  }

  switch (additionalInfo) {
    case 24:
      return { value: readUint8(view, offset), offset: offset + 1 }
    case 25:
      checkAvailable(view, offset, 2)
      return { value: view.getUint16(offset), offset: offset + 2 }
    case 26:
      checkAvailable(view, offset, 4)
      return { value: view.getUint32(offset), offset: offset + 4 }
    case 27: {
      checkAvailable(view, offset, 8)
      let value = view.getBigUint64(offset)
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('CBOR integer exceeds the safe integer range.')
      }
      return { value: Number(value), offset: offset + 8 }
    }
    default:
      throw new Error('Indefinite-length CBOR items are not supported.')
  }
}

function readUint8(view: DataView, offset: number): number {
  checkAvailable(view, offset, 1)
  return view.getUint8(offset)
}

function checkAvailable(view: DataView, offset: number, length: number): void {
  if (offset + length > view.byteLength) {
    throw new Error('Unexpected end of CBOR data.')
  }
}

function getEnd(bytes: Uint8Array, offset: number, length: number): number {
  let end = offset + length
  if (end > bytes.length) {
    throw new Error('Unexpected end of CBOR data.')
  }

  return end
}
