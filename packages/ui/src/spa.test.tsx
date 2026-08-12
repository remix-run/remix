import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock } from '@remix-run/test'

import { nodeFromResponse, nodeResponse, run, type SPARouter } from './spa.ts'

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
