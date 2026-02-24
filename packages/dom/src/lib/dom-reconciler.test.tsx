import { describe, expect, it } from 'vitest'
import { createDomReconciler } from './dom-reconciler.ts'
import { on } from './dom-plugins.ts'

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
})
