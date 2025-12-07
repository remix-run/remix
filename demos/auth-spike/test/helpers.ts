import { SetCookie, Cookie } from '@remix-run/headers'
import { resetPosts } from '../app/models/posts.ts'
import { authStorage } from '../app/utils/auth.ts'
import { getLastEmailTo, clearSentEmails } from '../app/services/email.ts'

/**
 * Extract a specific cookie value from Set-Cookie headers
 */
export function getCookie(response: Response, name: string): string | null {
  let setCookieHeaders = response.headers.getSetCookie()

  for (let header of setCookieHeaders) {
    let setCookie = new SetCookie(header)
    if (setCookie.name === name) {
      return setCookie.value ?? null
    }
  }

  return null
}

/**
 * Extract session cookie from Set-Cookie headers
 */
export function getSessionCookie(response: Response): string | null {
  return getCookie(response, 'session')
}

/**
 * Create a request with a session cookie
 */
export function requestWithSession(
  url: string,
  sessionCookie: string,
  init?: RequestInit,
): Request {
  let cookie = new Cookie({ session: sessionCookie })

  return new Request(url, {
    ...init,
    headers: {
      ...init?.headers,
      Cookie: cookie.toString(),
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
 * Register a new user (doesn't return session)
 */
export async function signup(
  router: any,
  email: string,
  password: string,
  name: string = 'Test User',
): Promise<void> {
  await router.fetch('https://remix.run/signup', {
    method: 'POST',
    body: new URLSearchParams({ email, password, name }),
    redirect: 'manual',
  })
}

/**
 * Setup test environment (reset state)
 */
export function setupTest() {
  resetPosts()
  clearSentEmails()

  // Reset auth storage (clear all arrays)
  authStorage.user.length = 0
  authStorage.password.length = 0
  authStorage.oauthAccount.length = 0
  authStorage.passwordResetToken.length = 0
}

/**
 * Get the password reset token from the most recent email sent to an address
 */
export function getResetTokenFromEmail(email: string): string | null {
  let lastEmail = getLastEmailTo(email)
  if (!lastEmail) return null

  // Extract token from reset URL in email text
  let match = lastEmail.text.match(/\/reset-password\/([a-f0-9]+)/)
  return match ? match[1] : null
}

export { clearSentEmails }

/**
 * Register a new user and login, returning the session cookie
 */
export async function login(
  router: any,
  email: string,
  password: string,
  name: string = 'Test User',
): Promise<string> {
  // First signup the user
  await signup(router, email, password, name)

  // Then login
  let loginResponse = await router.fetch('https://remix.run/login', {
    method: 'POST',
    body: new URLSearchParams({ email, password }),
    redirect: 'manual',
  })

  let sessionId = getSessionCookie(loginResponse)
  if (!sessionId) {
    throw new Error('Failed to get session cookie from login response')
  }

  return sessionId
}
