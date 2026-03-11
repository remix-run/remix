import { SetCookie } from '@remix-run/headers'

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
