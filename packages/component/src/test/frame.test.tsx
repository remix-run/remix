import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Handle } from '../lib/component.ts'
import { Frame } from '../lib/component.ts'
import { hydrationRoot } from '../lib/hydration-root.ts'
import { createFrame } from '../lib/frame.ts'
import { invariant } from '../lib/invariant.ts'
import { renderToStream } from '../lib/stream.ts'
import { drain, readChunks } from './utils.ts'

function getCommentMarkerId(html: string, prefix: 'rmx:f:' | 'rmx:h:'): string {
  let re = prefix === 'rmx:f:' ? /<!--\s*rmx:f:([^ ]+)\s*-->/ : /<!--\s*rmx:h:([^ ]+)\s*-->/
  let match = html.match(re)
  invariant(match, `Expected comment marker "${prefix}"`)
  return match[1]!
}

describe('createFrame', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('hydrates a single component', async () => {
    let Counter = hydrationRoot(
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

    let frame = createFrame(document, { loadModule })
    await frame.ready()

    expect(loadModule).toHaveBeenCalledWith('/js/counter.js', 'Counter')

    let button = document.querySelector('button')
    expect(button?.textContent).toBe('Count: 5')

    button?.click()
    frame.flush()

    expect(button?.textContent).toBe('Count: 6')
  })

  it('hydrates multiple components', async () => {
    let Button = hydrationRoot('/js/button.js#Button', function Button(handle: Handle) {
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

    let frame = createFrame(document, { loadModule })
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
  })

  it('handles complex props', async () => {
    let Card = hydrationRoot('/js/card.js#Card', function Card() {
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

    let frame = createFrame(document, { loadModule })
    await frame.ready()

    expect(loadModule).toHaveBeenCalledWith('/js/card.js', 'Card')
    expect(document.querySelector('h2')?.textContent).toBe('Test')
    expect(document.querySelector('p')?.textContent).toBe('Count: 42')
    expect(document.querySelectorAll('li')).toHaveLength(3)
  })

  it('does nothing when no rmx-data script exists', async () => {
    document.body.innerHTML = '<div>No hydration here</div>'

    let loadModule = vi.fn()

    let frame = createFrame(document, { loadModule })
    await frame.ready()

    expect(loadModule).not.toHaveBeenCalled()
  })

  it('does nothing when rmx-data has no hydration data', async () => {
    document.body.innerHTML = `
      <div>Static content</div>
      <script type="application/json" id="rmx-data">{}</script>
    `

    let loadModule = vi.fn()

    let frame = createFrame(document, { loadModule })
    await frame.ready()

    expect(loadModule).not.toHaveBeenCalled()
  })

  it('adopts existing DOM nodes during hydration', async () => {
    let Counter = hydrationRoot('/js/counter.js#Counter', function Counter() {
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

    let frame = createFrame(document, { loadModule })
    await frame.ready()

    let spanAfterHydration = document.querySelector('span')
    expect(spanAfterHydration).toBe(existingSpan)
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

    let frame = createFrame(document)
    await frame.ready()

    let second = await chunks.next()
    invariant(!second.done)
    document.body.insertAdjacentHTML('beforeend', second.value)

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector('h1')).toBe(h1)
    expect(document.querySelector('p')).toBe(p)
    expect(document.querySelector('nav')).toBe(nav)
    expect(nav.textContent).toBe('Loaded')
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

    let frame = createFrame(document, { loadModule })
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
  })

  it('reloads a frame region', async () => {
    let renderCount = 0

    let reload: undefined | (() => Promise<void>)

    let ReloadButton = hydrationRoot('/assets/reload.js#Reload', function Reload(handle: Handle) {
      reload = () => handle.frame.reload()
      return () => <button>Reload</button>
    })

    async function renderTimeFragment() {
      renderCount++
      let stream = renderToStream(
        <section>
          <p>Server: {renderCount}</p>
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

    let clientFrame = createFrame(document, {
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

    await reload()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.querySelector('p')?.textContent).toBe('Server: 2')
  })

  it('reloads a frame region when the response uses css props', async () => {
    let renderCount = 0

    let reload: undefined | (() => Promise<void>)

    let ReloadButton = hydrationRoot(
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

    let clientFrame = createFrame(document, {
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

    await reload()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.querySelector('p')?.textContent).toBe('Server: 2')
  })
})
