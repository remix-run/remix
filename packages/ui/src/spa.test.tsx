import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock } from '@remix-run/test'

import { navigate } from './runtime/navigation.ts'
import { nodeFromResponse, nodeResponse, runSPA, type SPARouter } from './spa.ts'

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

describe('runSPA', () => {
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
    let app = runSPA({ router: { fetch } })

    t.after(() => {
      app.dispose()
      window.history.replaceState(null, '', initialUrl)
    })

    await app.ready()

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(document.querySelector('h1')?.textContent).toBe('initial')
  })

  it('lets an early navigation supersede the initial route load', async (t) => {
    let initialUrl = window.location.href
    let initialRouteUrl = new URL(initialUrl)
    initialRouteUrl.searchParams.set('spa-test', 'slow')
    window.history.replaceState(null, '', initialRouteUrl)
    let nextRouteUrl = new URL(initialUrl)
    nextRouteUrl.searchParams.set('spa-test', 'next')

    let initialRequest: Request | undefined
    let initialStarted = Promise.withResolvers<void>()
    let fetch = mock.fn(async (input: string | URL | Request, init?: RequestInit) => {
      let request = input instanceof Request ? input : new Request(input, init)
      if (new URL(request.url).searchParams.get('spa-test') === 'slow') {
        initialRequest = request
        initialStarted.resolve()
        await new Promise<void>((_resolve, reject) => {
          request.signal.addEventListener('abort', () => reject(request.signal.reason), {
            once: true,
          })
        })
      }
      return nodeResponse(<h1>{new URL(request.url).searchParams.get('spa-test')}</h1>)
    })
    let app = runSPA({ router: { fetch } })

    t.after(async () => {
      app.dispose()
      window.history.replaceState(null, '', initialUrl)
    })

    await initialStarted.promise
    await navigate(nextRouteUrl.href, { history: 'replace' })
    await app.ready()

    expect(initialRequest?.signal.aborted).toBe(true)
    expect(document.querySelector('h1')?.textContent).toBe('next')
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
    let app = runSPA({ router })

    t.after(() => {
      app.dispose()
      window.history.replaceState(null, '', initialUrl)
    })

    await app.ready()

    expect(requests.map((request) => request.method)).toEqual(['GET', 'GET'])
    expect(new URL(window.location.href).searchParams.get('spa-test')).toBe('redirected')
    expect(document.querySelector('h1')?.textContent).toBe('Redirected')
  })
})
