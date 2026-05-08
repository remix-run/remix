import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter, type MiddlewareContext, type RequestContext } from '@remix-run/fetch-router'

import {
  Renderer,
  renderWith,
  type AnyRenderer,
  type ContextWithRenderer,
  type Renderer as RendererType,
} from '../index.ts'

type IsEqual<left, right> =
  (<type>() => type extends left ? 1 : 2) extends <type>() => type extends right ? 1 : 2
    ? true
    : false

function expectTypeEquality<_check extends true>() {}

describe('renderWith', () => {
  it('adds a renderer instance to request context', async () => {
    let middleware = renderWith({
      render(value: string, init?: ResponseInit) {
        return new Response(value, init)
      },
    })
    let router = createRouter({ middleware: [middleware] as const })

    router.get('/', (context) => {
      let renderer = context.get(Renderer)

      expectTypeEquality<
        IsEqual<typeof renderer.render, (value: string, init?: ResponseInit) => Response>
      >()

      return renderer.render('Hello', { status: 201 })
    })

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 201)
    assert.equal(await response.text(), 'Hello')
  })

  it('creates a request-scoped renderer from the current request context', async () => {
    let middleware = renderWith((context) => ({
      render(value: string) {
        return new Response(`${context.url.pathname}:${value}`)
      },
    }))
    let router = createRouter({ middleware: [middleware] as const })

    router.get('/rendered', (context) => context.get(Renderer).render('OK'))

    let response = await router.fetch('https://remix.run/rendered')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), '/rendered:OK')
  })

  it('preserves custom renderer input and options types', async () => {
    let middleware = renderWith({
      render(value: { ok: boolean }, init?: ResponseInit & { pretty?: boolean }) {
        let body = init?.pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)

        return new Response(body, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
          },
        })
      },
    })
    let router = createRouter({ middleware: [middleware] as const })

    router.get('/json', (context) => context.get(Renderer).render({ ok: true }, { pretty: true }))

    let response = await router.fetch('https://remix.run/json')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/json')
    assert.equal(await response.text(), '{\n  "ok": true\n}')
  })

  it('exports context helpers for explicit context composition', () => {
    type JsonRenderer = {
      render(value: { ok: boolean }): Response
    }
    type JsonContext = ContextWithRenderer<RequestContext, JsonRenderer>

    function assertContext(context: JsonContext) {
      let renderer = context.get(Renderer)

      expectTypeEquality<IsEqual<typeof renderer, JsonRenderer>>()

      renderer.render({ ok: true })

      // @ts-expect-error Renderer input is checked.
      renderer.render('no')
    }

    void assertContext
  })
})

if (false as boolean) {
  let middleware = renderWith({
    render(value: number) {
      return new Response(String(value))
    },
  })
  type AppContext = MiddlewareContext<[typeof middleware]>

  function assertContext(context: AppContext) {
    let renderer = context.get(Renderer)

    renderer.render(1)

    // @ts-expect-error Renderer input is checked.
    renderer.render('1')
  }

  let renderer: AnyRenderer = {
    render(_value: never) {
      return new Response()
    },
  }
  let typedRenderer: RendererType<number> = {
    render(value) {
      return new Response(String(value))
    },
  }

  void assertContext
  void renderer
  void typedRenderer
}
