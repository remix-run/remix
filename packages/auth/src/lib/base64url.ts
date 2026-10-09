const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const lookup = createLookup()

export function encodeBase64Url(bytes: Uint8Array): string {
  let output = ''

  for (let index = 0; index < bytes.length; index += 3) {
    let byte1 = bytes[index]
    let byte2 = bytes[index + 1] ?? 0
    let byte3 = bytes[index + 2] ?? 0
    let chunk = (byte1 << 16) | (byte2 << 8) | byte3

    output += alphabet[(chunk >> 18) & 0x3f]
    output += alphabet[(chunk >> 12) & 0x3f]

    if (index + 1 < bytes.length) {
      output += alphabet[(chunk >> 6) & 0x3f]
    }

    if (index + 2 < bytes.length) {
      output += alphabet[chunk & 0x3f]
    }
  }

  return output
}

// Decodes unpadded base64url. Trailing `=` padding is tolerated. Returns `null` for any other
// malformed input instead of throwing so callers can reject untrusted values explicitly.
export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  let end = value.length
  while (end > 0 && value[end - 1] === '=' && value.length - end < 2) {
    end--
  }

  if (end % 4 === 1) {
    return null
  }

  let bytes = new Uint8Array(Math.floor((end * 3) / 4))
  let byteIndex = 0
  let buffer = 0
  let bits = 0

  for (let index = 0; index < end; index++) {
    let code = value.charCodeAt(index)
    let sextet = code < 128 ? lookup[code] : -1
    if (sextet === -1) {
      return null
    }

    buffer = ((buffer << 6) | sextet) & 0xffff
    bits += 6

    if (bits >= 8) {
      bits -= 8
      bytes[byteIndex++] = (buffer >> bits) & 0xff
    }
  }

  return bytes
}

function createLookup(): Int8Array {
  let table = new Int8Array(128).fill(-1)

  for (let index = 0; index < alphabet.length; index++) {
    table[alphabet.charCodeAt(index)] = index
  }

  return table
}
