import { expect } from '@remix-run/assert'
import { createContextKey, createRouter, type Middleware } from '@remix-run/fetch-router'
import { afterEach, describe, it, mock } from '@remix-run/test'
import { on, type Handle } from '@remix-run/ui'
import { nodeFromSpaResponse, spaResponse } from '@remix-run/ui'

import { render, run, type Router } from './spa.ts'

const Greeting = createContextKey<string>()

function greeting(value: string): Middleware<{
  key: typeof Greeting
  value: string
  property: 'greeting'
}> {
  return async (context, next) => {
    context.set(Greeting, value, { property: 'greeting' })
    return next()
  }
}

describe('render', () => {
  it('adds a request-aware node renderer to an ordinary router context', async () => {
    let router = createRouter({
      middleware: [
        render((node, context) => `${context.url.pathname}: ${node}`),
        greeting('Hello'),
      ],
    })

    router.get('/hello', ({ greeting, render }) => {
      let value: string = greeting
      return render(value, { status: 201 })
    })

    let response = await router.fetch('https://remix.run/hello')

    expect(response.status).toBe(201)
    expect(nodeFromSpaResponse(response)).toBe('/hello: Hello')
  })

  it('makes the renderer available to the default handler', async () => {
    let router = createRouter({
      middleware: [render()],
      defaultHandler: ({ render }) => render('Not Found', { status: 404 }),
    })

    let response = await router.fetch('https://remix.run/missing')

    expect(response.status).toBe(404)
    expect(nodeFromSpaResponse(response)).toBe('Not Found')
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
      return spaResponse(<h1>{new URL(request.url).searchParams.get('spa-test')}</h1>)
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

    resolveRouteResponse(spaResponse(<h1>Ready</h1>))
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

    let router: Router = {
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
        return spaResponse(<h1>Redirected</h1>)
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

function withResolvers<value>(): [Promise<value>, (value: value) => void] {
  let resolve: (value: value) => void = () => {}
  let promise = new Promise<value>((promiseResolve) => {
    resolve = promiseResolve
  })
  return [promise, resolve]
}
