import { createReconciler } from '@remix-run/reconciler'
import { describe, expect, it } from 'vitest'

import { createDomNodePolicy } from '../dom-node-policy.ts'
import { svgNormalizationPlugin } from './svg-normalization-plugin.ts'
import { attributeFallbackPlugin } from './attribute-fallback-plugin.ts'

describe('svgNormalizationPlugin', () => {
  it('normalizes mapped SVG prop names before fallback attributes', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(
      <svg>
        <path strokeWidth={2} clipPath="url(#mask)" className="shape" />
      </svg>,
    )
    root.flush()

    let path = container.querySelector('path')
    expect(path?.getAttribute('stroke-width')).toBe('2')
    expect(path?.getAttribute('clip-path')).toBe('url(#mask)')
    expect(path?.getAttribute('class')).toBe('shape')
  })

  it('leaves unknown keys untouched for later plugins', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(
      <svg>
        <path markerEnd="url(#arrow)" />
      </svg>,
    )
    root.flush()

    let path = container.querySelector('path')
    expect(path?.getAttribute('markerEnd')).toBe('url(#arrow)')
  })
})

function createDomRoot(container: HTMLElement) {
  let reconciler = createReconciler(createDomNodePolicy(document), [
    svgNormalizationPlugin,
    attributeFallbackPlugin,
  ])
  return reconciler.createRoot(container)
}
