import { describe, expect, it, vi } from 'vitest'
import { boot, RuntimeErrorEvent } from './client-runtime.ts'
import { clientEntry } from '../shared/hydration/client-entry.ts'
import { renderToHTMLStream } from '../server/render-to-html-stream.ts'

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

  it('aborts in-flight streamed frame reload when a newer reload starts', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- f:f1 --><p>loading</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"f":{"f1":{"status":"resolved","name":"swap-stream","src":"/frame/swap-stream"}}}',
      '</script>',
      '</main>',
    ].join('')

    let encoder = new TextEncoder()
    let resolveFrame = vi.fn(async () => {
      if (resolveFrame.mock.calls.length === 1) {
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('<div>first '))
            setTimeout(() => {
              controller.enqueue(encoder.encode('reload</div>'))
              controller.close()
            }, 20)
          },
        })
      }
      return '<div>second reload</div>'
    })

    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
      resolveFrame,
    })
    await runtime.ready()

    let frame = runtime.frames.get('swap-stream')
    expect(frame).toBeDefined()

    let firstReload = frame!.reload()
    await new Promise((resolve) => setTimeout(resolve, 0))
    let secondSignal = await frame!.reload()
    let firstSignal = await firstReload

    expect(firstSignal.aborted).toBe(true)
    expect(secondSignal.aborted).toBe(false)
    expect(document.body.innerHTML).toContain('second reload')
  })

  it('reloads the top frame from a full document response', async () => {
    document.body.innerHTML = '<main><p>before top reload</p></main>'
    let resolveFrame = vi.fn(async () =>
      [
        '<!doctype html>',
        '<html>',
        '<head><title>Top Reloaded</title></head>',
        '<body>',
        '<main>',
        '<!-- rmx:h:h1 --><button id="entry">server</button><!-- /rmx:h -->',
        '<script type="application/json" id="rmx-data">',
        '{"h":{"h1":{"moduleUrl":"/entries/top.js","exportName":"TopEntry","props":{"label":"top"}}}}',
        '</script>',
        '</main>',
        '</body>',
        '</html>',
      ].join(''),
    )
    let loadModule = vi.fn(async () => () => (props: { label: string }) => <button id="entry">{props.label}</button>)

    let runtime = boot({ document, loadModule, resolveFrame })
    await runtime.ready()
    await runtime.frames.top.reload()

    expect(resolveFrame).toHaveBeenCalledWith(document.location.href, expect.any(AbortSignal))
    expect(document.title).toBe('Top Reloaded')
    expect(document.getElementById('entry')?.textContent).toBe('top')
  })

  it('throws when reloading top frame without resolveFrame', async () => {
    document.body.innerHTML = '<main><p>no resolver</p></main>'
    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
    })
    await runtime.ready()
    await expect(runtime.frames.top.reload()).rejects.toThrow('No resolveFrame provided')
  })

  it('returns aborted signal when reloading top frame after runtime disposal', async () => {
    document.body.innerHTML = '<main><p>dispose before reload</p></main>'
    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
      resolveFrame: async () => '<main><p>never applied</p></main>',
    })
    await runtime.ready()
    runtime.dispose()
    let signal = await runtime.frames.top.reload()
    expect(signal.aborted).toBe(true)
  })

  it('hoists head-managed elements on frame reload and keeps regular scripts in frame scope', async () => {
    let renderCount = 0
    document.body.innerHTML = [
      '<main>',
      '<!-- f:f1 --><p id="frame-content">initial</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"f":{"f1":{"status":"resolved","name":"head-frame","src":"/frame/head"}}}',
      '</script>',
      '</main>',
    ].join('')

    let resolveFrame = vi.fn(async () => {
      renderCount++
      return [
        `<title>Frame head reload ${renderCount}</title>`,
        `<meta name="frame-head-reload" content="frame-${renderCount}" />`,
        `<script type="application/ld+json">{"count":${renderCount}}</script>`,
        `<script type="text/javascript">window.__frameRegular = ${renderCount}</script>`,
        `<section><p id="frame-content">frame ${renderCount}</p></section>`,
      ].join('')
    })

    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
      resolveFrame,
    })
    await runtime.ready()
    let frame = runtime.frames.get('head-frame')
    expect(frame).toBeDefined()

    await frame?.reload()
    await waitFor(() => {
      expect(document.getElementById('frame-content')?.textContent).toBe('frame 1')
    })

    expect(
      document.head.querySelector('meta[name="frame-head-reload"]')?.getAttribute('content'),
    ).toBe('frame-1')
    expect(document.head.querySelector('script[type="application/ld+json"]')?.textContent).toContain(
      '"count":1',
    )
    expect(document.querySelector('main script[type="text/javascript"]')).toBeTruthy()
    expect(document.querySelector('main title')).toBeNull()
    expect(document.querySelector('main meta[name="frame-head-reload"]')).toBeNull()
    expect(document.querySelector('main script[type="application/ld+json"]')).toBeNull()

    await frame?.reload()
    await waitFor(() => {
      expect(document.getElementById('frame-content')?.textContent).toBe('frame 2')
    })

    let headTitles = Array.from(document.head.querySelectorAll('title')).filter((title) =>
      title.textContent?.startsWith('Frame head reload'),
    )
    expect(headTitles).toHaveLength(2)
    expect(document.head.querySelectorAll('meta[name="frame-head-reload"]')).toHaveLength(2)
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(2)
  })

  it('hoists head-managed elements on non-full-document top frame reload', async () => {
    document.body.innerHTML = '<main><p id="before-top-fragment">before</p></main>'

    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
      resolveFrame: async () =>
        [
          '<title>Top fragment reload</title>',
          '<meta name="top-fragment-meta" content="top-fragment" />',
          '<script type="application/ld+json">{"top":true}</script>',
          '<script type="text/javascript">window.__topRegular = true</script>',
          '<main><p id="after-top-fragment">after</p></main>',
        ].join(''),
    })
    await runtime.ready()
    await runtime.frames.top.reload()
    await waitFor(() => {
      expect(document.getElementById('after-top-fragment')).toBeTruthy()
    })

    expect(
      document.head.querySelector('meta[name="top-fragment-meta"]')?.getAttribute('content'),
    ).toBe('top-fragment')
    let topLdJsonScripts = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    expect(topLdJsonScripts.some((script) => script.textContent?.includes('"top":true'))).toBe(true)
    expect(document.querySelector('main title')).toBeNull()
    expect(document.querySelector('main meta[name="top-fragment-meta"]')).toBeNull()
    expect(document.querySelector('main script[type="application/ld+json"]')).toBeNull()
    expect(document.body.querySelector('script[type="text/javascript"]')).toBeTruthy()
  })

  it('hoists children from explicit head wrappers in top frame fragment reloads', async () => {
    document.body.innerHTML = '<main><p id="before-head-wrapper">before</p></main>'
    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
      resolveFrame: async () =>
        [
          '<head>',
          '<title>Head wrapper title</title>',
          '<meta name="head-wrapper-meta" content="head-wrapper" />',
          '</head>',
          '<main><p id="after-head-wrapper">after</p></main>',
        ].join(''),
    })
    await runtime.ready()
    await runtime.frames.top.reload()
    await waitFor(() => {
      expect(document.getElementById('after-head-wrapper')).toBeTruthy()
    })
    let headTitles = Array.from(document.head.querySelectorAll('title'))
    expect(headTitles.some((title) => title.textContent === 'Head wrapper title')).toBe(true)
    expect(document.head.querySelector('meta[name="head-wrapper-meta"]')?.getAttribute('content')).toBe(
      'head-wrapper',
    )
    expect(document.querySelector('main title')).toBeNull()
    expect(document.querySelector('main meta[name="head-wrapper-meta"]')).toBeNull()
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

    let resolveFrame = vi.fn(
      async () =>
        '<section id="panel"><h2 id="title">Activity</h2><p id="value">Server: 2</p></section>',
    )
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
    let renderFrameHtml = async (label: string, setup: number) =>
      readStream(
        renderToHTMLStream(
          <section id="panel">
            <h2 id="title">Activity</h2>
            <CounterEntry setup={setup} label={label} />
          </section>,
        ),
      )

    let initialHtml = await readStream(
      renderToHTMLStream(<frame name="panel" src="/frame/panel" />, {
        resolveFrame: async () => await renderFrameHtml('Count A', 1),
      }),
    )
    document.body.innerHTML = initialHtml

    let loadModule = vi.fn(
      async () =>
        function Counter(handle: any, initial: number) {
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
        },
    )
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
    template.innerHTML = [
      '<title>Late template title</title>',
      '<meta name="late-template-meta" content="late-template" />',
      '<script type="application/ld+json">{"late":true}</script>',
      '<script type="text/javascript">window.__lateTemplateScript = true</script>',
      '<p>resolved frame content</p>',
    ].join('')
    document.body.appendChild(template)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.body.innerHTML).toContain('resolved frame content')
    expect(document.body.innerHTML).not.toContain('loading frame')
    expect(
      document.head.querySelector('meta[name="late-template-meta"]')?.getAttribute('content'),
    ).toBe('late-template')
    let lateLdJsonScripts = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    expect(lateLdJsonScripts.some((script) => script.textContent?.includes('"late":true'))).toBe(true)
    expect(document.querySelector('main title')).toBeNull()
    expect(document.querySelector('main meta[name="late-template-meta"]')).toBeNull()
    expect(document.querySelector('main script[type="application/ld+json"]')).toBeNull()
    expect(document.querySelector('main script[type="text/javascript"]')).toBeTruthy()
  })

  it('consumes early frame templates that exist before boot starts', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- f:f1 --><p>loading frame</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"f":{"f1":{"status":"pending","name":"early","src":"/frame/early"}}}',
      '</script>',
      [
        '<template id="f1">',
        '<title>Early template title</title>',
        '<meta name="early-template-meta" content="early-template" />',
        '<script type="application/ld+json">{"early":true}</script>',
        '<script type="text/javascript">window.__earlyTemplateScript = true</script>',
        '<p>early resolved content</p>',
        '</template>',
      ].join(''),
      '</main>',
    ].join('')

    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
    })
    await runtime.ready()
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('early resolved content')
      expect(document.body.innerHTML).not.toContain('loading frame')
    })
    expect(
      document.head.querySelector('meta[name="early-template-meta"]')?.getAttribute('content'),
    ).toBe('early-template')
    let earlyLdJsonScripts = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    expect(earlyLdJsonScripts.some((script) => script.textContent?.includes('"early":true'))).toBe(true)
    expect(document.querySelector('main title')).toBeNull()
    expect(document.querySelector('main meta[name="early-template-meta"]')).toBeNull()
    expect(document.querySelector('main script[type="application/ld+json"]')).toBeNull()
    expect(document.querySelector('main script[type="text/javascript"]')).toBeTruthy()
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

    let resolveLateModule = (_value: Function) => {}
    let lateModulePromise = new Promise<Function>((resolve) => {
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

  it('reports malformed boundaries via runtime error events', async () => {
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
    })
    runtime.addEventListener('error', (event) => {
      if (!(event instanceof RuntimeErrorEvent)) return
      errors.push(event.error)
    })
    await runtime.ready()

    expect(errors.length).toBe(1)
  })

  it('dispatches runtime error when hydrated module export is not a component function', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h:h1 --><button>server</button><!-- /rmx:h -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"h1":{"moduleUrl":"/entries/bad.js","exportName":"Bad","props":{}}}}',
      '</script>',
      '</main>',
    ].join('')
    let errors: unknown[] = []
    let runtime = boot({
      document,
      loadModule: async () => ({ not: 'a component' }) as any,
    })
    runtime.addEventListener('error', (event) => {
      if (!(event instanceof RuntimeErrorEvent)) return
      errors.push(event.error)
    })
    await runtime.ready()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(errors.length).toBe(1)
    expect(String(errors[0])).toContain('is not a component function')
  })

  it('revives serialized element-like hydration props before rendering entries', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h:h1 --><button>server</button><!-- /rmx:h -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"h1":{"moduleUrl":"/entries/element-props.js","exportName":"Entry","props":{"badge":{"$rmx":true,"type":"strong","key":"badge-key","props":{"children":"badge text"}},"items":[{"$rmx":true,"type":"em","key":"i0","props":{"children":"item-0"}}]}}}}',
      '</script>',
      '</main>',
    ].join('')
    let runtime = boot({
      document,
      loadModule: async () => () => (props: { badge: any; items: any[] }) => (
        <article>
          {props.badge}
          {props.items[0]}
        </article>
      ),
    })
    await runtime.ready()

    expect(document.body.innerHTML).toContain('<strong>badge text</strong>')
    expect(document.body.innerHTML).toContain('<em>item-0</em>')
  })

  it('suppresses queued runtime error dispatch after dispose', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h:h1 --><button>server</button><!-- /rmx:h -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"h1":{"moduleUrl":"/entries/dispose.js","exportName":"Dispose","props":{}}}}',
      '</script>',
      '</main>',
    ].join('')
    let errorEvents = 0
    let runtime = boot({
      document,
      loadModule: async () => {
        throw new Error('late load failure')
      },
    })
    runtime.addEventListener('error', () => {
      errorEvents++
    })
    runtime.dispose()
    await runtime.ready()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(errorEvents).toBe(0)
  })

  it('reports malformed frame boundaries via runtime error events', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- f:broken --><p>broken frame</p>',
      '<script type="application/json" id="rmx-data">',
      '{"f":{"broken":{"status":"pending","src":"/broken"}}}',
      '</script>',
      '</main>',
    ].join('')
    let errors: unknown[] = []
    let runtime = boot({
      document,
      loadModule: async () => () => <button>never</button>,
    })
    runtime.addEventListener('error', (event) => {
      if (!(event instanceof RuntimeErrorEvent)) return
      errors.push(event.error)
    })
    await runtime.ready()

    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors.some((error) => String(error).includes('End marker not found'))).toBe(true)
  })

  it('ignores empty hydration and frame marker ids', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h: --><p>empty hydration id</p><!-- /rmx:h -->',
      '<!-- f: --><p>empty frame id</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"":{"moduleUrl":"/entries/ignored.js","exportName":"Ignored","props":{"label":"x"}}},"f":{"":{"status":"pending","src":"/ignored"}}}',
      '</script>',
      '</main>',
    ].join('')
    let loadModule = vi.fn(async () => () => () => <button>never</button>)
    let runtime = boot({
      document,
      loadModule,
    })
    await runtime.ready()

    expect(loadModule).toHaveBeenCalledTimes(0)
    expect(runtime.frames.get('')).toBeUndefined()
  })

  it('returns an aborted signal when reloading a disposed frame', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- f:f1 --><p>loading</p><!-- /f -->',
      '<script type="application/json" id="rmx-data">',
      '{"f":{"f1":{"status":"resolved","name":"disposed-frame","src":"/frame/disposed"}}}',
      '</script>',
      '</main>',
    ].join('')
    let runtime = boot({
      document,
      loadModule: async () => () => <button>noop</button>,
      resolveFrame: async () => '<div>frame content</div>',
    })
    await runtime.ready()

    let frame = runtime.frames.get('disposed-frame')
    expect(frame).toBeDefined()
    runtime.dispose()

    let signal = await frame!.reload()
    expect(signal.aborted).toBe(true)
    expect(String(signal.reason)).toContain('frame disposed')
  })

  it('dispose is idempotent when called multiple times', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h:h1 --><button>server</button><!-- /rmx:h -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"h1":{"moduleUrl":"/entries/idempotent.js","exportName":"Entry","props":{"label":"x"}}}}',
      '</script>',
      '</main>',
    ].join('')
    let runtime = boot({
      document,
      loadModule: async () => () => (props: { label: string }) => <button>{props.label}</button>,
    })
    await runtime.ready()

    runtime.dispose()
    runtime.dispose()
    expect(document.body.innerHTML).not.toContain('<button>x</button>')
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
