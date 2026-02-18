import { describe, expect, it } from 'vitest'
import { createDomReconciler } from './dom-reconciler.ts'

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
        on={{
          click() {
            clicks++
          },
        }}
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
})
