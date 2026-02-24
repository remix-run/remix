import { describe, expect, it } from 'vitest'
import { createDomReconciler } from '../dom-reconciler.ts'
import { basicPropsPlugin } from './basic-props-plugin.ts'
import { attributePropsPlugin } from './attribute-props-plugin.ts'

describe('attribute props plugin', () => {
  it('normalizes special HTML and SVG attribute prop names', () => {
    let reconciler = createDomReconciler(document, [attributePropsPlugin as any, basicPropsPlugin as any])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <main tabIndex={1} className="app" acceptCharset="utf-8" httpEquiv="x">
        <svg viewBox="0 0 10 10">
          <use xlinkHref="#icon" />
        </svg>
      </main>,
    )
    root.flush()

    let main = container.firstElementChild as HTMLElement
    expect(main.getAttribute('tabindex')).toBe('1')
    expect(main.getAttribute('class')).toBe('app')
    expect(main.getAttribute('accept-charset')).toBe('utf-8')
    expect(main.getAttribute('http-equiv')).toBe('x')
    let use = main.querySelector('use')
    expect(use?.getAttribute('xlink:href')).toBe('#icon')
  })
})
