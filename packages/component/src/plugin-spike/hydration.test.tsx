import { describe, expect, it } from 'vitest'

import { createReconciler } from './index.ts'
import { attributeProps } from './plugins/attribute-props.ts'

describe('plugin-spike hydration mechanics and policy', () => {
  it('adopts existing dom with default hydration policy', () => {
    let reconciler = createReconciler([attributeProps])
    let container = document.createElement('div')
    container.innerHTML = '<div id="root">hello</div>'
    let existing = container.firstElementChild
    if (!existing) throw new Error('expected existing node')

    let root = reconciler.createRoot(container, { hydrate: true })
    root.render(() => <div id="root">hello</div>)
    root.flush()

    expect(container.firstElementChild).toBe(existing)
    expect(container.innerHTML).toBe('<div id="root">hello</div>')
  })

  it('allows policy to force fallback creation', () => {
    let mismatches = 0
    let reconciler = createReconciler([attributeProps])
    let container = document.createElement('div')
    container.innerHTML = '<div id="root">hello</div>'
    let existing = container.firstElementChild
    if (!existing) throw new Error('expected existing node')

    let root = reconciler.createRoot(container, {
      hydrate: true,
      hydrationPolicy: {
        matchElement() {
          return false
        },
        onElementMismatch() {
          mismatches++
        },
      },
    })
    root.render(() => <div id="root">hello</div>)
    root.flush()

    expect(container.firstElementChild).not.toBe(existing)
    expect(mismatches).toBe(1)
    expect(container.innerHTML).toBe('<div id="root">hello</div>')
  })

  it('hydrates a nested tree and preserves existing nodes', () => {
    let reconciler = createReconciler([attributeProps])
    let container = document.createElement('div')
    container.innerHTML =
      '<main id="app"><h1>Title</h1><section><p>Alpha <strong>Beta</strong></p><ul><li>One</li><li>Two</li></ul></section></main>'

    let existingMain = container.querySelector('main')
    let existingStrong = container.querySelector('strong')
    let existingSecondLi = container.querySelectorAll('li')[1]
    if (!existingMain || !existingStrong || !existingSecondLi) {
      throw new Error('expected existing nested nodes')
    }

    let root = reconciler.createRoot(container, { hydrate: true })
    root.render(() => (
      <main id="app">
        <h1>Title</h1>
        <section>
          <p>
            Alpha <strong>Beta</strong>
          </p>
          <ul>
            <li>One</li>
            <li>Two</li>
          </ul>
        </section>
      </main>
    ))
    root.flush()

    expect(container.querySelector('main')).toBe(existingMain)
    expect(container.querySelector('strong')).toBe(existingStrong)
    expect(container.querySelectorAll('li')[1]).toBe(existingSecondLi)
    expect(container.innerHTML).toBe(
      '<main id="app"><h1>Title</h1><section><p>Alpha <strong>Beta</strong></p><ul><li>One</li><li>Two</li></ul></section></main>',
    )
  })

  it('hydrates sibling text children from one consolidated server text node', () => {
    let one = 'one'
    let two = 'two'
    let reconciler = createReconciler([attributeProps])
    let container = document.createElement('div')
    container.innerHTML = '<div>one two</div>'
    let existingDiv = container.firstElementChild

    let root = reconciler.createRoot(container, { hydrate: true })
    root.render(() => (
      <div>
        {one} {two}
      </div>
    ))
    root.flush()

    let hydratedDiv = container.firstElementChild
    if (!hydratedDiv) throw new Error('expected hydrated div')
    expect(hydratedDiv).toBe(existingDiv)
    expect(hydratedDiv.firstChild!.textContent).toBe('one')
    expect(hydratedDiv.textContent).toBe('one two')
    expect(container.innerHTML).toBe('<div>one two</div>')
  })

  it('hydrates mixed text and element children with sibling text nodes', () => {
    let one = 'one'
    let two = 'two'
    let reconciler = createReconciler([attributeProps])
    let container = document.createElement('div')
    let serverDiv = document.createElement('div')
    let textOne = document.createTextNode('one ')
    let span = document.createElement('span')
    span.textContent = 'two'
    serverDiv.append(textOne, span)
    container.append(serverDiv)

    let root = reconciler.createRoot(container, { hydrate: true })
    root.render(() => (
      <div>
        {one} <span>{two}</span>
      </div>
    ))
    root.flush()

    let hydratedDiv = container.firstElementChild
    if (!hydratedDiv) throw new Error('expected hydrated div')
    expect(hydratedDiv).toBe(serverDiv)
    expect(hydratedDiv.firstChild).toBe(textOne)
    expect(hydratedDiv.querySelector('span')).toBe(span)
    expect(container.innerHTML).toBe('<div>one <span>two</span></div>')
  })
})
