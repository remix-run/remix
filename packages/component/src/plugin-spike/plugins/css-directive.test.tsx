import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { attributeProps } from './attribute-props.ts'
import { css } from './css-directive.ts'
import { use } from './use.ts'

describe('plugin-spike css directive', () => {
  it('applies and updates styles through use=[css(...)]', () => {
    let color = 'rgb(255, 0, 0)'
    let reconciler = createReconciler([use, attributeProps])
    let container = document.createElement('div')
    document.body.append(container)
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div key="root" use={[css({ color })]}>
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
      <div key="root" use={[css({ color })]}>
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

  it('clears data-css when directive is removed', () => {
    let withCss = true
    let reconciler = createReconciler([use, attributeProps])
    let container = document.createElement('div')
    document.body.append(container)
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div key="root" use={withCss ? [css({ color: 'rgb(255, 0, 0)' })] : []}>
        hello
      </div>
    ))
    root.flush()

    let element = container.querySelector('div')
    if (!element) throw new Error('expected div')
    expect(element.getAttribute('data-css')).toBeTruthy()

    withCss = false
    root.render(() => (
      <div key="root" use={withCss ? [css({ color: 'rgb(255, 0, 0)' })] : []}>
        hello
      </div>
    ))
    root.flush()

    element = container.querySelector('div')
    if (!element) throw new Error('expected div')
    expect(element.hasAttribute('data-css')).toBe(false)

    root.dispose()
    container.remove()
  })
})
