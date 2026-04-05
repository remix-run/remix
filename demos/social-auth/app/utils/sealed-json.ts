const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export async function sealJson(value: unknown, secret: string, scope: string): Promise<string> {
  let iv = crypto.getRandomValues(new Uint8Array(12))
  let key = await importSealingKey(secret)
  let ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: textEncoder.encode(scope),
    },
    key,
    textEncoder.encode(JSON.stringify(value)),
  )

  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`
}

export async function unsealJson<value>(
  sealed: string,
  secret: string,
  scope: string,
): Promise<value | null> {
  let [version, encodedIv, encodedCiphertext, ...rest] = sealed.split('.')
  if (version !== 'v1' || encodedIv == null || encodedCiphertext == null || rest.length > 0) {
    return null
  }

  let key = await importSealingKey(secret)

  try {
    let plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(fromBase64Url(encodedIv)),
        additionalData: textEncoder.encode(scope),
      },
      key,
      toArrayBuffer(fromBase64Url(encodedCiphertext)),
    )

    return JSON.parse(textDecoder.decode(plaintext)) as value
  } catch {
    return null
  }
}

async function importSealingKey(secret: string): Promise<CryptoKey> {
  let digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret))

  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function fromBase64Url(value: string): Uint8Array {
  let padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/') + padding

  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function toBase64Url(bytes: Uint8Array): string {
  let text = ''

  for (let index = 0; index < bytes.length; index += 3) {
    let chunk =
      ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0)

    text += base64Chars[(chunk >> 18) & 0x3f]
    text += base64Chars[(chunk >> 12) & 0x3f]
    text += index + 1 < bytes.length ? base64Chars[(chunk >> 6) & 0x3f] : '='
    text += index + 2 < bytes.length ? base64Chars[chunk & 0x3f] : '='
  }

  return text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
