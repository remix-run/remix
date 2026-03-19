let HASH_PREFIX = 'pbkdf2_sha256'
let ITERATIONS = 100000
let SALT_LENGTH = 16
let KEY_LENGTH = 32

export async function hashPassword(password: string): Promise<string> {
  let salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  let hash = await derivePasswordHash(password, salt, ITERATIONS)

  return [
    HASH_PREFIX,
    String(ITERATIONS),
    encodeBase64(salt),
    encodeBase64(hash),
  ].join('$')
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  let parsed = parsePasswordHash(encodedHash)
  if (parsed == null) {
    return false
  }

  let actual = await derivePasswordHash(password, parsed.salt, parsed.iterations)
  return constantTimeEqual(actual, parsed.hash)
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  let key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  let bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBufferView(salt),
      iterations,
    },
    key,
    KEY_LENGTH * 8,
  )

  return new Uint8Array(bits)
}

function parsePasswordHash(encodedHash: string): {
  iterations: number
  salt: Uint8Array
  hash: Uint8Array
} | null {
  let [prefix, iterationsText, saltText, hashText] = encodedHash.split('$')

  if (prefix !== HASH_PREFIX) {
    return null
  }

  let iterations = Number(iterationsText)
  if (!Number.isInteger(iterations) || iterations < 1) {
    return null
  }

  try {
    let salt = decodeBase64(saltText)
    let hash = decodeBase64(hashText)
    if (salt.length === 0 || hash.length === 0) {
      return null
    }

    return { iterations, salt, hash }
  } catch {
    return null
  }
}

function encodeBase64(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value))
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0))
}

function toArrayBufferView(value: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(value)
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }

  let result = 0

  for (let index = 0; index < left.length; index++) {
    result |= left[index]! ^ right[index]!
  }

  return result === 0
}
