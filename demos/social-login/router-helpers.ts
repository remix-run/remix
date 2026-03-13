import { SetCookie } from 'remix/headers'
import { createCookie } from 'remix/cookie'
import { createMemorySessionStorage } from 'remix/session/memory-storage'

import type { SocialLoginConfig } from './app/config.ts'
import { createSocialLoginRouter } from './app/router.ts'

export function createTestRouter(config?: Partial<SocialLoginConfig>) {
  let sessionCookie = createCookie('test-social-login-session', {
    secrets: ['secret1'],
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
  })
  let sessionStorage = createMemorySessionStorage()

  return {
    router: createSocialLoginRouter({
      config: {
        googleClientId: 'google-client-id',
        googleClientSecret: 'google-client-secret',
        githubClientId: 'github-client-id',
        githubClientSecret: 'github-client-secret',
        xClientId: 'x-client-id',
        xClientSecret: 'x-client-secret',
        ...config,
      },
      sessionCookie,
      sessionStorage,
    }),
  }
}

export function createRequest(url: string, fromResponse?: Response, init: RequestInit = {}): Request {
  let headers = new Headers(init.headers)

  if (fromResponse != null) {
    let cookieValues = fromResponse.headers
      .getSetCookie()
      .map(value => new SetCookie(value))
      .map(cookie => `${cookie.name}=${cookie.value}`)

    if (cookieValues.length > 0) {
      headers.set('Cookie', cookieValues.join('; '))
    }
  }

  return new Request(url, {
    ...init,
    headers,
  })
}

export function getSessionId(response: Response): string | null {
  let cookie = response.headers
    .getSetCookie()
    .map(value => new SetCookie(value))
    .find(item => item.name === 'test-social-login-session')

  return cookie?.value ?? null
}

export function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
): () => void {
  let originalFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(input, init)) as typeof fetch

  return () => {
    globalThis.fetch = originalFetch
  }
}
