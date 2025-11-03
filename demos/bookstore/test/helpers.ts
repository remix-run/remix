import { SetCookie } from '@remix-run/headers'

/**
 * Extract session cookie from Set-Cookie header
 */
export function getSessionCookie(response: Response): string | null {
  let setCookieHeader = response.headers.get('Set-Cookie')
  if (!setCookieHeader) return null

  let setCookie = new SetCookie(setCookieHeader)
  if (setCookie.name === '__session') {
    return `${setCookie.name}=${setCookie.value}`
  }

  return null
}

/**
 * Create a request with a session cookie
 */
export function requestWithSession(
  url: string,
  sessionCookie: string,
  init?: RequestInit,
): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...init?.headers,
      Cookie: sessionCookie,
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

/**
 * Login and return the session cookie
 */
export async function login(router: any, email: string, password: string): Promise<string> {
  let loginResponse = await router.fetch('http://localhost:3000/login', {
    method: 'POST',
    body: new URLSearchParams({ email, password }),
    redirect: 'manual',
  })

  let cookie = getSessionCookie(loginResponse)
  if (!cookie) {
    throw new Error('Failed to get session cookie from login response')
  }

  return cookie
}

/**
 * Login as admin and return the session cookie
 */
export async function loginAsAdmin(router: any): Promise<string> {
  return login(router, 'admin@bookstore.com', 'admin123')
}

/**
 * Login as customer and return the session cookie
 */
export async function loginAsCustomer(router: any): Promise<string> {
  return login(router, 'customer@example.com', 'password123')
}
