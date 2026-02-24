import { describe, expect, it, vi } from 'vitest'
import { boot } from './client-runtime.ts'
import { clientEntry } from './client-entry.ts'
import { renderToHTMLStream } from './render-to-html-stream.ts'

describe('boot', () => {
  it('hydrates boundaries discovered from rmx-data payload', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h:h1 --><button>server A</button><!-- /rmx:h -->',
      '<!-- rmx:h:h2 --><button>server B</button><!-- /rmx:h -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"h1":{"moduleUrl":"/entries/a.js","exportName":"EntryA","props":{"label":"A"}},"h2":{"moduleUrl":"/entries/b.js","exportName":"EntryB","props":{"label":"B"}}}}',
      '</script>',
      '</main>',
    ].join('')
    let loadModule = vi.fn(
      async () => () => (props: { label: string }) => <button>{`client ${props.label}`}</button>,
    )

    let runtime = boot({
      document,
      loadModule,
    })
    await runtime.ready()

    expect(loadModule).toHaveBeenCalledTimes(2)
    expect(document.body.innerHTML).toContain('client A')
    expect(document.body.innerHTML).toContain('client B')
  })

  it('wires handle.frame and handle.frames for hydrated components', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h:h1 --><button>server</button><!-- /rmx:h -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"h1":{"moduleUrl":"/entries/a.js","exportName":"EntryA","props":{}}}}',
      '</script>',
      '</main>',
    ].join('')
    let loadModule = vi.fn(async () => (handle: any) => () => {
      let top = handle.frames.top as { src: string }
      let current = handle.frame as { src: string }
      return <button>{`${current.src}|${top.src}`}</button>
    })

    let runtime = boot({ document, loadModule })
    await runtime.ready()

    expect(document.querySelector('button')?.textContent).toContain(document.location.href)
  })

  it('reloads named frame boundaries and hydrates their client entries', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- f:f1 --><p>loading</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"f":{"f1":{"status":"resolved","name":"sidebar","src":"/frame/sidebar"}}}',
      '</script>',
      '</main>',
    ].join('')

    let resolveFrame = vi.fn(async () =>
      [
        '<!-- rmx:h:h1 --><button>server sidebar</button><!-- /rmx:h -->',
        '<script type="application/json" id="rmx-data">',
        '{"h":{"h1":{"moduleUrl":"/entries/sidebar.js","exportName":"Sidebar","props":{"label":"sidebar"}}}}',
        '</script>',
      ].join(''),
    )
    let loadModule = vi.fn(
      async () => () => (props: { label: string }) => <button>{`client ${props.label}`}</button>,
    )

    let runtime = boot({ document, loadModule, resolveFrame })
    await runtime.ready()

    let frame = runtime.frames.get('sidebar')
    expect(frame).toBeDefined()
    await frame?.reload()

    expect(resolveFrame).toHaveBeenCalledWith('/frame/sidebar', expect.any(AbortSignal))
    expect(loadModule).toHaveBeenCalledTimes(1)
    expect(document.body.innerHTML).toContain('client sidebar')
  })

  it('supports frame reload from streamed HTML chunks', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- f:f1 --><p>loading</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"f":{"f1":{"status":"resolved","name":"streamed","src":"/frame/streamed"}}}',
      '</script>',
      '</main>',
    ].join('')

    let encoder = new TextEncoder()
    let resolveFrame = vi.fn(async () => {
      let bytes = encoder.encode('<div>streamed chunk content</div>')
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, 10))
          controller.enqueue(bytes.slice(10))
          controller.close()
        },
      })
    })

    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
      resolveFrame,
    })
    await runtime.ready()

    let frame = runtime.frames.get('streamed')
    expect(frame).toBeDefined()
    await frame?.reload()

    expect(document.body.innerHTML).toContain('streamed chunk content')
  })

  it('preserves static node identity when reloading frame content', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- f:f1 --><section id="panel"><h2 id="title">Activity</h2><p id="value">Server: 1</p></section><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"f":{"f1":{"status":"resolved","name":"panel","src":"/frame/panel"}}}',
      '</script>',
      '</main>',
    ].join('')

    let resolveFrame = vi.fn(async () => {
      return '<section id="panel"><h2 id="title">Activity</h2><p id="value">Server: 2</p></section>'
    })
    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
      resolveFrame,
    })
    await runtime.ready()

    let section = document.getElementById('panel')
    let title = document.getElementById('title')
    let value = document.getElementById('value')
    expect(value?.textContent).toBe('Server: 1')

    let frame = runtime.frames.get('panel')
    expect(frame).toBeDefined()
    await frame?.reload()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById('panel')).toBe(section)
    expect(document.getElementById('title')).toBe(title)
    expect(document.getElementById('value')).toBe(value)
    expect(document.getElementById('value')?.textContent).toBe('Server: 2')
  })

  it('keeps hydrated component state on reload and applies new server props', async () => {
    let triggerIncrement: undefined | (() => Promise<void>)
    let CounterEntry = clientEntry(
      '/entries/counter.js#Counter',
      function Counter(_handle: any, initial: number) {
        let count = initial
        return (props: { label: string }) => (
          <button id="counter">
            {props.label}: {count}
          </button>
        )
      },
    )
    let renderFrameHtml = async (label: string, setup: number) => {
      return await readStream(
        renderToHTMLStream(
          <section id="panel">
            <h2 id="title">Activity</h2>
            <CounterEntry setup={setup} label={label} />
          </section>,
        ),
      )
    }

    let initialHtml = await readStream(
      renderToHTMLStream(<frame name="panel" src="/frame/panel" />, {
        resolveFrame: async () => await renderFrameHtml('Count A', 1),
      }),
    )
    document.body.innerHTML = initialHtml

    let loadModule = vi.fn(async () => {
      return function Counter(handle: any, initial: number) {
        let count = initial
        triggerIncrement = async () => {
          count++
          await handle.update()
        }
        return (props: { label: string }) => (
          <button id="counter">
            {props.label}: {count}
          </button>
        )
      }
    })
    let runtime = boot({
      document,
      loadModule,
      resolveFrame: async () => await renderFrameHtml('Count B', 100),
    })
    await runtime.ready()
    await new Promise((resolve) => setTimeout(resolve, 0))

    let title = document.getElementById('title')
    let button = document.getElementById('counter')
    expect(button?.textContent).toBe('Count A: 1')

    await triggerIncrement?.()
    runtime.flush()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.getElementById('counter')?.textContent).toBe('Count A: 2')

    let frame = runtime.frames.get('panel')
    expect(frame).toBeDefined()
    await frame?.reload()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.getElementById('title')).toBe(title)
    expect(document.getElementById('counter')).toBe(button)
    expect(document.getElementById('counter')?.textContent).toBe('Count B: 2')
  })

  it('replaces pending frame fallback when deferred template chunk arrives', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- f:f1 --><p>loading frame</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"f":{"f1":{"status":"pending","name":"late","src":"/frame/late"}}}',
      '</script>',
      '</main>',
    ].join('')

    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
    })
    await runtime.ready()
    expect(document.body.innerHTML).toContain('loading frame')

    let template = document.createElement('template')
    template.id = 'f1'
    template.innerHTML = '<p>resolved frame content</p>'
    document.body.appendChild(template)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.body.innerHTML).toContain('resolved frame content')
    expect(document.body.innerHTML).not.toContain('loading frame')
  })

  it('consumes early frame templates that exist before boot starts', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- f:f1 --><p>loading frame</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"f":{"f1":{"status":"pending","name":"early","src":"/frame/early"}}}',
      '</script>',
      '<template id="f1"><p>early resolved content</p></template>',
      '</main>',
    ].join('')

    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
    })
    await runtime.ready()

    expect(document.body.innerHTML).toContain('early resolved content')
    expect(document.body.innerHTML).not.toContain('loading frame')
  })

  it('does not block ready on hydration markers from late frame templates', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h:h1 --><button id="initial">server initial</button><!-- /rmx:h -->',
      '<!-- f:f1 --><p id="frame-fallback">loading frame</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"h1":{"moduleUrl":"/entries/initial.js","exportName":"Initial","props":{"label":"initial"}}},"f":{"f1":{"status":"pending","name":"late-hydration","src":"/frame/late"}}}',
      '</script>',
      '</main>',
    ].join('')

    let resolveLateModule = (_value: unknown) => {}
    let lateModulePromise = new Promise<unknown>((resolve) => {
      resolveLateModule = resolve
    })
    let loadModule = vi.fn(async (moduleUrl: string, exportName: string) => {
      if (moduleUrl === '/entries/initial.js' && exportName === 'Initial') {
        return () => (props: { label: string }) => <button id="initial">{props.label}</button>
      }
      if (moduleUrl === '/entries/late.js' && exportName === 'Late') {
        return lateModulePromise
      }
      throw new Error(`Unexpected module request: ${moduleUrl}#${exportName}`)
    })

    let runtime = boot({ document, loadModule })
    await runtime.ready()
    expect(loadModule).toHaveBeenCalledTimes(1)
    expect(document.getElementById('initial')?.textContent).toBe('initial')

    let template = document.createElement('template')
    template.id = 'f1'
    template.innerHTML = [
      '<!-- rmx:h:h2 --><button id="late">server late</button><!-- /rmx:h -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"h2":{"moduleUrl":"/entries/late.js","exportName":"Late","props":{"label":"late"}}}}',
      '</script>',
    ].join('')
    document.body.appendChild(template)
    await waitFor(() => {
      expect(loadModule).toHaveBeenCalledTimes(2)
    })
    expect(document.getElementById('late')?.textContent).toBe('server late')

    resolveLateModule(() => (props: { label: string }) => <button id="late">{props.label}</button>)
    await waitFor(() => {
      expect(document.getElementById('late')?.textContent).toBe('late')
    })
  })

  it('discovers late frame boundaries that stream after boot starts', async () => {
    document.body.innerHTML = [
      '<main>',
      '<script type="application/json" id="rmx-data">',
      '{"f":{"f1":{"status":"pending","name":"late-a","src":"/frame/a"},"f2":{"status":"pending","name":"late-b","src":"/frame/b"}}}',
      '</script>',
      '</main>',
    ].join('')

    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
    })
    await runtime.ready()

    document.body.insertAdjacentHTML(
      'beforeend',
      '<!-- f:f1 --><p id="fallback-a">loading A</p><!-- /f --><!-- f:f2 --><p id="fallback-b">loading B</p><!-- /f -->',
    )
    await waitFor(() => {
      expect(runtime.frames.get('late-a')).toBeDefined()
      expect(runtime.frames.get('late-b')).toBeDefined()
    })

    let templateB = document.createElement('template')
    templateB.id = 'f2'
    templateB.innerHTML = '<p id="resolved-b">resolved B</p>'
    document.body.appendChild(templateB)
    await waitFor(() => {
      expect(document.getElementById('resolved-b')).toBeTruthy()
      expect(document.getElementById('fallback-b')).toBeNull()
      expect(document.getElementById('fallback-a')).toBeTruthy()
    })

    let templateA = document.createElement('template')
    templateA.id = 'f1'
    templateA.innerHTML = '<p id="resolved-a">resolved A</p>'
    document.body.appendChild(templateA)
    await waitFor(() => {
      expect(document.getElementById('resolved-a')).toBeTruthy()
      expect(document.getElementById('fallback-a')).toBeNull()
    })
  })

  it('disposes hydrated roots and frame content', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h:h1 --><button>server A</button><!-- /rmx:h -->',
      '<!-- f:f1 --><p>loading</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"h1":{"moduleUrl":"/entries/a.js","exportName":"EntryA","props":{"label":"A"}}},"f":{"f1":{"status":"resolved","name":"sidebar","src":"/frame/sidebar"}}}',
      '</script>',
      '</main>',
    ].join('')

    let runtime = boot({
      document,
      loadModule: async () => () => (props: { label: string }) => <button>{`client ${props.label}`}</button>,
      resolveFrame: async () => '<div>frame body</div>',
    })
    await runtime.ready()
    await runtime.frames.get('sidebar')?.reload()
    expect(document.body.innerHTML).toContain('client A')
    expect(document.body.innerHTML).toContain('frame body')

    runtime.dispose()
    expect(document.body.innerHTML).not.toContain('client A')
    expect(runtime.frames.get('sidebar')).toBeUndefined()
    expect(document.body.innerHTML).toContain('frame body')
  })

  it('reports malformed boundaries via onError', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h:oops --><button>server</button>',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"oops":{"moduleUrl":"/entries/oops.js","exportName":"Oops","props":{}}}}',
      '</script>',
      '</main>',
    ].join('')
    let errors: unknown[] = []

    let runtime = boot({
      document,
      loadModule: async () => () => <button>never</button>,
      onError(error) {
        errors.push(error)
      },
    })
    await runtime.ready()

    expect(errors.length).toBe(1)
  })
})

async function waitFor(assertion: () => void, attempts = 20) {
  let lastError: unknown = null
  for (let index = 0; index < attempts; index++) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw lastError
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  let reader = stream.getReader()
  let decoder = new TextDecoder()
  let output = ''
  while (true) {
    let result = await reader.read()
    if (result.done) break
    output += decoder.decode(result.value, { stream: true })
  }
  output += decoder.decode()
  return output
}
