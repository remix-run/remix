import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock } from '@remix-run/test'

import { defaultResolveFrame, navigate, run } from '../index.ts'
import type { ResolveFrameOptions } from '../index.ts'

describe('defaultResolveFrame', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('applies Fetch overrides while preserving the frame request and response', async (t) => {
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
        cache: 'no-cache',
        credentials: 'omit',
        priority: 'high',
        headers: {
          Authorization: 'Bearer example',
          'X-Remix-Frame': 'false',
          'X-Remix-Target': 'other',
          'Content-Type': 'application/json',
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

    await defaultResolveFrame(
      '/account',
      { method: 'post', formData, encType: 'multipart/form-data' },
      {
        headers: new Headers({
          'X-Request-Id': 'example',
          'X-Remix-Target': 'other',
          'Content-Type': 'application/json',
        }),
      },
    )

    let init = fetchMock.mock.calls[0]!.arguments[1]
    expect(init?.body).toBe(formData)
    let headers = new Headers(init?.headers)
    expect(headers.get('X-Request-Id')).toBe('example')
    expect(headers.get('X-Remix-Target')).toBeNull()
    expect(headers.get('Content-Type')).toBeNull()
  })

  it('uses request-specific navigation types to customize traversal fetches', async (t) => {
    let initialUrl = window.location.href
    let initialKey = window.navigation.currentEntry?.key
    let requests: Request[] = []
    let navigationTypes: Array<ResolveFrameOptions['navigationType']> = []
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
        navigationTypes.push(options?.navigationType)
        return defaultResolveFrame(src, options, {
          cache: options?.navigationType === 'traverse' ? 'force-cache' : 'default',
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
    await app.frames.top.reload()

    expect(navigationTypes).toEqual(['push', 'replace', 'traverse', 'traverse', undefined])
    expect(requests.map((request) => request.cache)).toEqual([
      'default',
      'default',
      'force-cache',
      'force-cache',
      'default',
    ])
    expect(document.querySelector('main')?.textContent).toBe('Page')
  })
})
