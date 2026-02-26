import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { createMixin } from '../index.ts'
import { invariant } from '../lib/invariant.ts'

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
})
