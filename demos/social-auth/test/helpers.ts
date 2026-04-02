import { createCookie } from 'remix/cookie'
import { Cookie, SetCookie } from 'remix/headers'
import { createMemorySessionStorage } from 'remix/session/memory-storage'

import { createSocialAuthRouter, type SocialAuthRouterOptions } from '../app/router.ts'
import { initializeSocialAuthDatabase, resetSocialAuthDatabase } from '../app/data/setup.ts'

export async function createTestRouter(
  options: Omit<SocialAuthRouterOptions, 'sessionCookie' | 'sessionStorage'> = {},
) {
  await initializeSocialAuthDatabase()
  await resetSocialAuthDatabase()

  let sessionCookie = createCookie('social-auth-session', {
    secrets: ['test-social-auth-secret'],
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  let sessionStorage = createMemorySessionStorage()

  return createSocialAuthRouter({
    ...options,
    sessionCookie,
    sessionStorage,
  })
}

function getCookie(response: Response, name: string): string | null {
  for (let header of response.headers.getSetCookie()) {
    let setCookie = new SetCookie(header)
    if (setCookie.name === name) {
      return setCookie.value ?? null
    }
  }

  return null
}

export function getSessionCookie(response: Response): string | null {
  return getCookie(response, 'social-auth-session')
}

export function requestWithSession(
  url: string,
  sessionCookie: string,
  init?: RequestInit,
): Request {
  let cookie = new Cookie({ 'social-auth-session': sessionCookie })

  return new Request(url, {
    ...init,
    headers: {
      ...init?.headers,
      Cookie: cookie.toString(),
    },
  })
}

export function assertContains(html: string, text: string): void {
  if (!html.includes(text)) {
    throw new Error(`Expected HTML to contain "${text}"`)
  }
}
