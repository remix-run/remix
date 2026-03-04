/**
 * Content hashing utilities.
 */

export async function hashContent(content: string): Promise<string> {
  let encoder = new TextEncoder()
  let data = encoder.encode(content)
  let hashBuffer = await crypto.subtle.digest('SHA-256', data)
  let hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray
    .map((b) => b.toString(36))
    .join('')
    .slice(0, 16)
}
