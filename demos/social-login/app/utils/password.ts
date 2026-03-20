import { timingSafeEqual } from 'node:crypto'

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
    Buffer.from(salt).toString('base64url'),
    Buffer.from(hash).toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  let [prefix, iterationsText, saltText, hashText] = encodedHash.split('$')
  if (prefix !== HASH_PREFIX) {
    return false
  }

  let iterations = Number(iterationsText)
  if (!Number.isInteger(iterations) || iterations < 1) {
    return false
  }

  try {
    let salt = Buffer.from(saltText, 'base64url')
    let expectedHash = Buffer.from(hashText, 'base64url')
    if (salt.length === 0 || expectedHash.length === 0) {
      return false
    }

    let actualHash = Buffer.from(await derivePasswordHash(password, salt, iterations))
    return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash)
  } catch {
    return false
  }
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
      salt,
      iterations,
    },
    key,
    KEY_LENGTH * 8,
  )

  return new Uint8Array(bits)
}
