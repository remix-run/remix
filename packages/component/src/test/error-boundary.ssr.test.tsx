import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Handle } from '../runtime/component.ts'
import { ErrorBoundary } from '../runtime/error-boundary.ts'
import { Frame } from '../runtime/frame.ts'
import { clientEntry } from '../runtime/client-entries.ts'
import { renderToStream, renderToString } from '../server/stream.ts'
import { drain, trackUnhandledRejections, withResolvers } from './utils.ts'

function Broken(): () => null {
  throw new Error('Broken render')
}

function parseRmxData(html: string): { h?: Record<string, unknown>; f?: Record<string, unknown> } {
  let match = html.match(/<script type="application\/json" id="rmx-data">(.*?)<\/script>/)
  return match ? JSON.parse(match[1]!) : {}
}

describe('ErrorBoundary server rendering', () => {
  it('renders children between boundary markers when they render', async () => {
    let html = await drain(
      renderToStream(
        <main>
          <ErrorBoundary fallback={<p>Failed</p>}>
            <p>Reviews</p>
          </ErrorBoundary>
        </main>,
      ),
    )

    expect(html).toBe('<main><!-- rmx:eb --><p>Reviews</p><!-- /rmx:eb --></main>')
  })

  it('renders the fallback in place of children that throw and renders the rest of the tree', async () => {
    let errors: unknown[] = []

    let html = await drain(
      renderToStream(
        <main>
          <h1>Book</h1>
          <ErrorBoundary fallback={<p>Reviews failed</p>}>
            <section>
              <p>Before</p>
              <Broken />
            </section>
          </ErrorBoundary>
          <footer>Footer</footer>
        </main>,
        { onError: (error) => errors.push(error) },
      ),
    )

    expect(html).toBe(
      '<main><h1>Book</h1><!-- rmx:eb:error --><p>Reviews failed</p><!-- /rmx:eb --><footer>Footer</footer></main>',
    )
    expect(errors).toHaveLength(1)
    expect((errors[0] as Error).message).toBe('Broken render')
  })

  it('passes the error and a no-op retry to a fallback function', async () => {
    let retryResult: unknown = 'not called'

    let html = await drain(
      renderToStream(
        <ErrorBoundary
          fallback={(error, retry) => {
            retryResult = retry()
            return <p>{error instanceof Error ? error.message : 'Unknown'}</p>
          }}
        >
          <Broken />
        </ErrorBoundary>,
        { onError() {} },
      ),
    )

    expect(html).toBe('<!-- rmx:eb:error --><p>Broken render</p><!-- /rmx:eb -->')
    expect(retryResult).toBeUndefined()
  })

  it('catches errors thrown by descendant setup functions', async () => {
    function Setup(handle: Handle<{ fail: boolean }>) {
      if (handle.props.fail) throw new Error('Setup failed')
      return () => <span>ok</span>
    }

    let html = await drain(
      renderToStream(
        <ErrorBoundary fallback="Failed">
          <Setup fail />
        </ErrorBoundary>,
        { onError() {} },
      ),
    )

    expect(html).toBe('<!-- rmx:eb:error -->Failed<!-- /rmx:eb -->')
  })

  it('lets the nearest boundary handle an error', async () => {
    let errors: unknown[] = []

    let html = await drain(
      renderToStream(
        <ErrorBoundary fallback="Outer">
          <div>
            <ErrorBoundary fallback="Inner">
              <Broken />
            </ErrorBoundary>
            <span>Sibling</span>
          </div>
        </ErrorBoundary>,
        { onError: (error) => errors.push(error) },
      ),
    )

    expect(html).toBe(
      '<!-- rmx:eb --><div><!-- rmx:eb:error -->Inner<!-- /rmx:eb --><span>Sibling</span></div><!-- /rmx:eb -->',
    )
    expect(errors).toHaveLength(1)
  })

  it('lets the next boundary up handle an error thrown by a fallback', async () => {
    let errors: unknown[] = []

    let html = await drain(
      renderToStream(
        <ErrorBoundary fallback={(error) => <p>Outer: {(error as Error).message}</p>}>
          <ErrorBoundary
            fallback={() => {
              throw new Error('Fallback failed')
            }}
          >
            <Broken />
          </ErrorBoundary>
        </ErrorBoundary>,
        { onError: (error) => errors.push(error) },
      ),
    )

    expect(html).toBe('<!-- rmx:eb:error --><p>Outer: Fallback failed</p><!-- /rmx:eb -->')
    expect(errors.map((error) => (error as Error).message)).toEqual([
      'Broken render',
      'Fallback failed',
    ])
  })

  it('rejects the render when no boundary handles the error', async () => {
    let errors: unknown[] = []

    let stream = renderToStream(
      <ErrorBoundary
        fallback={() => {
          throw new Error('Fallback failed')
        }}
      >
        <Broken />
      </ErrorBoundary>,
      { onError: (error) => errors.push(error) },
    )

    await expect(drain(stream)).rejects.toThrow('Fallback failed')
    expect(errors.map((error) => (error as Error).message)).toEqual([
      'Broken render',
      'Fallback failed',
    ])
  })

  it('restores element context for the fallback', async () => {
    function Throws(): () => null {
      throw new Error('Failed in svg')
    }

    let html = await drain(
      renderToStream(
        <div>
          <ErrorBoundary fallback={<p className="fallback">Failed</p>}>
            <svg viewBox="0 0 10 10">
              <g>
                <Throws />
              </g>
            </svg>
          </ErrorBoundary>
          <label htmlFor="name">Name</label>
        </div>,
        { onError() {} },
      ),
    )

    expect(html).toBe(
      '<div><!-- rmx:eb:error --><p class="fallback">Failed</p><!-- /rmx:eb --><label for="name">Name</label></div>',
    )
  })

  it('renders a document fallback when a boundary wraps the whole document', async () => {
    function Page(): () => never {
      return () => {
        throw new Error('Page failed')
      }
    }

    let html = await drain(
      renderToStream(
        <ErrorBoundary
          fallback={
            <html>
              <head>
                <title>Error</title>
              </head>
              <body>
                <h1>Something went wrong</h1>
              </body>
            </html>
          }
        >
          <html>
            <head>
              <title>Book</title>
            </head>
            <body>
              <Page />
            </body>
          </html>
        </ErrorBoundary>,
        { onError() {} },
      ),
    )

    expect(html).toBe(
      '<!-- rmx:eb:error --><html><head><title>Error</title></head><body><h1>Something went wrong</h1></body></html><!-- /rmx:eb -->',
    )
  })

  it('drops client entries rendered by failed content from hydration data', async () => {
    let Counter = clientEntry('/counter.js#Counter', function Counter() {
      return () => <button type="button">0</button>
    })

    let html = await drain(
      renderToStream(
        <div>
          <ErrorBoundary fallback="Failed">
            <Counter />
            <Broken />
          </ErrorBoundary>
          <Counter />
        </div>,
        { onError() {} },
      ),
    )

    let data = parseRmxData(html)
    expect(Object.keys(data.h ?? {})).toHaveLength(1)
    expect(html.match(/rmx:h:/g)).toHaveLength(1)
    expect(html).toContain('<!-- rmx:eb:error -->Failed<!-- /rmx:eb -->')
  })

  it('logs caught errors from renderToString instead of rejecting', async (t) => {
    let errorSpy = t.mock.method(console, 'error', () => {})

    let html = await renderToString(
      <ErrorBoundary fallback={<p>Failed</p>}>
        <Broken />
      </ErrorBoundary>,
    )

    expect(html).toBe('<!-- rmx:eb:error --><p>Failed</p><!-- /rmx:eb -->')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect((errorSpy.mock.calls[0]!.arguments[0] as Error).message).toBe('Broken render')
  })

  it('still rejects renderToString for errors outside a boundary', async () => {
    await expect(renderToString(<Broken />)).rejects.toThrow('Broken render')
  })

  it('rejects an invalid fallback', async () => {
    let errors: unknown[] = []

    let stream = renderToStream(
      // @ts-expect-error fallback must be renderable content or a function
      <ErrorBoundary fallback={{ message: 'Failed' }}>
        <Broken />
      </ErrorBoundary>,
      { onError: (error) => errors.push(error) },
    )

    await expect(drain(stream)).rejects.toThrow(
      'ErrorBoundary fallback must be a function or renderable content',
    )
  })
})

describe('ErrorBoundary streaming', () => {
  it('renders the fallback when a blocking frame inside the boundary fails to resolve', async () => {
    let errors: unknown[] = []

    let html = await drain(
      renderToStream(
        <main>
          <ErrorBoundary fallback={<p>Recommendations unavailable</p>}>
            <Frame src="/recommendations" />
          </ErrorBoundary>
          <Frame src="/footer" />
        </main>,
        {
          onError: (error) => errors.push(error),
          async resolveFrame(src) {
            if (src === '/recommendations') throw new Error('Frame failed')
            return '<footer>Footer</footer>'
          },
        },
      ),
    )

    expect(html).toContain(
      '<!-- rmx:eb:error --><p>Recommendations unavailable</p><!-- /rmx:eb -->',
    )
    expect(html).toContain('<footer>Footer</footer>')
    expect(errors.map((error) => (error as Error).message)).toEqual(['Frame failed'])
    let data = parseRmxData(html)
    expect(Object.values(data.f ?? {})).toEqual([{ status: 'resolved', src: '/footer' }])
  })

  it('renders the fallback when resolveFrame throws synchronously', async () => {
    let errors: unknown[] = []

    let html = await drain(
      renderToStream(
        <ErrorBoundary fallback="Failed">
          <Frame src="/recommendations" />
        </ErrorBoundary>,
        {
          onError: (error) => errors.push(error),
          resolveFrame() {
            throw new Error('Frame failed')
          },
        },
      ),
    )

    expect(html).toBe('<!-- rmx:eb:error -->Failed<!-- /rmx:eb -->')
    expect(errors).toHaveLength(1)
  })

  it('keeps the outer content when a nested boundary catches a frame failure', async () => {
    let html = await drain(
      renderToStream(
        <ErrorBoundary fallback="Outer">
          <section>
            <Frame src="/header" />
            <ErrorBoundary fallback={<p>Inner</p>}>
              <Frame src="/failing" />
            </ErrorBoundary>
          </section>
        </ErrorBoundary>,
        {
          onError() {},
          async resolveFrame(src) {
            if (src === '/failing') throw new Error('Frame failed')
            return '<h2>Header</h2>'
          },
        },
      ),
    )

    expect(html).toMatch(
      /^<!-- rmx:eb --><section><!-- rmx:f:\w+ --><h2>Header<\/h2><!-- \/rmx:f --><!-- rmx:eb:error --><p>Inner<\/p><!-- \/rmx:eb --><\/section><!-- \/rmx:eb -->/,
    )
  })

  it('ignores frame failures in a nested boundary that an outer boundary already replaced', async () => {
    let Counter = clientEntry('/counter.js#Counter', function Counter() {
      return () => <button type="button">0</button>
    })
    let errors: unknown[] = []

    let html = await drain(
      renderToStream(
        <ErrorBoundary fallback="Outer">
          <ErrorBoundary fallback={<Counter />}>
            <Frame src="/failing" />
          </ErrorBoundary>
          <Broken />
        </ErrorBoundary>,
        {
          onError: (error) => errors.push(error),
          async resolveFrame() {
            throw new Error('Frame failed')
          },
        },
      ),
    )

    expect(html).toBe('<!-- rmx:eb:error -->Outer<!-- /rmx:eb -->')
    expect(errors.map((error) => (error as Error).message)).toEqual(['Broken render'])
  })

  it('renders blocking frames inside a boundary when they resolve', async () => {
    let html = await drain(
      renderToStream(
        <ErrorBoundary fallback="Failed">
          <Frame src="/recommendations" />
        </ErrorBoundary>,
        { resolveFrame: () => '<p>Recommended</p>' },
      ),
    )

    expect(html).toMatch(/^<!-- rmx:eb --><!-- rmx:f:\w+ --><p>Recommended<\/p><!-- \/rmx:f -->/)
  })

  it('does not stream the tails of sibling frames when a blocking frame fails', async () => {
    let encoder = new TextEncoder()
    let sibling = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('<p>Sibling</p>'))
        controller.enqueue(encoder.encode('<p>Sibling tail</p>'))
        controller.close()
      },
    })
    let [failure, , rejectFailure] = withResolvers<string>()

    let stream = renderToStream(
      <ErrorBoundary fallback={<p>Failed</p>}>
        <Frame src="/sibling" />
        <Frame src="/failing" />
      </ErrorBoundary>,
      {
        onError() {},
        resolveFrame: (src) => (src === '/sibling' ? sibling : failure),
      },
    )
    let html = drain(stream)
    rejectFailure(new Error('Frame failed'))

    expect(await html).toBe('<!-- rmx:eb:error --><p>Failed</p><!-- /rmx:eb -->')
  })

  it('drops non-blocking frames rendered by failed content', async () => {
    let resolved: string[] = []

    let html = await drain(
      renderToStream(
        <ErrorBoundary fallback="Failed">
          <Frame src="/later" fallback={<p>Loading</p>} />
          <Broken />
        </ErrorBoundary>,
        {
          onError() {},
          resolveFrame(src) {
            resolved.push(src)
            return '<p>Later</p>'
          },
        },
      ),
    )

    expect(html).toBe('<!-- rmx:eb:error -->Failed<!-- /rmx:eb -->')
    expect(resolved).toEqual(['/later'])
  })

  it('lets the next boundary up handle a frame that fails in a fallback', async () => {
    let errors: unknown[] = []

    let html = await drain(
      renderToStream(
        <ErrorBoundary fallback="Outer">
          <ErrorBoundary fallback={<Frame src="/fallback" />}>
            <Frame src="/content" />
          </ErrorBoundary>
        </ErrorBoundary>,
        {
          onError: (error) => errors.push(error),
          async resolveFrame(src) {
            throw new Error(`Failed ${src}`)
          },
        },
      ),
    )

    expect(html).toBe('<!-- rmx:eb:error -->Outer<!-- /rmx:eb -->')
    expect(errors.map((error) => (error as Error).message)).toEqual([
      'Failed /content',
      'Failed /fallback',
    ])
  })

  it('does not render the fallback when the render is aborted', async (t) => {
    let controller = new AbortController()
    let errors: unknown[] = []
    let [frame, , rejectFrame] = withResolvers<string>()
    let flushUnhandledRejections = trackUnhandledRejections(t)

    let stream = renderToStream(
      <ErrorBoundary fallback="Failed">
        <Frame src="/slow" />
      </ErrorBoundary>,
      {
        signal: controller.signal,
        onError: (error) => errors.push(error),
        resolveFrame: () => frame,
      },
    )
    let read = stream.getReader().read()
    let abortError = new DOMException('This operation was aborted', 'AbortError')
    controller.abort(abortError)
    rejectFrame(abortError)

    await expect(read).resolves.toEqual({ done: true, value: undefined })
    expect(await flushUnhandledRejections()).toEqual([])
    expect(errors).toEqual([])
  })
})
