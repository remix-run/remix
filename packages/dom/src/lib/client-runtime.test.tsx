import { describe, expect, it, vi } from 'vitest'
import { boot } from './client-runtime.ts'

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
