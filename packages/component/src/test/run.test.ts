import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock } from '@remix-run/test'

import { defaultResolveFrame, Frame, navigate, run } from '../index.ts'
import type { ResolveFrameOptions } from '../index.ts'
import { jsx } from '../jsx-runtime.ts'

describe('defaultResolveFrame', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('returns an unconsumed response without invoking its commit callback', async (t) => {
    let response = new Response('<p>Ready</p>')
    let commit = t.mock.fn()
    let result = await defaultResolveFrame('/frame', undefined, {
      fetch: async () => response,
      commit,
    })
    expect(result).toBe(response)
    expect(result.bodyUsed).toBe(false)
    expect(commit.mock.calls).toHaveLength(0)
  })

  it('passes the prepared frame request to a custom fetch implementation', async (t) => {
    let response = new Response('<p>Saved</p>', {
      headers: { 'Content-Security-Policy': "script-src 'nonce-response'" },
    })
    let fetchMock = t.mock.method(globalThis, 'fetch', async () => response)
    let controller = new AbortController()
    let formData = new FormData()
    formData.set('name', 'Ada Lovelace')

    let result = await defaultResolveFrame(
      '/account',
      { target: 'details', method: 'post', formData, signal: controller.signal },
      {
        fetch(url, init) {
          let headers = new Headers(init?.headers)
          headers.set('Authorization', 'Bearer example')
          return fetch(url, {
            ...init,
            cache: 'no-cache',
            credentials: 'omit',
            priority: 'high',
            headers,
          })
        },
      },
    )

    expect(result).toBe(response)
    expect(result.bodyUsed).toBe(false)
    let [src, init] = fetchMock.mock.calls[0]!.arguments
    expect(src).toBe('/account')
    expect(init?.cache).toBe('no-cache')
    expect(init?.credentials).toBe('omit')
    expect(init?.priority).toBe('high')
    expect(init?.method).toBe('post')
    expect(init?.signal).toBe(controller.signal)
    expect(init?.mode).toBe('same-origin')
    expect(init?.body?.toString()).toBe('name=Ada+Lovelace')
    let headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer example')
    expect(headers.get('Accept')).toBe('text/html')
    expect(headers.get('X-Remix-Frame')).toBe('true')
    expect(headers.get('X-Remix-Target')).toBe('details')
    expect(headers.get('Content-Type')).toBe('application/x-www-form-urlencoded')
  })

  it('lets Fetch encode multipart bodies and omits a target for unnamed frames', async (t) => {
    let fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('<p>Saved</p>'))
    let formData = new FormData()
    formData.set('name', 'Ada')

    await defaultResolveFrame('/account', {
      method: 'post',
      formData,
      encType: 'multipart/form-data',
    })

    let init = fetchMock.mock.calls[0]!.arguments[1]
    expect(init?.body).toBe(formData)
    let headers = new Headers(init?.headers)
    expect(headers.get('Accept')).toBe('text/html')
    expect(headers.get('X-Remix-Frame')).toBe('true')
    expect(headers.get('X-Remix-Target')).toBeNull()
    expect(headers.get('Content-Type')).toBeNull()
  })

  it('can return a Cache API response without fetching', async (t) => {
    let cacheName = `frame-test-${crypto.randomUUID()}`
    t.after(() => caches.delete(cacheName))
    let cache = await caches.open(cacheName)
    let src = new URL('/cached-frame', window.location.href).href
    await cache.put(
      new Request(src, {
        headers: { Accept: 'text/html', 'X-Remix-Frame': 'true', 'X-Remix-Target': 'details' },
      }),
      new Response('<p>Cached</p>', {
        headers: {
          'Content-Type': 'text/html',
          'Content-Security-Policy': "script-src 'nonce-cached'",
          Vary: 'X-Remix-Frame, X-Remix-Target',
        },
      }),
    )
    let fetchMock = t.mock.method(globalThis, 'fetch', async () => {
      throw new Error('Unexpected network request')
    })

    let response = await defaultResolveFrame(
      src,
      { target: 'details' },
      {
        async fetch(url, init) {
          let cached = await cache.match(new Request(url, init))
          if (!cached) throw new Error('Expected a matching cached frame')
          return cached
        },
      },
    )

    expect(fetchMock.mock.calls.length).toBe(0)
    expect(response.bodyUsed).toBe(false)
    expect(response.headers.get('Content-Security-Policy')).toBe("script-src 'nonce-cached'")
    expect(await response.text()).toBe('<p>Cached</p>')
  })

  it('validates responses returned by a custom fetch implementation', async () => {
    await expect(
      defaultResolveFrame('/unavailable', undefined, {
        fetch: async () =>
          new Response('<p>Unavailable</p>', { status: 503, statusText: 'Service Unavailable' }),
      }),
    ).rejects.toThrow('Failed to resolve frame: 503 Service Unavailable')
  })

  it('uses the original transitions to customize traversal fetches', async (t) => {
    let initialUrl = window.location.href
    let initialKey = window.navigation.currentEntry?.key
    let requests: Request[] = []
    let transitions: Array<ResolveFrameOptions['transition']> = []
    document.body.innerHTML = '<main>Initial</main>'
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(
        new Request(typeof input === 'string' ? new URL(input, document.baseURI) : input, init),
      )
      return new Response(
        '<!doctype html><html><head></head><body><main>Page</main></body></html><!-- rmx:flush document -->',
      )
    })
    let app = run({
      loadModule: mock.fn(),
      resolveFrame(src, options) {
        transitions.push(options?.transition)
        if (options?.transition) expect(options.transition).toBe(window.navigation.transition)
        return defaultResolveFrame(src, options, {
          fetch: (url, init) =>
            fetch(url, {
              ...init,
              cache: options?.transition?.navigationType === 'traverse' ? 'force-cache' : 'default',
            }),
        })
      },
    })
    t.after(async () => {
      try {
        if (initialKey && window.navigation.currentEntry?.key !== initialKey) {
          await window.navigation.traverseTo(initialKey).finished
        }
      } finally {
        app.dispose()
        window.history.replaceState(null, '', initialUrl)
      }
    })
    await app.ready()

    let destination = new URL(initialUrl)
    destination.searchParams.set('frame-cache', 'push')
    await navigate(destination.href)
    destination.searchParams.set('frame-cache', 'replace')
    await navigate(destination.href, { history: 'replace' })
    await window.navigation.back().finished
    await window.navigation.forward().finished
    await window.navigation.reload().finished
    await app.frames.top.reload()

    expect(transitions.map((transition) => transition?.navigationType)).toEqual([
      'push',
      'replace',
      'traverse',
      'traverse',
      'reload',
      undefined,
    ])
    expect(transitions[0]?.from.url).toBe(initialUrl)
    expect(requests.map((request) => request.cache)).toEqual([
      'default',
      'default',
      'force-cache',
      'force-cache',
      'default',
      'default',
    ])
    expect(document.querySelector('main')?.textContent).toBe('Page')
  })

  it('omits the transition from an imperative reload during another navigation', async (t) => {
    let initialUrl = window.location.href
    let requested = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    let loads: Array<ResolveFrameOptions['transition']> = []
    let app = run({
      loadModule: mock.fn(),
      async resolveFrame(src, options) {
        if (src === '/details') {
          loads.push(options?.transition)
          return '<p>Details</p>'
        }
        requested.resolve()
        await release.promise
        return '<!doctype html><html><head></head><body>Next</body></html><!-- rmx:flush document -->'
      },
    })
    t.after(() => {
      release.resolve()
      app.dispose()
      window.history.replaceState(null, '', initialUrl)
    })
    await app.ready()
    await app.frames.top.replace(jsx(Frame, { name: 'details', src: '/details' }))
    let details = app.frames.get('details')
    if (!details) throw new Error('Expected the details frame')

    let destination = new URL(initialUrl)
    destination.searchParams.set('frame-transition', 'pending')
    let pending = navigate(destination.href, { history: 'replace' })
    await requested.promise
    expect(window.navigation.transition).not.toBeNull()
    await details.reload()
    expect(loads).toEqual([undefined, undefined])
    release.resolve()
    await pending
  })
})
