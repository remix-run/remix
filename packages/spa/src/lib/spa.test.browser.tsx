import { expect } from '@remix-run/assert'
import { createContextKey, createRouter, type Middleware } from '@remix-run/fetch-router'
import { afterEach, describe, it, mock } from '@remix-run/test'
import { on, type Handle } from '@remix-run/ui'
import { spaResponse } from '@remix-run/ui'

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
  afterEach(() => {
    document.body.textContent = ''
  })

  it('adds a request-aware node renderer to an ordinary router context', async (t) => {
    let initialUrl = window.location.href
    let routeUrl = new URL('/hello', initialUrl)
    window.history.replaceState(null, '', routeUrl)
    let router = createRouter({
      middleware: [
        render((node, context) => (
          <h1>
            {context.url.pathname}: {node}
          </h1>
        )),
        greeting('Hello'),
      ],
    })

    router.get('/hello', ({ greeting, render }) => {
      let value: string = greeting
      return render(value, { status: 201 })
    })

    let response = await router.fetch(routeUrl)
    let app = run(router)

    t.after(() => {
      app.dispose()
      window.history.replaceState(null, '', initialUrl)
    })

    await app.ready()
    expect(response.status).toBe(201)
    expect(document.querySelector('h1')?.textContent).toBe('/hello: Hello')
  })

  it('makes the renderer available to the default handler', async (t) => {
    let initialUrl = window.location.href
    let routeUrl = new URL('/missing', initialUrl)
    window.history.replaceState(null, '', routeUrl)
    let router = createRouter({
      middleware: [render()],
      defaultHandler: ({ render }) => render(<h1>Not Found</h1>, { status: 404 }),
    })

    let response = await router.fetch(routeUrl)
    let app = run(router)

    t.after(() => {
      app.dispose()
      window.history.replaceState(null, '', initialUrl)
    })

    await app.ready()
    expect(response.status).toBe(404)
    expect(document.querySelector('h1')?.textContent).toBe('Not Found')
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
      return spaResponse.create(<h1>{new URL(request.url).searchParams.get('spa-test')}</h1>)
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
    let routeResponse = Promise.withResolvers<Response>()
    let requestStarted = Promise.withResolvers<void>()
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
      requestStarted.resolve()
      return await routeResponse.promise
    })
    let app = run({ fetch }, { fallback: <Fallback /> })

    t.after(() => app.dispose())

    let readyPromise = app.ready().then(() => {
      ready = true
    })
    await requestStarted.promise

    expect(ready).toBe(false)
    expect(fallbackAtRequest).toBe('Loading: 0')
    expect(reloadStartedAtRequest).toBe(true)
    let button = document.querySelector('button')
    button?.click()
    app.flush()
    expect(button?.textContent).toBe('Loading: 1')

    routeResponse.resolve(spaResponse.create(<h1>Ready</h1>))
    await readyPromise

    expect(ready).toBe(true)
    expect(document.querySelector('button')).toBeNull()
    expect(document.querySelector('h1')?.textContent).toBe('Ready')
  })

  it('encodes text/plain form submissions with normalized line breaks', async (t) => {
    let submittedRequest = Promise.withResolvers<Request>()
    let requestCount = 0
    let router: Router = {
      async fetch(input, init) {
        let request = input instanceof Request ? input : new Request(input, init)
        requestCount++

        if (requestCount === 1) {
          return spaResponse.create(
            <form method="post" encType="text/plain">
              <textarea name="note" defaultValue={'first\nsecond'} />
              <input name="city" value="Paris" />
              <button type="submit">Submit</button>
            </form>,
          )
        }

        submittedRequest.resolve(request)
        return spaResponse.create(<h1>Submitted</h1>)
      },
    }
    let app = run(router)

    t.after(() => app.dispose())

    await app.ready()

    let form = document.querySelector('form')
    if (!form) throw new Error('Expected a form')
    form.requestSubmit()

    let request = await submittedRequest.promise
    expect(request.headers.get('Content-Type')).toBe('text/plain')
    expect(await request.text()).toBe('note=first\r\nsecond\r\ncity=Paris\r\n')
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
        return spaResponse.create(<h1>Redirected</h1>)
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
