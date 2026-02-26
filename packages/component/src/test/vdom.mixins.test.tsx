import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { createMixin, on } from '../index.ts'
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

  it('runs remove lifecycle when descriptor type changes and on unmount', () => {
    let removedA = 0
    let removedB = 0

    let a = createMixin((handle) => {
      handle.addEventListener('remove', () => {
        removedA++
      })
      return (props: { id?: string }) => <handle.element {...props} id="a" />
    })

    let b = createMixin((handle) => {
      handle.addEventListener('remove', () => {
        removedB++
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

  it('composes connect callbacks across mixins and base props', () => {
    let calls: string[] = []

    let withConnectA = createMixin((handle) => (props: { connect?: (node: Element) => void }) => (
      <handle.element
        {...props}
        connect={(node: Element) => {
          calls.push('a')
          if (node instanceof HTMLElement) {
            node.dataset.a = '1'
          }
        }}
      />
    ))

    let withConnectB = createMixin((handle) => (props: { connect?: (node: Element) => void }) => (
      <handle.element
        {...props}
        connect={(node: Element) => {
          calls.push('b')
          if (node instanceof HTMLElement) {
            node.dataset.b = '1'
          }
        }}
      />
    ))

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <div
        connect={(node: Element) => {
          calls.push('base')
          if (node instanceof HTMLElement) {
            node.dataset.base = '1'
          }
        }}
        mix={[withConnectA(), withConnectB()]}
      />,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    expect(div.dataset.a).toBe('1')
    expect(div.dataset.b).toBe('1')
    expect(div.dataset.base).toBe('1')
    expect(calls).toEqual(['b', 'a', 'base'])
  })

  it('composes on listeners across mixins and base props', () => {
    let calls: string[] = []

    let withOnA = createMixin((handle) => (props: { on?: { click?: () => void } }) => (
      <handle.element
        {...props}
        on={{
          click() {
            calls.push('a')
          },
        }}
      />
    ))

    let withOnB = createMixin((handle) => (props: { on?: { click?: () => void } }) => (
      <handle.element
        {...props}
        on={{
          click() {
            calls.push('b')
          },
        }}
      />
    ))

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <button
        on={{
          click() {
            calls.push('base')
          },
        }}
        mix={[withOnA(), withOnB()]}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.click()
    root.flush()
    expect(calls).toEqual(['b', 'a', 'base'])
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

    let withCounter = createMixin((handle) => {
      let count = 0
      return (props: { ['data-count']?: string; on?: { click?: () => void } }) => (
        <handle.element
          {...props}
          data-count={String(count)}
          on={{
            ...props.on,
            click() {
              count++
              handle.update()
            },
          }}
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

  it('defers host removal when remove.persistNode is used', async () => {
    let releaseRemoval: (() => void) | null = null
    let removeCalls = 0
    let withDeferredRemove = createMixin((handle) => {
      handle.addEventListener('remove', (event) => {
        removeCalls++
        event.persistNode(
          () =>
            new Promise<void>((resolve) => {
              releaseRemoval = () => resolve()
            }),
        )
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
    expect(removeCalls).toBe(1)
    expect(container.querySelector('#deferred-remove')).toBe(beforeRemove)

    let release =
      releaseRemoval ??
      (() => {
        throw new Error('expected deferred remove callback')
      })
    release()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container.querySelector('#deferred-remove')).toBe(null)
  })
})
