import { describe, expect, it } from 'vitest'
import { createDomReconciler } from './dom-reconciler.ts'
import { createMixin, mixPlugin, on } from './dom-plugins.ts'

describe('dom mix plugin', () => {
  it('runs mix mixins with stable plugin-scope setup and unmount cleanup', () => {
    let pluginScopeCalls = 0
    let nodeScopeCalls = 0
    let updates: string[] = []
    let cleanups = 0

    let track = createMixin<[string], HTMLButtonElement>(() => {
      pluginScopeCalls++
      return (handle, _node) => {
        nodeScopeCalls++
        handle.addEventListener('remove', () => {
          cleanups++
        })
        return (value: string = '') => {
          if (value) updates.push(value)
        }
      }
    })

    let value = 'first'
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(<button mix={[track(value)]}>hello</button>)
    root.flush()
    expect(pluginScopeCalls).toBe(1)
    expect(nodeScopeCalls).toBe(1)
    expect(updates).toEqual(['first'])
    expect(cleanups).toBe(0)

    value = 'second'
    root.render(<button mix={[track(value)]}>hello</button>)
    root.flush()
    expect(pluginScopeCalls).toBe(1)
    expect(nodeScopeCalls).toBe(1)
    expect(updates).toEqual(['first', 'second'])
    expect(cleanups).toBe(0)

    root.render(null)
    root.flush()
    expect(cleanups).toBe(1)
  })

  it('merges returned props so routed plugins can apply them', () => {
    let observedClassNames: string[] = []
    let addClass = createMixin<[string], HTMLButtonElement>(() => () => (name, currentProps) => {
      let existing = typeof currentProps.className === 'string' ? currentProps.className : ''
      let next = existing ? `${existing} ${name}` : name
      observedClassNames.push(next)
      return null
    })

    let reconciler = createDomReconciler(document, [mixPlugin])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(<button className="base" mix={[addClass('from-mix')]}>hello</button>)
    root.flush()
    expect(observedClassNames).toEqual(['base from-mix'])

    root.render(<button className="next" mix={[addClass('again')]}>hello</button>)
    root.flush()
    expect(observedClassNames).toEqual(['base from-mix', 'next again'])
  })

  it('supports on mixin with reentry signal', () => {
    let firstSignal: null | AbortSignal = null
    let secondSignal: null | AbortSignal = null
    let calls = 0
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          on('click', (_event, reentrySignal) => {
            calls++
            if (calls === 1) firstSignal = reentrySignal
            if (calls === 2) secondSignal = reentrySignal
          }),
        ]}
      >
        hello
      </button>,
    )
    root.flush()
    let button = container.firstElementChild as HTMLButtonElement
    button.click()
    button.click()

    expect(calls).toBe(2)
    if (!firstSignal || !secondSignal) {
      throw new Error('expected reentry signals')
    }
    let initialSignal = firstSignal as AbortSignal
    let latestSignal = secondSignal as AbortSignal
    expect(initialSignal.aborted).toBe(true)
    expect(latestSignal.aborted).toBe(false)
  })

  it('composes nested mixins returned from mixin render', () => {
    let clicks = 0
    let composed = createMixin<[], HTMLButtonElement>(() => () => () => ({
      mix: [
        on('click', () => {
          clicks++
        }),
      ],
    }))

    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(<button mix={[composed()]}>hello</button>)
    root.flush()
    let button = container.firstElementChild as HTMLButtonElement
    button.click()
    expect(clicks).toBe(1)
  })
})
