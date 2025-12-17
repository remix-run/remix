const encoder = new TextEncoder()

export async function sign(value: string, secret: string): Promise<string> {
  let data = encoder.encode(value)
  let key = await createKey(secret, ['sign'])
  let signature = await crypto.subtle.sign('HMAC', key, data)
  let hash = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=+$/, '')

  return value + '.' + hash
}

export async function unsign(cookie: string, secret: string): Promise<string | false> {
  let index = cookie.lastIndexOf('.')

  if (index === -1) {
    return false
  }

  let value = cookie.slice(0, index)
  let hash = cookie.slice(index + 1)
  let data = encoder.encode(value)
  let key = await createKey(secret, ['verify'])

  try {
    let signature = byteStringToArray(atob(hash))
    let valid = await crypto.subtle.verify('HMAC', key, signature, data)

    return valid ? value : false
  } catch (error: unknown) {
    // atob will throw a DOMException with name === 'InvalidCharacterError'
    // if the signature contains a non-base64 character, which should just
    // be treated as an invalid signature.
    return false
  }
}

function createKey(secret: string, usages: CryptoKey['usages']): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  )
}

function byteStringToArray(byteString: string): Uint8Array<ArrayBuffer> {
  let array = new Uint8Array(byteString.length)

  for (let i = 0; i < byteString.length; i++) {
    array[i] = byteString.charCodeAt(i)
  }

  return array
}
