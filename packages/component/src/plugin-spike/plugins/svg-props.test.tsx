import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { svgProps } from './svg-props.ts'

describe('plugin-spike svg-props plugin', () => {
  it('normalizes svg camelCase props and xlink namespace', () => {
    let reconciler = createReconciler([svgProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)
    let xlinkNamespace = 'http://www.w3.org/1999/xlink'

    root.render(() => <svg key="a" viewBox="0 0 10 10" strokeWidth={2} xlinkHref="#shape" />)
    root.flush()

    let node = container.querySelector('svg')
    if (!node) throw new Error('expected svg')
    expect(node.getAttribute('viewBox')).toBe('0 0 10 10')
    expect(node.getAttribute('stroke-width')).toBe('2')
    expect(node.getAttributeNS(xlinkNamespace, 'href')).toBe('#shape')

    root.render(() => <svg key="a" />)
    root.flush()
    expect(node.hasAttribute('stroke-width')).toBe(false)
    expect(node.getAttributeNS(xlinkNamespace, 'href')).toBeNull()
  })
})
