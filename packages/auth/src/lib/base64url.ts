const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function toBase64Url(bytes: Uint8Array): string {
  let output = ''

  for (let index = 0; index < bytes.length; index += 3) {
    let byte1 = bytes[index] ?? 0
    let byte2 = bytes[index + 1] ?? 0
    let byte3 = bytes[index + 2] ?? 0
    let chunk = (byte1 << 16) | (byte2 << 8) | byte3

    output += base64Chars[(chunk >> 18) & 0x3f]
    output += base64Chars[(chunk >> 12) & 0x3f]
    if (index + 1 < bytes.length) output += base64Chars[(chunk >> 6) & 0x3f]
    if (index + 2 < bytes.length) output += base64Chars[chunk & 0x3f]
  }

  return output.replace(/\+/g, '-').replace(/\//g, '_')
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
    throw new Error('Invalid base64url value.')
  }

  let bytes = new Uint8Array(Math.floor((value.length * 3) / 4))
  let byteIndex = 0
  let buffer = 0
  let bits = 0

  for (let char of value) {
    let sextet = char === '-' ? 62 : char === '_' ? 63 : base64Chars.indexOf(char)
    buffer = (buffer << 6) | sextet
    bits += 6

    if (bits >= 8) {
      bits -= 8
      bytes[byteIndex++] = (buffer >> bits) & 0xff
    }
  }

  // Reject non-canonical input whose unused trailing bits are set, so each value has one encoding.
  if ((buffer & ((1 << bits) - 1)) !== 0) {
    throw new Error('Invalid base64url value.')
  }

  return bytes
}
