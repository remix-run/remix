/**
 * JWT signing and verification using Web Crypto API (HMAC-SHA256)
 * Implements standard JWT format: header.payload.signature
 */

const encoder = new TextEncoder()

/**
 * Convert string to base64url encoding (URL-safe base64)
 * Properly handles UTF-8 characters
 */
function base64url(data: string): string {
  // Encode to UTF-8 first, then to base64
  let bytes = encoder.encode(data)
  let binary = String.fromCharCode(...bytes)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Convert base64url back to string
 * Properly handles UTF-8 characters
 */
function base64urlDecode(encoded: string): string {
  // Convert back to standard base64
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  // Add padding if needed
  let padding = encoded.length % 4
  if (padding) {
    base64 += '='.repeat(4 - padding)
  }
  // Decode from base64 to binary string, then to UTF-8
  let binary = atob(base64)
  let bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Convert Uint8Array to base64url
 */
function arrayToBase64url(array: Uint8Array): string {
  return base64url(String.fromCharCode(...array))
}

/**
 * Convert base64url to Uint8Array
 */
function base64urlToArray(base64url: string): Uint8Array {
  let decoded = base64urlDecode(base64url)
  let array = new Uint8Array(decoded.length)
  for (let i = 0; i < decoded.length; i++) {
    array[i] = decoded.charCodeAt(i)
  }
  return array
}

/**
 * Create HMAC key for signing/verification
 */
async function createKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  )
}

/**
 * Sign a JWT with HS256 (HMAC-SHA256)
 * 
 * @param payload - Data to encode in the JWT
 * @param secret - Secret key for signing
 * @param expiresIn - Expiration time in seconds (default: 3600)
 * @returns JWT string in format: header.payload.signature
 */
export async function signJWT(
  payload: Record<string, any>,
  secret: string,
  expiresIn: number = 3600,
): Promise<string> {
  let header = { alg: 'HS256', typ: 'JWT' }
  let now = Math.floor(Date.now() / 1000)

  let claims = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  }

  // Encode header and payload
  let encodedHeader = base64url(JSON.stringify(header))
  let encodedPayload = base64url(JSON.stringify(claims))
  let message = `${encodedHeader}.${encodedPayload}`

  // Sign with HMAC-SHA256
  let key = await createKey(secret, ['sign'])
  let signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))

  let encodedSignature = arrayToBase64url(new Uint8Array(signature))

  return `${message}.${encodedSignature}`
}

/**
 * Verify and decode a JWT
 * 
 * @param token - JWT string to verify
 * @param secret - Secret key for verification
 * @returns Decoded payload if valid, null if invalid or expired
 */
export async function verifyJWT<T = Record<string, any>>(
  token: string,
  secret: string,
): Promise<T | null> {
  try {
    let parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    let [encodedHeader, encodedPayload, encodedSignature] = parts

    // Verify signature
    let message = `${encodedHeader}.${encodedPayload}`
    let key = await createKey(secret, ['verify'])
    let signature = base64urlToArray(encodedSignature)

    let messageData = encoder.encode(message)
    let valid = await crypto.subtle.verify('HMAC', key, signature as BufferSource, messageData)

    if (!valid) {
      return null
    }

    // Decode and validate payload
    let payload = JSON.parse(base64urlDecode(encodedPayload))

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload as T
  } catch {
    return null
  }
}

