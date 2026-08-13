import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock } from '@remix-run/test'

import { on } from './index.ts'
import type { Handle } from './runtime/component.ts'
import { nodeFromResponse, nodeResponse, run, type SPARouter } from './spa.ts'
import { withResolvers } from './test/utils.ts'

describe('node responses', () => {
  it('associates a Remix node with an otherwise bodyless response', () => {
    let node = <h1>Hello</h1>
    let response = nodeResponse(node, {
      status: 201,
      headers: { 'X-Route': 'home' },
    })

    expect(response.status).toBe(201)
    expect(response.headers.get('X-Route')).toBe('home')
    expect(response.body).toBe(null)
    expect(nodeFromResponse(response)).toBe(node)
  })

  it('rejects responses that were not created by nodeResponse', () => {
    expect(() => nodeFromResponse(new Response())).toThrow(
      new TypeError('Expected a Remix node response'),
    )
  })
})

describe('run', () => {
  afterEach(() => {
    document.body.textContent = ''
  })

  it('renders the current URL through the router before ready resolves', async (t) => {
    let initialUrl = window.location.href
    let routeUrl = new URL(initialUrl)
    routeUrl.searchParams.set('spa-test', 'initial')
    window.history.replaceState(null, '', routeUrl)

    let fetch = mock.fn(async (input: string | URL | Request, init?: RequestInit) => {
      let request = input instanceof Request ? input : new Request(input, init)
      return nodeResponse(<h1>{new URL(request.url).searchParams.get('spa-test')}</h1>)
    })
    let app = run({ fetch })

    t.after(() => {
      app.dispose()
      window.history.replaceState(null, '', initialUrl)
    })

    await app.ready()

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(document.querySelector('h1')?.textContent).toBe('initial')
  })

  it('renders an interactive fallback while the initial route loads', async (t) => {
    let [routeResponse, resolveRouteResponse] = withResolvers<Response>()
    let [requestStarted, resolveRequestStarted] = withResolvers<void>()
    let sawReloadStart = false
    let fallbackAtRequest: string | undefined
    let reloadStartedAtRequest = false
    let ready = false

    function Fallback(handle: Handle) {
      let count = 0

      handle.queueTask(() => {
        handle.frame.addEventListener(
          'reloadStart',
          () => {
            sawReloadStart = true
          },
          { signal: handle.signal },
        )
      })

      return () => (
        <button
          mix={on('click', () => {
            count++
            void handle.update()
          })}
        >
          Loading: {count}
        </button>
      )
    }

    let fetch = mock.fn(async () => {
      fallbackAtRequest = document.querySelector('button')?.textContent ?? undefined
      reloadStartedAtRequest = sawReloadStart
      resolveRequestStarted()
      return await routeResponse
    })
    let app = run({ fetch }, { fallback: <Fallback /> })

    t.after(() => app.dispose())

    let readyPromise = app.ready().then(() => {
      ready = true
    })
    await requestStarted

    expect(ready).toBe(false)
    expect(fallbackAtRequest).toBe('Loading: 0')
    expect(reloadStartedAtRequest).toBe(true)
    let button = document.querySelector('button')
    button?.click()
    app.flush()
    expect(button?.textContent).toBe('Loading: 1')

    resolveRouteResponse(nodeResponse(<h1>Ready</h1>))
    await readyPromise

    expect(ready).toBe(true)
    expect(document.querySelector('button')).toBeNull()
    expect(document.querySelector('h1')?.textContent).toBe('Ready')
  })

  it('follows same-origin redirects and applies Fetch redirect method semantics', async (t) => {
    let initialUrl = window.location.href
    let routeUrl = new URL(initialUrl)
    routeUrl.searchParams.set('spa-test', 'redirect')
    window.history.replaceState(null, '', routeUrl)
    let requests: Request[] = []

    let router: SPARouter = {
      async fetch(input, init) {
        let request = input instanceof Request ? input : new Request(input, init)
        requests.push(request)
        let url = new URL(request.url)
        if (url.searchParams.get('spa-test') === 'redirect') {
          return new Response(null, {
            status: 302,
            headers: { Location: '?spa-test=redirected' },
          })
        }
        return nodeResponse(<h1>Redirected</h1>)
      },
    }
    let app = run(router)

    t.after(() => {
      app.dispose()
      window.history.replaceState(null, '', initialUrl)
    })

    await app.ready()

    expect(requests.map((request) => request.method)).toEqual(['GET', 'GET'])
    expect(document.querySelector('h1')?.textContent).toBe('Redirected')
  })
})
