import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { createMixin, on, ref } from '../index.ts'
import { invariant } from '../lib/invariant.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode mixins', () => {
  it('composes mixins in order and does not leak mix to the DOM', () => {
    let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
      <handle.element {...props} title={title} />
    ))
    let appendTitle = createMixin((handle) => (suffix: string, props: { title?: string }) => (
      <handle.element {...props} title={`${props.title ?? ''}${suffix}`} />
    ))

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<div mix={[withTitle('hello'), appendTitle('-world')]} />)

    let div = container.querySelector('div')
    invariant(div)
    expect(div.getAttribute('title')).toBe('hello-world')
    expect(div.hasAttribute('mix')).toBe(false)
  })

  it('supports nested mix descriptors via handle.element', () => {
    let withData = createMixin((handle) => (value: string, props: { ['data-mixed']?: string }) => (
      <handle.element {...props} data-mixed={value} />
    ))
    let withNested = createMixin(
      (handle) => (value: string, props: { ['data-mixed']?: string }) => (
        <handle.element {...props} mix={[withData(value)]} />
      ),
    )

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<div mix={[withNested('nested')]} />)

    let div = container.querySelector('div')
    invariant(div)
    expect(div.getAttribute('data-mixed')).toBe('nested')
  })

  it('shares one handle instance across mixins on the same host node', () => {
    let handles: unknown[] = []
    let one = createMixin((handle) => {
      handles.push(handle)
    })
    let two = createMixin((handle) => {
      handles.push(handle)
    })
    let three = createMixin((handle) => {
      handles.push(handle)
    })

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<div mix={[one(), two(), three()]} />)
    root.flush()

    expect(handles.length).toBe(3)
    expect(handles[0]).toBe(handles[1])
    expect(handles[1]).toBe(handles[2])
  })

  it('aborts handle.signal when the host node is removed', () => {
    let signal = AbortSignal.abort()
    let withSignal = createMixin((handle) => {
      signal = handle.signal
    })

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<div mix={[withSignal()]} />)
    root.flush()
    expect(signal.aborted).toBe(false)

    root.render(null)
    root.flush()
    expect(signal.aborted).toBe(true)
  })

  it('supports setup-only passthrough mixins', () => {
    let withPassthrough = createMixin((_handle) => {})
    let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
      <handle.element {...props} title={title} />
    ))

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<div mix={[withPassthrough(), withTitle('ok')]} />)
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    expect(div.getAttribute('title')).toBe('ok')
  })

  it('does not duplicate on handlers for passthrough mixins', () => {
    let clicks = 0
    let passthrough = createMixin((_handle) => {})

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <button
        mix={[
          passthrough(),
          on('click', () => {
            clicks++
          }),
        ]}
      />,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    root.flush()

    expect(clicks).toBe(1)
  })

  it('runs remove lifecycle when descriptor type changes and on unmount', () => {
    let removedA = 0
    let removedB = 0
    let persistApiSeenOnRemoveA = false
    let persistApiSeenOnRemoveB = false

    let a = createMixin((handle) => {
      handle.addEventListener('remove', (event) => {
        removedA++
        persistApiSeenOnRemoveA = 'persistNode' in event
      })
      return (props: { id?: string }) => <handle.element {...props} id="a" />
    })

    let b = createMixin((handle) => {
      handle.addEventListener('remove', (event) => {
        removedB++
        persistApiSeenOnRemoveB = 'persistNode' in event
      })
      return (props: { id?: string }) => <handle.element {...props} id="b" />
    })

    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(<div mix={[a()]} />)
    root.render(<div mix={[b()]} />)
    root.render(null)

    expect(removedA).toBe(1)
    expect(removedB).toBe(1)
    expect(persistApiSeenOnRemoveA).toBe(false)
    expect(persistApiSeenOnRemoveB).toBe(false)
  })

  it('exposes persistNode in beforeRemove lifecycle', () => {
    let beforeRemoveCalls = 0
    let persistApiSeen = false

    let withBeforeRemove = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => {
        beforeRemoveCalls++
        persistApiSeen = typeof event.persistNode === 'function'
      })
      return (props: { id?: string }) => <handle.element {...props} id="before-remove" />
    })

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<div mix={[withBeforeRemove()]} />)
    root.flush()
    root.render(null)
    root.flush()

    expect(beforeRemoveCalls).toBe(1)
    expect(persistApiSeen).toBe(true)
  })

  it('runs insert lifecycle with the bound host node', () => {
    let insertedNode: Element | null = null
    let insertCount = 0

    let withInsert = createMixin((handle) => {
      handle.addEventListener('insert', (event) => {
        insertedNode = event.node
        insertCount++
      })
      return (props: { id?: string }) => <handle.element {...props} id="inserted" />
    })

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<div mix={[withInsert()]} />)
    root.flush()
    root.render(<div mix={[withInsert()]} />)
    root.flush()

    let div = container.querySelector('#inserted')
    invariant(div)
    expect(insertedNode).toBe(div)
    expect(insertCount).toBe(1)
  })

  it('runs beforeUpdate and commit lifecycle events in update order', () => {
    let calls: string[] = []
    let withUpdateLifecycle = createMixin((handle) => {
      handle.addEventListener('beforeUpdate', (event) => {
        calls.push(`before:${(event.node as HTMLElement).dataset.step}`)
      })
      handle.addEventListener('commit', (event) => {
        calls.push(`commit:${(event.node as HTMLElement).dataset.step}`)
      })
      return (step: string, props: { ['data-step']?: string }) => (
        <handle.element {...props} data-step={step} />
      )
    })

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<div mix={[withUpdateLifecycle('0')]} />)
    root.flush()
    root.render(<div mix={[withUpdateLifecycle('1')]} />)
    root.flush()

    expect(calls).toEqual(['before:0', 'commit:1'])
  })

  it('composes ref callbacks across mixins and base mix', () => {
    let calls: string[] = []

    let withConnectA = createMixin((handle) => (props: {}) => (
      <handle.element
        {...props}
        mix={[
          ref((node: Element) => {
            calls.push('a')
            if (node instanceof HTMLElement) {
              node.dataset.a = '1'
            }
          }),
        ]}
      />
    ))

    let withConnectB = createMixin((handle) => (props: {}) => (
      <handle.element
        {...props}
        mix={[
          ref((node: Element) => {
            calls.push('b')
            if (node instanceof HTMLElement) {
              node.dataset.b = '1'
            }
          }),
        ]}
      />
    ))

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <div
        mix={[
          withConnectA(),
          withConnectB(),
          ref((node: Element) => {
            calls.push('base')
            if (node instanceof HTMLElement) {
              node.dataset.base = '1'
            }
          }),
        ]}
      />,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    expect(div.dataset.a).toBe('1')
    expect(div.dataset.b).toBe('1')
    expect(div.dataset.base).toBe('1')
    expect(new Set(calls)).toEqual(new Set(['a', 'b', 'base']))
  })

  it('composes on mixins across nested mixins', () => {
    let calls: string[] = []

    let withOnA = createMixin<HTMLElement>((handle) => (props: {}) => (
      <handle.element
        {...props}
        mix={[
          on('click', () => {
            calls.push('a')
          }),
        ]}
      />
    ))

    let withOnB = createMixin<HTMLElement>((handle) => (props: {}) => (
      <handle.element
        {...props}
        mix={[
          on('click', () => {
            calls.push('b')
          }),
        ]}
      />
    ))

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <button
        mix={[
          withOnA(),
          withOnB(),
          on('click', () => {
            calls.push('base')
          }),
        ]}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.click()
    root.flush()
    expect(calls).toEqual(['base', 'a', 'b'])
  })

  it('supports on mixin helper composition standalone', () => {
    let calls: string[] = []
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          on('click', () => {
            calls.push('first')
          }),
          on('click', () => {
            calls.push('second')
          }),
        ]}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.click()
    root.flush()
    expect(calls).toEqual(['first', 'second'])
  })

  it('updates only host props when mixin calls handle.update', () => {
    let appRenderCount = 0

    let withCounter = createMixin<HTMLButtonElement>((handle) => {
      let count = 0
      return (props: { ['data-count']?: string }) => (
        <handle.element
          {...props}
          data-count={String(count)}
          mix={[
            on('click', () => {
              count++
              handle.update()
            }),
          ]}
        />
      )
    })

    function App(_handle: Handle) {
      appRenderCount++
      return () => <button mix={[withCounter()]}>click</button>
    }

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<App />)
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    expect(button.getAttribute('data-count')).toBe('0')
    expect(appRenderCount).toBe(1)

    button.click()
    root.flush()

    expect(button.getAttribute('data-count')).toBe('1')
    expect(appRenderCount).toBe(1)
  })

  it('dispatches reclaimed on persisted reuse without rerunning insert or remove', async () => {
    let insertCalls = 0
    let reclaimedCalls = 0
    let removeCalls = 0
    let beforeRemoveCalls = 0
    let resolvePending: (() => void) | null = null

    let withReclaimLifecycle = createMixin((handle) => {
      handle.addEventListener('insert', () => {
        insertCalls++
      })
      handle.addEventListener('reclaimed', () => {
        reclaimedCalls++
      })
      handle.addEventListener('beforeRemove', (event) => {
        beforeRemoveCalls++
        event.persistNode(
          (signal) =>
            new Promise<void>((resolve) => {
              let done = () => resolve()
              resolvePending = done
              signal.addEventListener('abort', done, { once: true })
            }),
        )
      })
      handle.addEventListener('remove', () => {
        removeCalls++
      })
      return (props: { id?: string }) => <handle.element {...props} id="reclaimed-target" />
    })

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<div key="reclaimed" mix={[withReclaimLifecycle()]} />)
    root.flush()
    expect(insertCalls).toBe(1)
    expect(reclaimedCalls).toBe(0)
    expect(removeCalls).toBe(0)

    root.render(null)
    root.flush()
    await Promise.resolve()
    expect(beforeRemoveCalls).toBe(1)
    expect(removeCalls).toBe(0)

    root.render(<div key="reclaimed" mix={[withReclaimLifecycle()]} />)
    root.flush()
    await Promise.resolve()

    expect(insertCalls).toBe(1)
    expect(reclaimedCalls).toBe(1)
    expect(removeCalls).toBe(0)

    if (resolvePending !== null) {
      ;(resolvePending as () => void)()
    }
  })

  it('defers host removal when beforeRemove.persistNode is used', async () => {
    let releaseRemoval: (() => void) | null = null
    let beforeRemoveCalls = 0
    let removeCalls = 0
    let withDeferredRemove = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => {
        beforeRemoveCalls++
        event.persistNode(
          () =>
            new Promise<void>((resolve) => {
              releaseRemoval = () => resolve()
            }),
        )
      })
      handle.addEventListener('remove', () => {
        removeCalls++
      })
      return (props: { id?: string }) => <handle.element {...props} id="deferred-remove" />
    })

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<div key="deferred" mix={[withDeferredRemove()]} />)
    root.flush()

    let beforeRemove = container.querySelector('#deferred-remove')
    invariant(beforeRemove)

    root.render(null)
    root.flush()
    await Promise.resolve()
    expect(beforeRemoveCalls).toBe(1)
    expect(removeCalls).toBe(0)
    expect(container.querySelector('#deferred-remove')).toBe(beforeRemove)

    let release =
      releaseRemoval ??
      (() => {
        throw new Error('expected deferred remove callback')
      })
    release()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(removeCalls).toBe(1)
    expect(container.querySelector('#deferred-remove')).toBe(null)
  })
})
