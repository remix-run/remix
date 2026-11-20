import { Cookie, SetCookie } from 'remix/headers'
import { createTestServer, type TestServer } from 'remix/node-fetch-server/test'
import { createMemorySessionStorage } from 'remix/session-storage/memory'

import { db, loadAppMigrations } from '../app/db.ts'
import { createPasskeysRouter } from '../app/router.ts'

export const testOrigin = 'https://passkeys.test'

export async function createTestRouter() {
  await db.reset({ migrations: await loadAppMigrations() })
  return createPasskeysRouter({ origin: testOrigin, sessionStorage: createMemorySessionStorage() })
}

// Starts the app on a random port for browser tests. Browsers reject IP addresses as passkey
// relying party ids, so the app is configured for, and opened on, `localhost`.
export async function startTestServer(): Promise<TestServer> {
  await db.reset({ migrations: await loadAppMigrations() })

  let router: ReturnType<typeof createPasskeysRouter> | undefined
  let server = await createTestServer(
    (request) => router?.fetch(request) ?? new Response('Starting', { status: 503 }),
  )
  let baseUrl = server.baseUrl.replace('127.0.0.1', 'localhost')
  router = createPasskeysRouter({ origin: baseUrl, sessionStorage: createMemorySessionStorage() })

  return { baseUrl, close: server.close }
}

export function getSessionCookie(response: Response): string | null {
  for (let header of response.headers.getSetCookie()) {
    let setCookie = new SetCookie(header)
    if (setCookie.name === 'passkeys-session') {
      return setCookie.value ?? null
    }
  }

  return null
}

export function withSession(sessionCookie: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...init.headers,
      Cookie: new Cookie({ 'passkeys-session': sessionCookie }).toString(),
    },
  }
}
