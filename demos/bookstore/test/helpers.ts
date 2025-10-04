/**
 * Extract session cookie from Set-Cookie header
 */
export function getSessionCookie(response: Response): string | null {
  let setCookie = response.headers.get('Set-Cookie')
  if (!setCookie) return null

  let match = setCookie.match(/sessionId=([^;]+)/)
  return match ? match[1] : null
}

/**
 * Create a request with a session cookie
 */
export function requestWithSession(url: string, sessionId: string, init?: RequestInit): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...init?.headers,
      Cookie: `sessionId=${sessionId}`,
    },
  })
}

/**
 * Assert that HTML contains a substring
 */
export function assertContains(html: string, text: string): void {
  if (!html.includes(text)) {
    throw new Error(`Expected HTML to contain "${text}"`)
  }
}

/**
 * Assert that HTML does not contain a substring
 */
export function assertNotContains(html: string, text: string): void {
  if (html.includes(text)) {
    throw new Error(`Expected HTML to not contain "${text}"`)
  }
}
