import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter, type MiddlewareContext } from '@remix-run/fetch-router'

import { Renderer, renderWith, type AnyRenderer, type Renderer as RendererType } from '../index.ts'

type IsEqual<left, right> =
  (<type>() => type extends left ? 1 : 2) extends <type>() => type extends right ? 1 : 2
    ? true
    : false

function expectTypeEquality<_check extends true>() {}

describe('renderWith', () => {
  it('adds a renderer to request context', async () => {
    let middleware = renderWith(
      () =>
        function render(value: string, init?: ResponseInit) {
          return new Response(value, init)
        },
    )
    let router = createRouter({ middleware: [middleware] as const })

    router.get('/', (context) => {
      let renderer = context.get(Renderer)

      expectTypeEquality<
        IsEqual<typeof renderer, (value: string, init?: ResponseInit) => Response>
      >()

      return renderer('Hello', { status: 201 })
    })

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 201)
    assert.equal(await response.text(), 'Hello')
  })

  it('creates a request-scoped renderer from the current request context', async () => {
    let middleware = renderWith(
      (context) =>
        function render(value: string) {
          return new Response(`${context.url.pathname}:${value}`)
        },
    )
    let router = createRouter({ middleware: [middleware] as const })

    router.get('/rendered', (context) => context.get(Renderer)('OK'))

    let response = await router.fetch('https://remix.run/rendered')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), '/rendered:OK')
  })

  it('preserves custom renderer input and options types', async () => {
    let middleware = renderWith(
      () =>
        function render(value: { ok: boolean }, init?: ResponseInit & { pretty?: boolean }) {
          let body = init?.pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)

          return new Response(body, {
            ...init,
            headers: {
              'Content-Type': 'application/json',
              ...init?.headers,
            },
          })
        },
    )
    let router = createRouter({ middleware: [middleware] as const })

    router.get('/json', (context) => context.get(Renderer)({ ok: true }, { pretty: true }))

    let response = await router.fetch('https://remix.run/json')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/json')
    assert.equal(await response.text(), '{\n  "ok": true\n}')
  })

  it('derives renderer context from middleware', () => {
    let json = renderWith(
      () =>
        function render(value: { ok: boolean }) {
          return Response.json(value)
        },
    )
    type JsonContext = MiddlewareContext<[typeof json]>

    function assertContext(context: JsonContext) {
      let renderer = context.get(Renderer)

      expectTypeEquality<IsEqual<typeof renderer, (value: { ok: boolean }) => Response>>()

      renderer({ ok: true })

      // @ts-expect-error Renderer input is checked.
      renderer('no')
    }

    void assertContext
  })
})

if (false as boolean) {
  let middleware = renderWith(
    () =>
      function render(value: number) {
        return new Response(String(value))
      },
  )
  type AppContext = MiddlewareContext<[typeof middleware]>

  function assertContext(context: AppContext) {
    let renderer = context.get(Renderer)

    renderer(1)

    // @ts-expect-error Renderer input is checked.
    renderer('1')
  }

  let renderer: AnyRenderer = function render(_value: never) {
    return new Response()
  }
  let typedRenderer: RendererType<number> = function render(value) {
    return new Response(String(value))
  }

  void assertContext
  void renderer
  void typedRenderer
}
