import { describe, expect, it, vi } from 'vitest'
import { hydrateClientEntries } from './client-runtime.ts'

describe('hydrateClientEntries', () => {
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
    let loadModule = vi.fn(async (moduleUrl: string) => {
      if (moduleUrl === '/entries/a.js') {
        return () => (props: { label: string }) => <button>{`client ${props.label}`}</button>
      }
      return () => (props: { label: string }) => <button>{`client ${props.label}`}</button>
    })

    let result = await hydrateClientEntries({
      document,
      loadModule,
    })

    expect(result).toMatchObject({
      flush: expect.any(Function),
      dispose: expect.any(Function),
    })
    result.flush()
    expect(loadModule).toHaveBeenCalledTimes(2)
    expect(document.body.innerHTML).toContain('client A')
    expect(document.body.innerHTML).toContain('client B')
  })

  it('dedupes module loads across multiple boundaries of one entry', async () => {
    document.body.innerHTML = [
      '<section>',
      '<!-- rmx:h:shared1 --><button>x</button><!-- /rmx:h -->',
      '<!-- rmx:h:shared2 --><button>y</button><!-- /rmx:h -->',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"shared1":{"moduleUrl":"/entries/shared.js","exportName":"Entry","props":{"label":"X"}},"shared2":{"moduleUrl":"/entries/shared.js","exportName":"Entry","props":{"label":"Y"}}}}',
      '</script>',
      '</section>',
    ].join('')
    let loadModule = vi.fn(async () => () => (props: { label: string }) => (
      <button>{props.label}</button>
    ))

    let result = await hydrateClientEntries({ document, loadModule })
    result.flush()
    expect(loadModule).toHaveBeenCalledTimes(1)
    expect(document.body.innerHTML).toContain('X')
    expect(document.body.innerHTML).toContain('Y')
  })

  it('hydrates with range roots and keeps nodes outside the boundary untouched', async () => {
    document.body.innerHTML = [
      '<div id="before">before</div>',
      '<!-- rmx:h:counter --><button id="counter">0</button><!-- /rmx:h -->',
      '<div id="after">after</div>',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"counter":{"moduleUrl":"/entries/counter.js","exportName":"Counter","props":{"label":"count"}}}}',
      '</script>',
    ].join('')
    let before = document.getElementById('before')
    let after = document.getElementById('after')
    let serverButton = document.getElementById('counter')

    let hydratedRoot = await hydrateClientEntries({
      document,
      loadModule: async () => () => (props: { label: string }) => (
        <button id="counter">{props.label}</button>
      ),
    })
    hydratedRoot.flush()

    let hydratedButton = document.getElementById('counter')
    expect(document.getElementById('before')).toBe(before)
    expect(document.getElementById('after')).toBe(after)
    expect(hydratedButton).toBe(serverButton)
    expect(hydratedButton?.textContent).toBe('count')

    hydratedRoot.dispose()
    expect(document.getElementById('before')).toBe(before)
    expect(document.getElementById('after')).toBe(after)
    expect(document.getElementById('counter')).toBeNull()
  })

  it('skips malformed boundaries and reports them via onError', async () => {
    document.body.innerHTML = [
      '<main>',
      '<!-- rmx:h:oops --><button>server</button>',
      '<script type="application/json" id="rmx-data">',
      '{"h":{"oops":{"moduleUrl":"/entries/oops.js","exportName":"Oops","props":{}}}}',
      '</script>',
      '</main>',
    ].join('')
    let errors: unknown[] = []

    let result = await hydrateClientEntries({
      document,
      loadModule: async () => () => () => <button>never</button>,
      onError(error) {
        errors.push(error)
      },
    })

    expect(result).toMatchObject({
      flush: expect.any(Function),
      dispose: expect.any(Function),
    })
    expect(errors.length).toBe(1)
  })
})
