import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { createMixin } from '../index.ts'
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
    let withNested = createMixin((handle) => (value: string, props: { ['data-mixed']?: string }) => (
      <handle.element {...props} mix={[withData(value)]} />
    ))

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
})
