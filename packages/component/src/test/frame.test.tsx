import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Handle } from '../lib/component.ts'
import { Frame } from '../lib/component.ts'
import { clientEntry } from '../lib/client-entries.ts'
import { run } from '../lib/run.ts'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'
import { renderToStream } from '../lib/stream.ts'
import { drain, readChunks, withResolvers } from './utils.ts'

function getCommentMarkerId(html: string, prefix: 'rmx:f:' | 'rmx:h:'): string {
  let re = prefix === 'rmx:f:' ? /<!--\s*rmx:f:([^ ]+)\s*-->/ : /<!--\s*rmx:h:([^ ]+)\s*-->/
  let match = html.match(re)
  invariant(match, `Expected comment marker "${prefix}"`)
  return match[1]!
}

function streamFromChunks(chunks: Array<string | Promise<string>>): ReadableStream<Uint8Array> {
  let encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (let chunk of chunks) {
        let value = typeof chunk === 'string' ? chunk : await chunk
        controller.enqueue(encoder.encode(value))
      }
      controller.close()
    },
  })
}

describe('run', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    for (let node of Array.from(document.head.childNodes)) {
      document.head.removeChild(node)
    }
  })

  it('hydrates a single component', async () => {
    let Counter = clientEntry(
      '/js/counter.js#Counter',
      function Counter(handle: Handle, setup: number) {
        let count = setup
        return () => (
          <button
            on={{
              click: () => {
                count++
                handle.update()
              },
            }}
          >
            Count: {count}
          </button>
        )
      },
    )

    let stream = renderToStream(<Counter setup={5} />)
    let html = await drain(stream)

    document.body.innerHTML = html

    let loadModule = vi.fn().mockResolvedValue(Counter)

    let frame = run(document, { loadModule })
    await frame.ready()

    expect(loadModule).toHaveBeenCalledWith('/js/counter.js', 'Counter')

    let button = document.querySelector('button')
    expect(button?.textContent).toBe('Count: 5')

    button?.click()
    frame.flush()

    expect(button?.textContent).toBe('Count: 6')

    frame.dispose()
  })

  it('hydrates multiple components', async () => {
    let Button = clientEntry('/js/button.js#Button', function Button(handle: Handle) {
      let clicked = false
      return ({ text }: { text: string }) => (
        <button
          on={{
            click: () => {
              clicked = true
              handle.update()
            },
          }}
        >
          {clicked ? `${text} clicked!` : text}
        </button>
      )
    })

    let stream = renderToStream(
      <div>
        <Button text="First" />
        <Button text="Second" />
      </div>,
    )
    let html = await drain(stream)

    document.body.innerHTML = html

    let loadModule = vi.fn().mockResolvedValue(Button)

    let frame = run(document, { loadModule })
    await frame.ready()

    // Module is cached by moduleUrl+exportName
    expect(loadModule).toHaveBeenCalledTimes(1)

    let buttons = document.querySelectorAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.textContent).toBe('First')
    expect(buttons[1]?.textContent).toBe('Second')

    buttons[0]?.click()
    frame.flush()

    expect(buttons[0]?.textContent).toBe('First clicked!')
    expect(buttons[1]?.textContent).toBe('Second')

    frame.dispose()
  })

  it('hydrates ready modules before slower modules while ready() stays pending', async () => {
    let Fast = clientEntry('/js/fast.js#Fast', function Fast(handle: Handle) {
      let clicked = false
      return () => (
        <button
          id="fast"
          on={{
            click() {
              clicked = true
              handle.update()
            },
          }}
        >
          {clicked ? 'Fast!' : 'Fast'}
        </button>
      )
    })

    let Slow = clientEntry('/js/slow.js#Slow', function Slow(handle: Handle) {
      let clicked = false
      return () => (
        <button
          id="slow"
          on={{
            click() {
              clicked = true
              handle.update()
            },
          }}
        >
          {clicked ? 'Slow!' : 'Slow'}
        </button>
      )
    })

    let html = await drain(
      renderToStream(
        <div>
          <Fast />
          <Slow />
        </div>,
      ),
    )
    document.body.innerHTML = html

    let [slowModulePromise, resolveSlowModule] = withResolvers<Function>()
    let loadModule = vi.fn().mockImplementation((moduleUrl: string, exportName: string) => {
      if (moduleUrl === '/js/fast.js' && exportName === 'Fast') return Fast
      if (moduleUrl === '/js/slow.js' && exportName === 'Slow') return slowModulePromise
      throw new Error(`Unexpected module request: ${moduleUrl}#${exportName}`)
    })

    let app = run(document, { loadModule })

    let readySettled = false
    let readyPromise = app.ready().then(() => {
      readySettled = true
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    let fastButton = document.getElementById('fast')
    let slowButton = document.getElementById('slow')
    invariant(fastButton instanceof HTMLButtonElement)
    invariant(slowButton instanceof HTMLButtonElement)

    fastButton.click()
    app.flush()
    expect(fastButton.textContent).toBe('Fast!')

    slowButton.click()
    app.flush()
    expect(slowButton.textContent).toBe('Slow')

    expect(readySettled).toBe(false)

    resolveSlowModule(Slow)
    await readyPromise

    slowButton.click()
    app.flush()
    expect(slowButton.textContent).toBe('Slow!')

    app.dispose()
  })

  it('handles complex props', async () => {
    let Card = clientEntry('/js/card.js#Card', function Card() {
      return (props: { title: string; count: number; enabled: boolean; items: string[] }) => (
        <div>
          <h2>{props.title}</h2>
          <p>Count: {props.count}</p>
          <p>Enabled: {String(props.enabled)}</p>
          <ul>
            {props.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )
    })

    let stream = renderToStream(
      <Card title="Test" count={42} enabled={true} items={['one', 'two', 'three']} />,
    )
    let html = await drain(stream)

    document.body.innerHTML = html

    let loadModule = vi.fn().mockResolvedValue(Card)

    let frame = run(document, { loadModule })
    await frame.ready()

    expect(loadModule).toHaveBeenCalledWith('/js/card.js', 'Card')
    expect(document.querySelector('h2')?.textContent).toBe('Test')
    expect(document.querySelector('p')?.textContent).toBe('Count: 42')
    expect(document.querySelectorAll('li')).toHaveLength(3)

    frame.dispose()
  })

  it('ready() does not wait for hydration markers from later frame templates', async () => {
    let Initial = clientEntry('/js/initial.js#Initial', function Initial(handle: Handle) {
      let clicked = false
      return () => (
        <button
          id="initial"
          on={{
            click() {
              clicked = true
              handle.update()
            },
          }}
        >
          {clicked ? 'Initial!' : 'Initial'}
        </button>
      )
    })

    let Late = clientEntry('/js/late.js#Late', function Late(handle: Handle) {
      let clicked = false
      return () => (
        <button
          id="late"
          on={{
            click() {
              clicked = true
              handle.update()
            },
          }}
        >
          {clicked ? 'Late!' : 'Late'}
        </button>
      )
    })

    let pageStream = renderToStream(
      <div>
        <Initial />
        <Frame src="/late-frame" fallback={<span id="frame-fallback">Loading…</span>} />
      </div>,
      { resolveFrame: () => new Promise<string>(() => {}) },
    )
    let pageChunks = readChunks(pageStream)
    let first = await pageChunks.next()
    invariant(!first.done)
    document.body.innerHTML = first.value

    let frameId = getCommentMarkerId(first.value, 'rmx:f:')
    let [lateModulePromise, resolveLateModule] = withResolvers<Function>()

    let loadModule = vi.fn().mockImplementation((moduleUrl: string, exportName: string) => {
      if (moduleUrl === '/js/initial.js' && exportName === 'Initial') return Initial
      if (moduleUrl === '/js/late.js' && exportName === 'Late') return lateModulePromise
      throw new Error(`Unexpected module request: ${moduleUrl}#${exportName}`)
    })

    let app = run(document, { loadModule })
    await app.ready()

    // Only initial adopted-document markers block ready().
    expect(loadModule).toHaveBeenCalledTimes(1)

    let template = document.createElement('template')
    template.id = frameId
    template.innerHTML = await drain(renderToStream(<Late />))
    document.body.appendChild(template)

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Late template markers hydrate after ready() and are not part of initial barrier.
    expect(loadModule).toHaveBeenCalledTimes(2)

    let lateButton = document.getElementById('late')
    invariant(lateButton instanceof HTMLButtonElement)
    lateButton.click()
    app.flush()
    expect(lateButton.textContent).toBe('Late')

    resolveLateModule(Late)
    await new Promise((resolve) => setTimeout(resolve, 0))

    lateButton.click()
    app.flush()
    expect(lateButton.textContent).toBe('Late!')

    app.dispose()
  })

  it('does nothing when no rmx-data script exists', async () => {
    document.body.innerHTML = '<div>No hydration here</div>'

    let loadModule = vi.fn()

    let frame = run(document, { loadModule })
    await frame.ready()

    expect(loadModule).not.toHaveBeenCalled()

    frame.dispose()
  })

  it('does nothing when rmx-data has no hydration data', async () => {
    document.body.innerHTML = `
      <div>Static content</div>
      <script type="application/json" id="rmx-data">{}</script>
    `

    let loadModule = vi.fn()

    let frame = run(document, { loadModule })
    await frame.ready()

    expect(loadModule).not.toHaveBeenCalled()

    frame.dispose()
  })

  it('adopts existing DOM nodes during hydration', async () => {
    let Counter = clientEntry('/js/counter.js#Counter', function Counter() {
      return () => (
        <div>
          <span>Static text</span>
        </div>
      )
    })

    let stream = renderToStream(<Counter />)
    let html = await drain(stream)

    document.body.innerHTML = html

    let existingSpan = document.querySelector('span')
    expect(existingSpan).toBeTruthy()

    let loadModule = vi.fn().mockResolvedValue(Counter)

    let frame = run(document, { loadModule })
    await frame.ready()

    let spanAfterHydration = document.querySelector('span')
    expect(spanAfterHydration).toBe(existingSpan)

    frame.dispose()
  })

  it('replaces pending frame regions when streamed templates arrive', async () => {
    let stream = renderToStream(
      <div>
        <h1>Title</h1>
        <Frame src="/x" fallback={<nav>Loading...</nav>} />
        <p>Main</p>
      </div>,
      { resolveFrame: () => '<nav>Loaded</nav>' },
    )

    let chunks = readChunks(stream)
    let first = await chunks.next()
    invariant(!first.done)
    document.body.innerHTML = first.value

    let h1 = document.querySelector('h1')
    let p = document.querySelector('p')
    let nav = document.querySelector('nav')
    invariant(h1 && p && nav)
    expect(nav.textContent).toBe('Loading...')

    let frame = run(document, { loadModule: vi.fn() })
    await frame.ready()

    let second = await chunks.next()
    invariant(!second.done)
    document.body.insertAdjacentHTML('beforeend', second.value)

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector('h1')).toBe(h1)
    expect(document.querySelector('p')).toBe(p)
    expect(document.querySelector('nav')).toBe(nav)
    expect(nav.textContent).toBe('Loaded')

    frame.dispose()
  })

  it('merges hydration data across multiple rmx-data scripts', async () => {
    function A(handle: Handle) {
      let clicked = false
      return () => (
        <button
          id="a"
          on={{
            click() {
              clicked = true
              handle.update()
            },
          }}
        >
          {clicked ? 'A!' : 'A'}
        </button>
      )
    }

    function B(handle: Handle) {
      let clicked = false
      return () => (
        <button
          id="b"
          on={{
            click() {
              clicked = true
              handle.update()
            },
          }}
        >
          {clicked ? 'B!' : 'B'}
        </button>
      )
    }

    document.body.innerHTML = `
      <!-- rmx:h:h1 --><button id="a">A</button><!-- /rmx:h -->
      <!-- rmx:h:h2 --><button id="b">B</button><!-- /rmx:h -->
      <script type="application/json" id="rmx-data">
        {"h":{"h1":{"moduleUrl":"/a.js","exportName":"A","props":{}}}}
      </script>
      <script type="application/json" id="rmx-data">
        {"h":{"h2":{"moduleUrl":"/b.js","exportName":"B","props":{}}}}
      </script>
    `

    let loadModule = vi.fn().mockImplementation((moduleUrl: string, exportName: string) => {
      if (moduleUrl === '/a.js' && exportName === 'A') return A
      if (moduleUrl === '/b.js' && exportName === 'B') return B
      throw new Error(`Unexpected module request: ${moduleUrl}#${exportName}`)
    })

    let frame = run(document, { loadModule })
    await frame.ready()

    expect(loadModule).toHaveBeenCalledTimes(2)

    let a = document.getElementById('a')
    let b = document.getElementById('b')
    invariant(a instanceof HTMLButtonElement)
    invariant(b instanceof HTMLButtonElement)

    expect(a.textContent).toBe('A')
    expect(b.textContent).toBe('B')

    a.click()
    b.click()
    frame.flush()

    expect(a.textContent).toBe('A!')
    expect(b.textContent).toBe('B!')

    frame.dispose()
  })

  it('ignores prototype-polluting keys when merging rmx-data scripts', async () => {
    function A() {
      return () => <button id="a">A</button>
    }

    document.body.innerHTML = `
      <!-- rmx:h:h1 --><button id="a">A</button><!-- /rmx:h -->
      <!-- rmx:h:h2 --><button id="b">B</button><!-- /rmx:h -->
      <script type="application/json" id="rmx-data">
        {"h":{"__proto__":{"h2":{"moduleUrl":"/evil.js","exportName":"Evil","props":{}}}}}
      </script>
      <script type="application/json" id="rmx-data">
        {"h":{"h1":{"moduleUrl":"/a.js","exportName":"A","props":{}}}}
      </script>
    `

    let loadModule = vi.fn().mockImplementation((moduleUrl: string, exportName: string) => {
      if (moduleUrl === '/a.js' && exportName === 'A') return A
      throw new Error(`Unexpected module request: ${moduleUrl}#${exportName}`)
    })

    let frame = run(document, { loadModule })
    await frame.ready()

    expect(loadModule).toHaveBeenCalledTimes(1)
    expect(loadModule).toHaveBeenCalledWith('/a.js', 'A')

    frame.dispose()
  })

  it('reloads a frame region and preserves static DOM nodes', async () => {
    let renderCount = 0

    let reload: undefined | (() => Promise<AbortSignal>)

    let ReloadButton = clientEntry('/assets/reload.js#Reload', function Reload(handle: Handle) {
      reload = () => handle.frame.reload()
      return () => <button>Reload</button>
    })

    async function renderTimeFragment() {
      renderCount++
      let stream = renderToStream(
        <section>
          <h2>Activity</h2>
          <p>Server: {renderCount}</p>
          <ul>
            <li>First</li>
            <li>Second</li>
          </ul>
          <ReloadButton />
        </section>,
        {
          onError(error) {
            console.error(error)
          },
        },
      )
      return await drain(stream)
    }

    let stream = renderToStream(
      <main>
        <Frame src="/time" fallback={<div>Loading…</div>} />
      </main>,
      { resolveFrame: renderTimeFragment },
    )

    let html = await drain(stream)
    document.body.innerHTML = html

    // Ensure template exists so the pending frame can render immediately.
    let frameId = getCommentMarkerId(html, 'rmx:f:')
    expect(document.querySelector(`template#${frameId}`)).toBeTruthy()

    let clientFrame = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload.js' && exportName === 'Reload') return ReloadButton
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: renderTimeFragment,
    })

    await clientFrame.ready()

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector('p')?.textContent).toBe('Server: 1')
    invariant(reload)

    // Capture references to every element before reload.
    let section = document.querySelector('section')
    let heading = document.querySelector('h2')
    let paragraph = document.querySelector('p')
    let list = document.querySelector('ul')
    let items = document.querySelectorAll('li')
    let button = document.querySelector('button')
    invariant(section && heading && paragraph && list && button)
    invariant(items.length === 2)

    await reload()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Dynamic text updated.
    expect(document.querySelector('p')?.textContent).toBe('Server: 2')

    // Static elements are the exact same DOM nodes — not replaced.
    expect(document.querySelector('section')).toBe(section)
    expect(document.querySelector('h2')).toBe(heading)
    expect(document.querySelector('p')).toBe(paragraph)
    expect(document.querySelector('ul')).toBe(list)
    expect(document.querySelectorAll('li')[0]).toBe(items[0])
    expect(document.querySelectorAll('li')[1]).toBe(items[1])
    expect(document.querySelector('button')).toBe(button)

    // Static text preserved.
    expect(heading.textContent).toBe('Activity')
    expect(items[0].textContent).toBe('First')
    expect(items[1].textContent).toBe('Second')

    clientFrame.dispose()
  })

  it('clears frame content when reload resolves to an empty stream', async () => {
    let reload: undefined | (() => Promise<AbortSignal>)

    let ReloadButton = clientEntry(
      '/assets/reload-empty.js#ReloadEmpty',
      function ReloadEmpty(handle: Handle) {
        reload = () => handle.frame.reload()
        return () => <button id="reload-empty">Reload empty</button>
      },
    )

    async function renderInitial(): Promise<string> {
      return await drain(
        renderToStream(
          <section id="frame-content">
            <p id="frame-value">Initial content</p>
            <ReloadButton />
          </section>,
        ),
      )
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame src="/reload-empty" fallback={<div>Loading…</div>} />
        </main>,
        { resolveFrame: renderInitial },
      ),
    )
    document.body.innerHTML = html

    let clientFrame = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-empty.js' && exportName === 'ReloadEmpty') {
          return ReloadButton
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src !== '/reload-empty') throw new Error(`Unexpected frame src: ${src}`)
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close()
          },
        })
      },
    })

    await clientFrame.ready()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.getElementById('frame-value')?.textContent).toBe('Initial content')

    invariant(reload)
    await reload()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById('frame-content')).toBeNull()
    expect(document.getElementById('frame-value')).toBeNull()

    clientFrame.dispose()
  })

  it('looks up named adjacent frames from handle.frames.get(name)', async () => {
    let summaryRenderCount = 0
    let reloadSummary: undefined | (() => Promise<void>)

    let RowAction = clientEntry(
      '/assets/row-action.js#RowAction',
      function RowAction(handle: Handle) {
        reloadSummary = async () => {
          expect(handle.frames.get('missing-frame')).toBeUndefined()
          await handle.frames.get('cart-summary')?.reload()
        }
        return () => <button id="row-action">Update</button>
      },
    )

    async function resolveFrame(src: string) {
      if (src === '/summary') {
        summaryRenderCount++
        let stream = renderToStream(<p id="summary">Summary: {summaryRenderCount}</p>)
        return await drain(stream)
      }
      if (src === '/row') {
        let stream = renderToStream(<RowAction />)
        return await drain(stream)
      }
      return '<p>Unexpected frame</p>'
    }

    let stream = renderToStream(
      <main>
        <Frame name="cart-summary" src="/summary" fallback={<div>Loading summary…</div>} />
        <Frame src="/row" fallback={<div>Loading row…</div>} />
      </main>,
      { resolveFrame },
    )

    let html = await drain(stream)
    document.body.innerHTML = html

    let clientFrame = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/row-action.js' && exportName === 'RowAction') return RowAction
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame,
    })

    await clientFrame.ready()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector('#summary')?.textContent).toBe('Summary: 1')

    invariant(reloadSummary)
    await reloadSummary()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector('#summary')?.textContent).toBe('Summary: 2')

    clientFrame.dispose()
  })

  it('exposes the root frame as handle.frames.top', async () => {
    let assertTopFrame: undefined | (() => void)

    let ReloadTop = clientEntry(
      '/assets/reload-top.js#ReloadTop',
      function ReloadTop(handle: Handle) {
        assertTopFrame = () => {
          expect(handle.frames.top).not.toBe(handle.frame)
        }
        return () => <button id="reload-top">Check top frame</button>
      },
    )

    async function renderInner() {
      let stream = renderToStream(<ReloadTop />)
      return await drain(stream)
    }
    document.body.innerHTML = await drain(
      renderToStream(
        <main>
          <Frame src="/inner" />
        </main>,
        {
          resolveFrame(src: string) {
            if (src === '/inner') return renderInner()
            throw new Error(`Unexpected page frame src: ${src}`)
          },
        },
      ),
    )

    let app = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-top.js' && exportName === 'ReloadTop') {
          return ReloadTop
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      async resolveFrame(src: string) {
        if (src === '/inner') {
          return await renderInner()
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()
    await new Promise((resolve) => setTimeout(resolve, 0))

    invariant(assertTopFrame)
    assertTopFrame()
    app.dispose()
  })

  it('dispatches reloadStart and reloadComplete events for handle.frame and handle.frames.get(name)', async () => {
    let summaryReloadStartEvents = 0
    let rowReloadStartEvents = 0
    let summaryReloadCompleteEvents = 0
    let rowReloadCompleteEvents = 0
    let triggerReloads: undefined | (() => Promise<void>)
    let summaryRenderCount = 0

    let RowAction = clientEntry(
      '/assets/reload-events.js#ReloadEvents',
      function ReloadEvents(handle: Handle) {
        triggerReloads = async () => {
          let summaryFrame = handle.frames.get('cart-summary')
          invariant(summaryFrame)
          summaryFrame.addEventListener(
            'reloadStart',
            () => {
              summaryReloadStartEvents++
            },
            { once: true },
          )
          summaryFrame.addEventListener(
            'reloadComplete',
            () => {
              summaryReloadCompleteEvents++
            },
            { once: true },
          )
          handle.frame.addEventListener(
            'reloadStart',
            () => {
              rowReloadStartEvents++
            },
            { once: true },
          )
          handle.frame.addEventListener(
            'reloadComplete',
            () => {
              rowReloadCompleteEvents++
            },
            { once: true },
          )
          await Promise.all([summaryFrame.reload(), handle.frame.reload()])
        }

        return () => <button id="reload-events">Reload events</button>
      },
    )

    async function resolveFrame(src: string) {
      if (src === '/summary') {
        summaryRenderCount++
        return await drain(renderToStream(<p id="summary-events">Summary: {summaryRenderCount}</p>))
      }
      if (src === '/row') {
        return await drain(renderToStream(<RowAction />))
      }
      throw new Error(`Unexpected frame src: ${src}`)
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame name="cart-summary" src="/summary" fallback={<div>Loading summary…</div>} />
          <Frame src="/row" fallback={<div>Loading row…</div>} />
        </main>,
        { resolveFrame },
      ),
    )
    document.body.innerHTML = html

    let app = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-events.js' && exportName === 'ReloadEvents') {
          return RowAction
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame,
    })

    await app.ready()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById('summary-events')?.textContent).toBe('Summary: 1')

    invariant(triggerReloads)
    await triggerReloads()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(summaryReloadStartEvents).toBe(1)
    expect(rowReloadStartEvents).toBe(1)
    expect(summaryReloadCompleteEvents).toBe(1)
    expect(rowReloadCompleteEvents).toBe(1)
    expect(document.getElementById('summary-events')?.textContent).toBe('Summary: 2')

    app.dispose()
  })

  it('reloads a frame region when the response uses css props', async () => {
    let renderCount = 0

    let reload: undefined | (() => Promise<AbortSignal>)

    let ReloadButton = clientEntry(
      '/assets/reload-css.js#ReloadCss',
      function ReloadCss(handle: Handle) {
        reload = () => handle.frame.reload()
        return () => <button css={{ color: '#fff' }}>Reload</button>
      },
    )

    async function renderTimeFragmentWithCss() {
      renderCount++
      let stream = renderToStream(
        <section css={{ padding: 8 }}>
          <p css={{ margin: 0 }}>Server: {renderCount}</p>
          <ReloadButton />
        </section>,
        {
          onError(error) {
            console.error(error)
          },
        },
      )
      return await drain(stream)
    }

    let stream = renderToStream(
      <main>
        <Frame src="/time-css" fallback={<div>Loading…</div>} />
      </main>,
      { resolveFrame: renderTimeFragmentWithCss },
    )

    let html = await drain(stream)
    document.body.innerHTML = html

    let frameId = getCommentMarkerId(html, 'rmx:f:')
    expect(document.querySelector(`template#${frameId}`)).toBeTruthy()

    let clientFrame = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-css.js' && exportName === 'ReloadCss') return ReloadButton
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: renderTimeFragmentWithCss,
    })

    await clientFrame.ready()

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector('p')?.textContent).toBe('Server: 1')
    invariant(reload)

    let section = document.querySelector('section')
    let paragraph = document.querySelector('p')
    let button = document.querySelector('button')
    invariant(section && paragraph && button)

    await reload()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.querySelector('p')?.textContent).toBe('Server: 2')

    // Regression guard: reload should preserve node identity even with css-prop styles.
    expect(document.querySelector('section')).toBe(section)
    expect(document.querySelector('p')).toBe(paragraph)
    expect(document.querySelector('button')).toBe(button)

    clientFrame.dispose()
  })

  it('aborts stale frame reloads when reload is re-entered', async () => {
    let reload: undefined | (() => Promise<AbortSignal>)
    let callCount = 0
    let firstSignal: AbortSignal | undefined
    let secondSignal: AbortSignal | undefined
    let [firstReloadContent, resolveFirstReloadContent] = withResolvers<string>()
    let [secondReloadContent, resolveSecondReloadContent] = withResolvers<string>()

    let ReloadButton = clientEntry(
      '/assets/reload-abort.js#ReloadAbort',
      function ReloadAbort(handle: Handle) {
        reload = () => handle.frame.reload()
        return () => <button id="reload-abort">Reload abort</button>
      },
    )

    async function renderInitial() {
      return await drain(
        renderToStream(
          <section>
            <p id="reload-value">Initial</p>
            <ReloadButton />
          </section>,
        ),
      )
    }

    let html = await drain(
      renderToStream(
        <main>
          <Frame src="/reload-abort" fallback={<div>Loading…</div>} />
        </main>,
        { resolveFrame: renderInitial },
      ),
    )
    document.body.innerHTML = html

    let clientFrame = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-abort.js' && exportName === 'ReloadAbort') {
          return ReloadButton
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string, signal?: AbortSignal) {
        if (src !== '/reload-abort') throw new Error(`Unexpected frame src: ${src}`)
        callCount++
        if (callCount === 1) {
          firstSignal = signal
          return firstReloadContent
        }
        if (callCount === 2) {
          secondSignal = signal
          return secondReloadContent
        }
        throw new Error(`Unexpected reload call count: ${callCount}`)
      },
    })

    await clientFrame.ready()
    await new Promise((resolve) => setTimeout(resolve, 0))

    invariant(reload)

    let firstReloadPromise = reload()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(firstSignal?.aborted).toBe(false)

    let secondReloadPromise = reload()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(firstSignal?.aborted).toBe(true)
    expect(secondSignal?.aborted).toBe(false)

    resolveFirstReloadContent('<section><p id="reload-value">Stale</p></section>')
    let firstReturnedSignal = await firstReloadPromise
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(firstReturnedSignal).toBe(firstSignal)
    expect(firstReturnedSignal.aborted).toBe(true)

    // First reload should be ignored because it was superseded.
    expect(document.getElementById('reload-value')?.textContent).toBe('Initial')

    resolveSecondReloadContent('<section><p id="reload-value">Fresh</p></section>')
    let secondReturnedSignal = await secondReloadPromise
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(secondReturnedSignal).toBe(secondSignal)
    expect(secondReturnedSignal.aborted).toBe(false)

    expect(document.getElementById('reload-value')?.textContent).toBe('Fresh')
    clientFrame.dispose()
  })

  it('hoists head-managed elements when a frame reloads', async () => {
    let renderCount = 0
    let reload: undefined | (() => Promise<AbortSignal>)

    let ReloadButton = clientEntry(
      '/assets/reload-head.js#ReloadHead',
      function ReloadHead(handle: Handle) {
        reload = () => handle.frame.reload()
        return () => <button id="reload-head">Reload head</button>
      },
    )

    async function renderHeadFragment() {
      renderCount++
      let stream = renderToStream(
        <>
          <title>Frame title {renderCount}</title>
          <meta name="frame-description" content={`frame-${renderCount}`} />
          <script type="application/ld+json">{`{"count":${renderCount}}`}</script>
          <script type="text/javascript">{`window.__frameRegular = ${renderCount}`}</script>
          <section>
            <p>Frame body {renderCount}</p>
            <ReloadButton />
          </section>
        </>,
      )

      return await drain(stream)
    }

    let stream = renderToStream(
      <main>
        <Frame src="/head-frame" fallback={<div>Loading…</div>} />
      </main>,
      { resolveFrame: renderHeadFragment },
    )

    let html = await drain(stream)
    document.body.innerHTML = html

    let frameId = getCommentMarkerId(html, 'rmx:f:')
    expect(document.querySelector(`template#${frameId}`)).toBeTruthy()

    let clientFrame = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-head.js' && exportName === 'ReloadHead')
          return ReloadButton
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: renderHeadFragment,
    })

    await clientFrame.ready()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.head.querySelector('title')?.textContent).toBe('Frame title 1')
    expect(
      document.head.querySelector('meta[name="frame-description"]')?.getAttribute('content'),
    ).toBe('frame-1')
    expect(document.head.querySelector('script[type="application/ld+json"]')?.textContent).toBe(
      '{"count":1}',
    )
    expect(document.head.querySelector('script[type="text/javascript"]')).toBeNull()
    expect(document.querySelector('main script[type="text/javascript"]')).toBeTruthy()
    expect(document.querySelector('main title')).toBeNull()
    expect(document.querySelector('main meta[name="frame-description"]')).toBeNull()
    expect(document.querySelector('main script[type="application/ld+json"]')).toBeNull()

    invariant(reload)
    await reload()
    await new Promise((resolve) => setTimeout(resolve, 0))

    let titles = document.head.querySelectorAll('title')
    expect(titles).toHaveLength(2)
    expect(titles[0]?.textContent).toBe('Frame title 1')
    expect(titles[1]?.textContent).toBe('Frame title 2')

    let metas = document.head.querySelectorAll('meta[name="frame-description"]')
    expect(metas).toHaveLength(2)
    expect(metas[0]?.getAttribute('content')).toBe('frame-1')
    expect(metas[1]?.getAttribute('content')).toBe('frame-2')

    let ldJsonScripts = document.head.querySelectorAll('script[type="application/ld+json"]')
    expect(ldJsonScripts).toHaveLength(2)
    expect(ldJsonScripts[0]?.textContent).toBe('{"count":1}')
    expect(ldJsonScripts[1]?.textContent).toBe('{"count":2}')
    expect(document.querySelector('p')?.textContent).toBe('Frame body 2')

    clientFrame.dispose()
  })

  it('hydrates client entries in blocking frame content without redefining virtual roots', async () => {
    let Counter = clientEntry('/js/counter.js#Counter', function Counter() {
      return () => (
        <button id="counter" type="button">
          Count
        </button>
      )
    })

    async function renderInner(): Promise<string> {
      return await drain(renderToStream(<Counter />))
    }

    let stream = renderToStream(
      <main>
        <Frame src="/inner" />
      </main>,
      { resolveFrame: renderInner },
    )

    let html = await drain(stream)
    document.body.innerHTML = html

    let [modulePromise, resolveModule] = withResolvers<Function>()
    let loadModule = vi.fn().mockImplementation(async () => modulePromise)
    let clientFrame = run(document, { loadModule })

    await new Promise((resolve) => setTimeout(resolve, 0))
    resolveModule(Counter)

    await expect(clientFrame.ready()).resolves.toBeUndefined()

    let button = document.getElementById('counter') as HTMLButtonElement | null
    invariant(button)
    expect(button.textContent).toContain('Count')
    expect(loadModule).toHaveBeenCalled()

    clientFrame.dispose()
  })

  it('hydrates components without waiting for pending frames', async () => {
    let Counter = clientEntry(
      '/js/counter.js#Counter',
      function Counter(handle: Handle, setup: number) {
        let count = setup
        return () => (
          <button
            id="counter"
            on={{
              click() {
                count++
                handle.update()
              },
            }}
          >
            Count: {count}
          </button>
        )
      },
    )

    let [framePromise, resolveFramePromise] = withResolvers<string>()

    let stream = renderToStream(
      <div>
        <Counter setup={0} />
        <Frame src="/slow" fallback={<span id="frame">Loading…</span>} />
      </div>,
      { resolveFrame: () => framePromise },
    )

    // Get first chunk only (fallback + counter HTML).
    let chunks = readChunks(stream)
    let first = await chunks.next()
    invariant(!first.done)
    document.body.innerHTML = first.value

    // Frame shows fallback.
    expect(document.getElementById('frame')!.textContent).toBe('Loading…')

    let clientFrame = run(document, {
      loadModule: vi.fn().mockResolvedValue(Counter),
    })
    await clientFrame.ready()

    // Counter is hydrated and interactive BEFORE frame resolves.
    let button = document.getElementById('counter') as HTMLButtonElement
    expect(button.textContent).toBe('Count: 0')
    button.click()
    clientFrame.flush()
    expect(button.textContent).toBe('Count: 1')

    // Frame still shows fallback.
    expect(document.getElementById('frame')!.textContent).toBe('Loading…')

    // Now resolve the frame and inject the template.
    resolveFramePromise('<span id="frame">Loaded!</span>')
    let second = await chunks.next()
    invariant(!second.done)
    document.body.insertAdjacentHTML('beforeend', second.value)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Frame is now rendered.
    expect(document.getElementById('frame')!.textContent).toBe('Loaded!')

    // Counter still works.
    button.click()
    clientFrame.flush()
    expect(button.textContent).toBe('Count: 2')

    clientFrame.dispose()
  })

  it('pending frames resolve independently as their templates arrive', async () => {
    let [fastPromise, resolveFast] = withResolvers<string>()
    let [slowPromise, resolveSlow] = withResolvers<string>()

    let stream = renderToStream(
      <div>
        <Frame src="/fast" fallback={<span id="fast">Loading fast…</span>} />
        <Frame src="/slow" fallback={<span id="slow">Loading slow…</span>} />
      </div>,
      {
        resolveFrame(src: string) {
          if (src === '/fast') return fastPromise
          if (src === '/slow') return slowPromise
          throw new Error(`Unexpected frame src: ${src}`)
        },
      },
    )

    // Get the first chunk (both fallbacks).
    let chunks = readChunks(stream)
    let first = await chunks.next()
    invariant(!first.done)
    document.body.innerHTML = first.value

    expect(document.getElementById('fast')!.textContent).toBe('Loading fast…')
    expect(document.getElementById('slow')!.textContent).toBe('Loading slow…')

    let clientFrame = run(document, { loadModule: vi.fn() })
    await clientFrame.ready()

    // Resolve the fast frame first.
    resolveFast('<span id="fast">Fast loaded</span>')
    let second = await chunks.next()
    invariant(!second.done)
    document.body.insertAdjacentHTML('beforeend', second.value)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Fast frame is rendered; slow frame still shows fallback.
    expect(document.getElementById('fast')!.textContent).toBe('Fast loaded')
    expect(document.getElementById('slow')!.textContent).toBe('Loading slow…')

    // Now resolve the slow frame.
    resolveSlow('<span id="slow">Slow loaded</span>')
    let third = await chunks.next()
    invariant(!third.done)
    document.body.insertAdjacentHTML('beforeend', third.value)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Both frames are now rendered.
    expect(document.getElementById('fast')!.textContent).toBe('Fast loaded')
    expect(document.getElementById('slow')!.textContent).toBe('Slow loaded')

    clientFrame.dispose()
  })

  it('pending frames resolve while modules are still loading', async () => {
    // Uses manual HTML because renderToStream + readChunks with a deferred
    // loadModule has a timing issue in the Chromium test environment where
    // the hydration markers aren't found by the tree walker.
    let [modulePromise, resolveModule] = withResolvers<Function>()
    let moduleLoaded = false

    function Counter() {
      return () => <button id="counter">Counter</button>
    }

    document.body.innerHTML =
      '<div>' +
      '<!-- rmx:h:h1 --><button id="counter">Counter</button><!-- /rmx:h -->' +
      '<!-- rmx:f:f1 --><span id="frame">Loading…</span><!-- /rmx:f -->' +
      '</div>' +
      '<script type="application/json" id="rmx-data">' +
      '{"h":{"h1":{"moduleUrl":"/counter.js","exportName":"Counter","props":{}}},' +
      '"f":{"f1":{"status":"pending","src":"/slow"}}}' +
      '</script>'

    let loadModuleFn = vi.fn().mockImplementation(async () => {
      let mod = await modulePromise
      moduleLoaded = true
      return mod
    })

    let clientFrame = run(document, { loadModule: loadModuleFn })

    await new Promise((resolve) => setTimeout(resolve, 0))

    // loadModule must have been called (hydration marker was found).
    expect(loadModuleFn).toHaveBeenCalled()
    expect(moduleLoaded).toBe(false)

    // Frame still shows fallback (template hasn't arrived).
    expect(document.getElementById('frame')!.textContent).toBe('Loading…')

    // Simulate frame template arriving via MutationObserver.
    let template = document.createElement('template')
    template.id = 'f1'
    template.innerHTML = '<span id="frame">Loaded!</span>'
    document.body.appendChild(template)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Frame rendered even though module hasn't loaded yet.
    expect(document.getElementById('frame')!.textContent).toBe('Loaded!')
    expect(moduleLoaded).toBe(false)

    // Now resolve the module and let hydration complete.
    resolveModule(Counter)
    await clientFrame.ready()

    expect(moduleLoaded).toBe(true)

    clientFrame.dispose()
  })

  it('hydrates a component inside a nested frame', async () => {
    let Counter = clientEntry(
      '/js/counter.js#Counter',
      function Counter(handle: Handle, setup: number) {
        let count = setup
        return () => (
          <button
            id="nested-counter"
            on={{
              click() {
                count++
                handle.update()
              },
            }}
          >
            Count: {count}
          </button>
        )
      },
    )

    // Use renderToStream to produce proper HTML for each level.
    let neverResolve = () => new Promise<string>(() => {})

    // Render inner frame content (hydrated Counter).
    let innerContent = await drain(renderToStream(<Counter setup={10} />))

    // Render outer frame content (pending inner frame with fallback).
    let outerStream = renderToStream(
      <div>
        <Frame src="/inner" fallback={<span id="inner">Loading inner…</span>} />
      </div>,
      { resolveFrame: neverResolve },
    )
    let outerChunks = readChunks(outerStream)
    let outerFirst = await outerChunks.next()
    invariant(!outerFirst.done)
    let outerContent = outerFirst.value
    let innerFrameId = getCommentMarkerId(outerContent, 'rmx:f:')

    // Render initial page (pending outer frame with fallback).
    let pageStream = renderToStream(
      <div>
        <Frame src="/outer" fallback={<span id="outer">Loading outer…</span>} />
      </div>,
      { resolveFrame: neverResolve },
    )
    let pageChunks = readChunks(pageStream)
    let pageFirst = await pageChunks.next()
    invariant(!pageFirst.done)
    document.body.innerHTML = pageFirst.value
    let outerFrameId = getCommentMarkerId(pageFirst.value, 'rmx:f:')

    let clientFrame = run(document, {
      loadModule: vi.fn().mockResolvedValue(Counter),
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Outer frame still shows fallback.
    expect(document.getElementById('outer')!.textContent).toBe('Loading outer…')

    // Outer frame template arrives.
    let outerTemplate = document.createElement('template')
    outerTemplate.id = outerFrameId
    outerTemplate.innerHTML = outerContent
    document.body.appendChild(outerTemplate)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Outer frame rendered, inner frame shows fallback.
    expect(document.getElementById('inner')!.textContent).toBe('Loading inner…')

    // Inner frame template arrives.
    let innerTemplate = document.createElement('template')
    innerTemplate.id = innerFrameId
    innerTemplate.innerHTML = innerContent
    document.body.appendChild(innerTemplate)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Counter inside the nested frame is hydrated and interactive.
    let button = document.getElementById('nested-counter') as HTMLButtonElement
    expect(button.textContent).toBe('Count: 10')
    button.click()
    clientFrame.flush()
    expect(button.textContent).toBe('Count: 11')

    clientFrame.dispose()
  })

  it('deeply nested frames resolve independently at each level', async () => {
    // Page has outer frame → outer has middle frame → middle has inner frame.
    // Each level resolves independently via MutationObserver.
    let neverResolve = () => new Promise<string>(() => {})

    // Render inner content (leaf — no sub-frames).
    let innerContent = await drain(renderToStream(<p id="inner-content">Inner loaded</p>))

    // Render middle content (pending inner frame with fallback).
    let middleStream = renderToStream(
      <div>
        <p id="middle-content">Middle loaded</p>
        <Frame src="/inner" fallback={<span id="inner">Loading inner…</span>} />
      </div>,
      { resolveFrame: neverResolve },
    )
    let middleChunks = readChunks(middleStream)
    let middleFirst = await middleChunks.next()
    invariant(!middleFirst.done)
    let middleContent = middleFirst.value
    let innerFrameId = getCommentMarkerId(middleContent, 'rmx:f:')

    // Render outer content (pending middle frame with fallback).
    let outerStream = renderToStream(
      <div>
        <p id="outer-content">Outer loaded</p>
        <Frame src="/middle" fallback={<span id="middle">Loading middle…</span>} />
      </div>,
      { resolveFrame: neverResolve },
    )
    let outerChunks = readChunks(outerStream)
    let outerFirst = await outerChunks.next()
    invariant(!outerFirst.done)
    let outerContent = outerFirst.value
    let middleFrameId = getCommentMarkerId(outerContent, 'rmx:f:')

    // Render initial page (pending outer frame with fallback).
    let pageStream = renderToStream(
      <div>
        <h1 id="title">Page</h1>
        <Frame src="/outer" fallback={<span id="outer">Loading outer…</span>} />
      </div>,
      { resolveFrame: neverResolve },
    )
    let pageChunks = readChunks(pageStream)
    let pageFirst = await pageChunks.next()
    invariant(!pageFirst.done)
    document.body.innerHTML = pageFirst.value
    let outerFrameId = getCommentMarkerId(pageFirst.value, 'rmx:f:')

    let clientFrame = run(document, { loadModule: vi.fn() })
    await clientFrame.ready()

    // Page content is visible, outer frame shows fallback.
    expect(document.getElementById('title')!.textContent).toBe('Page')
    expect(document.getElementById('outer')!.textContent).toBe('Loading outer…')

    // Outer frame template arrives — contains a middle frame.
    let outerTemplate = document.createElement('template')
    outerTemplate.id = outerFrameId
    outerTemplate.innerHTML = outerContent
    document.body.appendChild(outerTemplate)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Outer content rendered, middle shows fallback.
    expect(document.getElementById('outer-content')!.textContent).toBe('Outer loaded')
    expect(document.getElementById('middle')!.textContent).toBe('Loading middle…')

    // Middle frame template arrives — contains an inner frame.
    let middleTemplate = document.createElement('template')
    middleTemplate.id = middleFrameId
    middleTemplate.innerHTML = middleContent
    document.body.appendChild(middleTemplate)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Middle content rendered, inner shows fallback.
    expect(document.getElementById('middle-content')!.textContent).toBe('Middle loaded')
    expect(document.getElementById('inner')!.textContent).toBe('Loading inner…')

    // Inner frame template arrives.
    let innerTemplate = document.createElement('template')
    innerTemplate.id = innerFrameId
    innerTemplate.innerHTML = innerContent
    document.body.appendChild(innerTemplate)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // All three levels rendered.
    expect(document.getElementById('outer-content')!.textContent).toBe('Outer loaded')
    expect(document.getElementById('middle-content')!.textContent).toBe('Middle loaded')
    expect(document.getElementById('inner-content')!.textContent).toBe('Inner loaded')

    // Page content preserved throughout.
    expect(document.getElementById('title')!.textContent).toBe('Page')

    clientFrame.dispose()
  })

  it('reloads a frame that is nested inside another frame', async () => {
    let reloadInner: undefined | (() => Promise<AbortSignal>)
    let renderCount = 0

    let ReloadButton = clientEntry(
      '/js/reload.js#ReloadButton',
      function ReloadButton(handle: Handle) {
        reloadInner = () => handle.frame.reload()
        return () => <button id="reload-btn">Reload</button>
      },
    )

    async function renderInner() {
      renderCount++
      return await drain(
        renderToStream(
          <div>
            <p id="inner-text">Render {renderCount}</p>
            <ReloadButton />
          </div>,
        ),
      )
    }

    // Render outer content with a pending inner frame.
    let outerStream = renderToStream(
      <div>
        <p id="outer-text">Outer</p>
        <Frame src="/inner" fallback={<span id="inner-fallback">Loading…</span>} />
      </div>,
      { resolveFrame: () => new Promise<string>(() => {}) },
    )
    let outerChunks = readChunks(outerStream)
    let outerFirst = await outerChunks.next()
    invariant(!outerFirst.done)
    let outerContent = outerFirst.value
    let innerFrameId = getCommentMarkerId(outerContent, 'rmx:f:')

    // Render page with a blocking outer frame that resolves to the outer content.
    let pageStream = renderToStream(
      <div>
        <Frame src="/outer" />
      </div>,
      { resolveFrame: () => outerContent },
    )
    let pageHtml = await drain(pageStream)
    document.body.innerHTML = pageHtml

    let clientFrame = run(document, {
      loadModule: vi.fn().mockResolvedValue(ReloadButton),
      resolveFrame: renderInner,
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Outer is resolved, inner shows fallback.
    expect(document.getElementById('outer-text')!.textContent).toBe('Outer')
    expect(document.getElementById('inner-fallback')!.textContent).toBe('Loading…')

    // Inner frame template arrives.
    let innerTemplate = document.createElement('template')
    innerTemplate.id = innerFrameId
    innerTemplate.innerHTML = await renderInner()
    document.body.appendChild(innerTemplate)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Inner frame rendered with hydrated ReloadButton.
    expect(document.getElementById('inner-text')!.textContent).toBe('Render 1')
    invariant(reloadInner)

    // Reload the inner frame — only the inner frame should update.
    await reloadInner()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById('inner-text')!.textContent).toBe('Render 2')
    expect(document.getElementById('outer-text')!.textContent).toBe('Outer')

    clientFrame.dispose()
  })

  it('renders a client-created Frame with createRoot frameInit', async () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame: async () => '<p id="resolved-frame">Resolved frame</p>',
      },
    })

    root.render(<Frame src="/client-frame" fallback={<p id="fallback-frame">Loading…</p>} />)
    root.flush()

    expect(rootContainer.querySelector('#fallback-frame')?.textContent).toBe('Loading…')

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(rootContainer.querySelector('#resolved-frame')?.textContent).toBe('Resolved frame')
    root.dispose()
  })

  it('dispatches a clear error for createRoot Frame without frameInit', () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    let root = createRoot(rootContainer)
    let error: unknown
    root.addEventListener('error', (event) => {
      error = (event as ErrorEvent).error
    })

    root.render(<Frame src="/missing-runtime" fallback={<p>Loading…</p>} />)
    root.flush()

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('Cannot render <Frame /> without frame runtime')
  })

  it('reloads client-created Frame in place when src changes', async () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    let [nextFramePromise, resolveNextFrame] = withResolvers<string>()

    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame: async (src) => {
          if (src === '/a') return '<p id="frame-a">A</p>'
          return await nextFramePromise
        },
      },
    })

    root.render(<Frame src="/a" fallback={<p id="fallback-a">Loading A…</p>} />)
    root.flush()
    expect(rootContainer.querySelector('#fallback-a')?.textContent).toBe('Loading A…')

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(rootContainer.querySelector('#frame-a')?.textContent).toBe('A')

    let frameA = rootContainer.querySelector('#frame-a')
    invariant(frameA instanceof HTMLParagraphElement)

    root.render(<Frame src="/b" fallback={<p id="fallback-b">Loading B…</p>} />)
    root.flush()

    // src updates should behave like reloads: existing content remains mounted
    // while the new source resolves.
    expect(rootContainer.querySelector('#fallback-b')).toBeNull()
    expect(rootContainer.querySelector('#frame-a')).toBe(frameA)

    resolveNextFrame('<p id="frame-b">B</p>')

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(rootContainer.querySelector('#frame-b')?.textContent).toBe('B')
    root.dispose()
  })

  it('renders a client-created Frame after run() from a hydrated entry component', async () => {
    let mounted = false
    let showFrame: undefined | (() => void)

    let PostRunFrame = clientEntry(
      '/js/post-run.js#PostRunFrame',
      function PostRunFrame(handle: Handle) {
        showFrame = () => {
          mounted = true
          handle.update()
        }

        return () => (
          <section>
            {mounted ? (
              <Frame
                src="/post-run-frame"
                fallback={<p id="post-run-fallback">Loading post-run…</p>}
              />
            ) : (
              <p id="before-post-run">Before frame</p>
            )}
          </section>
        )
      },
    )

    let pageHtml = await drain(renderToStream(<PostRunFrame />))
    document.body.innerHTML = pageHtml

    let app = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/post-run.js' && exportName === 'PostRunFrame') return PostRunFrame
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: async () => '<p id="post-run-loaded">Post-run loaded</p>',
    })

    await app.ready()
    invariant(showFrame)
    showFrame()
    app.flush()

    expect(document.getElementById('post-run-fallback')?.textContent).toBe('Loading post-run…')

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById('post-run-loaded')?.textContent).toBe('Post-run loaded')
    app.dispose()
  })

  it('does not duplicate initially-mounted Frame hydration in a client entry', async () => {
    let MountedFrame = clientEntry(
      '/js/mounted-frame.js#MountedFrame',
      function MountedFrame(handle: Handle) {
        let showFrame = true
        return () =>
          showFrame ? (
            <section>
              <Frame src="/outer" fallback={<p id="outer-fallback">Loading outer…</p>} />
            </section>
          ) : null
      },
    )

    let outerStream = renderToStream(
      <div id="outer-root">
        <Frame src="/nested" fallback={<span id="nested-fallback">Loading nested…</span>} />
      </div>,
      { resolveFrame: () => new Promise<string>(() => {}) },
    )
    let outerChunks = readChunks(outerStream)
    let outerFirst = await outerChunks.next()
    invariant(!outerFirst.done)
    let outerInitialHtml = outerFirst.value
    let nestedFrameId = getCommentMarkerId(outerInitialHtml, 'rmx:f:')

    let [outerPromise, resolveOuter] = withResolvers<string>()
    let pageStream = renderToStream(<MountedFrame />, {
      resolveFrame(src: string) {
        if (src === '/outer') return outerPromise
        throw new Error(`Unexpected src during page render: ${src}`)
      },
    })
    let pageChunks = readChunks(pageStream)
    let pageFirst = await pageChunks.next()
    invariant(!pageFirst.done)
    document.body.innerHTML = pageFirst.value

    expect(document.querySelectorAll('#outer-fallback')).toHaveLength(1)

    let clientResolveFrame = vi
      .fn()
      .mockImplementation(
        async (src: string) => `<p data-client-resolve="${src}">client resolve ${src}</p>`,
      )

    let app = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/mounted-frame.js' && exportName === 'MountedFrame') {
          return MountedFrame
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame: clientResolveFrame,
    })

    await app.ready()
    expect(clientResolveFrame).not.toHaveBeenCalled()

    resolveOuter(outerInitialHtml)
    let pageSecond = await pageChunks.next()
    invariant(!pageSecond.done)
    document.body.insertAdjacentHTML('beforeend', pageSecond.value)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(clientResolveFrame).not.toHaveBeenCalled()
    expect(document.querySelectorAll('#outer-root')).toHaveLength(1)
    expect(document.querySelectorAll('#nested-fallback')).toHaveLength(1)

    let nestedTemplate = document.createElement('template')
    nestedTemplate.id = nestedFrameId
    nestedTemplate.innerHTML = '<span id="nested-loaded">Nested loaded</span>'
    document.body.appendChild(nestedTemplate)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(clientResolveFrame).not.toHaveBeenCalled()
    expect(document.querySelectorAll('#nested-loaded')).toHaveLength(1)
    expect(document.querySelectorAll('#nested-fallback')).toHaveLength(0)

    app.dispose()
  })

  it('renders Frame semantics from entry children during initial hydration', async () => {
    let Card = clientEntry('/js/card.js#Card', function Card(handle: Handle) {
      return (props: { children: any }) => <section>{props.children}</section>
    })

    let [framePromise, resolveFramePromise] = withResolvers<string>()
    let pageStream = renderToStream(
      <Card>
        <Frame src="/child-frame" fallback={<span id="child-frame">Loading child frame…</span>} />
      </Card>,
      { resolveFrame: () => framePromise },
    )
    let chunks = readChunks(pageStream)
    let first = await chunks.next()
    invariant(!first.done)
    document.body.innerHTML = first.value

    expect(document.getElementById('child-frame')?.textContent).toBe('Loading child frame…')

    let app = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/js/card.js' && exportName === 'Card') return Card
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
    })

    await app.ready()
    expect(document.getElementById('child-frame')?.textContent).toBe('Loading child frame…')

    resolveFramePromise('<span id="child-frame">Loaded child frame</span>')
    let second = await chunks.next()
    invariant(!second.done)
    document.body.insertAdjacentHTML('beforeend', second.value)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById('child-frame')?.textContent).toBe('Loaded child frame')
    app.dispose()
  })

  it('does not dispose managed stylesheets when removing a client-created Frame', async () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    function Shell(handle: Handle) {
      let mounted = true

      return () => (
        <main css={{ color: '#0bf' }}>
          <button
            id="toggle-frame"
            type="button"
            on={{
              click() {
                mounted = !mounted
                handle.update()
              },
            }}
          >
            Toggle
          </button>
          {mounted ? (
            <Frame
              src="/style-frame"
              fallback={<div css={{ color: '#f0b' }}>Loading style frame…</div>}
            />
          ) : null}
        </main>
      )
    }

    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame: async () => '<section data-css="rmx-manual">Frame loaded</section>',
      },
    })

    root.render(<Shell />)
    root.flush()

    let before = document.adoptedStyleSheets.length
    let button = rootContainer.querySelector('#toggle-frame')
    invariant(button instanceof HTMLButtonElement)

    button.click()
    root.flush()

    let after = document.adoptedStyleSheets.length
    expect(after).toBeGreaterThan(0)
    expect(after).toBeGreaterThanOrEqual(before)

    root.dispose()
  })

  it('streams client resolveFrame templates and updates nested placeholders incrementally', async () => {
    let reload: undefined | (() => Promise<AbortSignal>)

    let ReloadButton = clientEntry(
      '/assets/reload-stream.js#ReloadStream',
      function ReloadStream(handle: Handle) {
        reload = () => handle.frame.reload()
        return () => (
          <button id="reload-stream" type="button">
            Reload streamed
          </button>
        )
      },
    )

    async function renderInitial(): Promise<string> {
      return await drain(
        renderToStream(
          <section>
            <p id="outer">Initial outer</p>
            <ReloadButton />
          </section>,
        ),
      )
    }

    let [nestedResolvePromise, resolveNested] = withResolvers<string>()
    let streamedReload = renderToStream(
      <section>
        <p id="outer">Reloaded outer</p>
        <Frame src="/nested" fallback={<span id="nested">Loading nested…</span>} />
        <ReloadButton />
      </section>,
      {
        resolveFrame(src: string) {
          if (src === '/nested') return nestedResolvePromise
          throw new Error(`Unexpected nested src: ${src}`)
        },
      },
    )

    let streamedChunks = readChunks(streamedReload)
    let firstChunk = await streamedChunks.next()
    invariant(!firstChunk.done)
    resolveNested('<span id="nested">Nested loaded</span>')
    let secondChunk = await streamedChunks.next()
    invariant(!secondChunk.done)

    let [secondChunkPromise, releaseSecondChunk] = withResolvers<string>()
    let serverHtml = await drain(
      renderToStream(
        <main>
          <Frame src="/reload-streamed" fallback={<div id="frame-fallback">Loading…</div>} />
        </main>,
        {
          resolveFrame: renderInitial,
        },
      ),
    )
    document.body.innerHTML = serverHtml

    let app = run(document, {
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-stream.js' && exportName === 'ReloadStream') {
          return ReloadButton
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src === '/reload-streamed') {
          return streamFromChunks([firstChunk.value, secondChunkPromise])
        }
        throw new Error(`Unexpected frame src: ${src}`)
      },
    })

    await app.ready()
    await new Promise((resolve) => setTimeout(resolve, 0))

    invariant(reload)
    let reloadPromise = reload()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById('outer')?.textContent).toBe('Reloaded outer')
    expect(document.getElementById('nested')?.textContent).toBe('Loading nested…')

    releaseSecondChunk(secondChunk.value)
    await reloadPromise
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById('nested')?.textContent).toBe('Nested loaded')
  })

  it('cancels stale client frame streams when src changes', async () => {
    let rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)

    let [slowChunkPromise, resolveSlowChunk] = withResolvers<string>()

    function Shell(handle: Handle) {
      let src = '/slow'
      return () => (
        <main>
          <button
            id="switch-src"
            type="button"
            on={{
              click() {
                src = '/fast'
                handle.update()
              },
            }}
          >
            Switch
          </button>
          <Frame src={src} fallback={<p id="fallback">Loading…</p>} />
        </main>
      )
    }

    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame(src: string) {
          if (src === '/slow') {
            return streamFromChunks([slowChunkPromise])
          }
          if (src === '/fast') {
            return '<p id="result">Fast result</p>'
          }
          throw new Error(`Unexpected src: ${src}`)
        },
      },
    })

    root.render(<Shell />)
    root.flush()

    expect(rootContainer.querySelector('#fallback')?.textContent).toBe('Loading…')

    let switchButton = rootContainer.querySelector('#switch-src')
    invariant(switchButton instanceof HTMLButtonElement)
    switchButton.click()
    root.flush()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(rootContainer.querySelector('#result')?.textContent).toBe('Fast result')

    resolveSlowChunk('<p id="result">Slow result</p>')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(rootContainer.querySelector('#result')?.textContent).toBe('Fast result')
    root.dispose()
  })
})
