import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { css } from './css.ts'

describe('plugin-spike css plugin', () => {
  it('applies data-css and removes raw css prop', () => {
    let reconciler = createReconciler([css])
    let container = document.createElement('div')
    document.body.append(container)
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div
        key="root"
        css={{ color: 'rgb(255, 0, 0)' }}
        connect={() => {}}
      >
        hello
      </div>
    ))
    root.flush()

    let element = container.querySelector('div')
    if (!element) throw new Error('expected div')
    expect(element.hasAttribute('css')).toBe(false)
    expect(element.getAttribute('data-css')).toBeTruthy()
    expect(getComputedStyle(element).color).toBe('rgb(255, 0, 0)')

    root.dispose()
    container.remove()
  })

  it('updates css by swapping selector and stylesheet rule', () => {
    let color = 'rgb(255, 0, 0)'
    let reconciler = createReconciler([css])
    let container = document.createElement('div')
    document.body.append(container)
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div key="root" css={{ color }} connect={() => {}}>
        hello
      </div>
    ))
    root.flush()

    let element = container.querySelector('div')
    if (!element) throw new Error('expected div')
    let firstSelector = element.getAttribute('data-css')
    expect(firstSelector).toBeTruthy()
    expect(getComputedStyle(element).color).toBe('rgb(255, 0, 0)')

    color = 'rgb(0, 0, 255)'
    root.render(() => (
      <div key="root" css={{ color }} connect={() => {}}>
        hello
      </div>
    ))
    root.flush()

    element = container.querySelector('div')
    if (!element) throw new Error('expected div')
    let secondSelector = element.getAttribute('data-css')
    expect(secondSelector).toBeTruthy()
    expect(secondSelector).not.toBe(firstSelector)
    expect(getComputedStyle(element).color).toBe('rgb(0, 0, 255)')

    root.dispose()
    container.remove()
  })
})
