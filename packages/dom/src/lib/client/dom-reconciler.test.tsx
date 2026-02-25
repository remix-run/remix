import { describe, expect, it } from 'vitest'
import { createDomReconciler } from './dom-reconciler.ts'
import { on } from './mixins/on-mixin.tsx'

describe('dom reconciler plugins', () => {
  it('applies on/style/basic props and updates/removes them', () => {
    let clicks = 0
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        id="first"
        data-id="123"
        style={{ color: 'red' }}
        mix={[
          on('click', () => {
            clicks++
          }),
        ]}
      >
        hello
      </button>,
    )
    root.flush()

    let button = container.firstElementChild as HTMLButtonElement
    expect(button).toBeTruthy()
    expect(button.id).toBe('first')
    expect(button.getAttribute('data-id')).toBe('123')
    expect(button.style.color).toBe('red')
    button.click()
    expect(clicks).toBe(1)

    root.render(
      <button id="second" style={{ backgroundColor: 'black' }}>
        hello
      </button>,
    )
    root.flush()

    let updated = container.firstElementChild as HTMLButtonElement
    expect(updated.id).toBe('second')
    expect(updated.getAttribute('data-id')).toBeNull()
    expect(updated.style.color).toBe('')
    expect(updated.style.backgroundColor).toBe('black')
    updated.click()
    expect(clicks).toBe(1)
  })

  it('supports rendering and removing within range root boundaries', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let before = document.createElement('before')
    let start = document.createComment('range:start')
    let end = document.createComment('range:end')
    let after = document.createElement('after')
    container.append(before, start, end, after)
    let root = reconciler.createRoot([start, end])

    root.render(
      <>
        <a>A</a>
        <b>B</b>
      </>,
    )
    root.flush()
    expect(container.innerHTML).toBe(
      '<before></before><!--range:start--><a>A</a><b>B</b><!--range:end--><after></after>',
    )

    root.remove()
    root.flush()
    expect(container.innerHTML).toBe(
      '<before></before><!--range:start--><!--range:end--><after></after>',
    )
  })

  it('adopts single server text node when client has multiple text children', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    container.innerHTML = '<span>Hello world</span>'

    let existingSpan = container.querySelector('span')
    expect(existingSpan).toBeTruthy()

    let root = reconciler.createRoot(container)
    root.render(
      <span>
        {'Hello '}
        {'world'}
      </span>,
    )
    root.flush()

    expect(container.querySelector('span')).toBe(existingSpan)
    expect(existingSpan?.textContent).toBe('Hello world')
    expect(existingSpan?.childNodes.length).toBe(2)
    expect(existingSpan?.childNodes[0]?.nodeType).toBe(Node.TEXT_NODE)
    expect(existingSpan?.childNodes[1]?.nodeType).toBe(Node.TEXT_NODE)
    expect(existingSpan?.childNodes[0]?.textContent).toBe('Hello ')
    expect(existingSpan?.childNodes[1]?.textContent).toBe('world')
  })

  it('patches dynamic text updates after adopting split text children', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    container.innerHTML = '<span>Hello world</span>'

    let existingSpan = container.querySelector('span')
    expect(existingSpan).toBeTruthy()

    let root = reconciler.createRoot(container)
    let name = 'world'
    let render = () => {
      root.render(
        <span>
          {'Hello '}
          {name}
        </span>,
      )
      root.flush()
    }

    render()
    expect(existingSpan?.textContent).toBe('Hello world')

    name = 'Ryan'
    render()
    expect(existingSpan?.textContent).toBe('Hello Ryan')
    expect(existingSpan?.childNodes.length).toBe(2)
    expect(existingSpan?.childNodes[0]?.textContent).toBe('Hello ')
    expect(existingSpan?.childNodes[1]?.textContent).toBe('Ryan')
  })

  it('patches mixed dynamic text nodes after hydration split', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    container.innerHTML = '<span>Hello world!</span>'

    let existingSpan = container.querySelector('span')
    expect(existingSpan).toBeTruthy()

    let root = reconciler.createRoot(container)
    let who = 'world'
    let punctuation = '!'
    let render = () => {
      root.render(
        <span>
          {'Hello '}
          {who}
          {punctuation}
        </span>,
      )
      root.flush()
    }

    render()
    expect(existingSpan?.childNodes.length).toBe(3)
    expect(existingSpan?.textContent).toBe('Hello world!')

    who = 'Ryan'
    punctuation = '!!'
    render()
    expect(existingSpan?.childNodes.length).toBe(3)
    expect(existingSpan?.textContent).toBe('Hello Ryan!!')
    expect(existingSpan?.childNodes[0]?.textContent).toBe('Hello ')
    expect(existingSpan?.childNodes[1]?.textContent).toBe('Ryan')
    expect(existingSpan?.childNodes[2]?.textContent).toBe('!!')
  })
})
