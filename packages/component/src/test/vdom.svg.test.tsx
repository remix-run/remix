import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'
import { on } from '../index.ts'
import type { Handle, RemixNode } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('svg', () => {
    it('renders SVG root and children with SVG namespace and attributes', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)

      render(
        <svg viewBox="0 0 24 24" fill="none">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>,
      )

      let svg = container.querySelector('svg')
      let path = container.querySelector('path')
      invariant(svg instanceof SVGSVGElement)
      invariant(path instanceof SVGPathElement)

      expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg')

      // Attribute casing: preserve exceptions and kebab-case general SVG attrs
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(path.getAttribute('stroke-linecap')).toBe('round')
      expect(path.getAttribute('stroke-linejoin')).toBe('round')
    })

    it('supports xlinkHref -> xlink:href on SVG elements', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)

      render(
        <svg>
          <use xlinkHref="#my-id" />
        </svg>,
      )

      let useEl = container.querySelector('use')
      invariant(useEl instanceof SVGUseElement)

      expect(useEl.getAttribute('xlink:href')).toBe('#my-id')
    })

    it('updates and removes namespaced SVG attributes', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(
        <svg>
          <use id="u" xlinkHref="#one" />
          <text id="t" xmlLang="en">
            Hi
          </text>
        </svg>,
      )

      let useEl = container.querySelector('#u')
      invariant(useEl instanceof SVGUseElement)
      expect(useEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('#one')

      let textEl = container.querySelector('#t')
      invariant(textEl instanceof SVGTextElement)
      expect(textEl.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang')).toBe('en')

      root.render(
        <svg>
          <use id="u" xlinkHref="#two" />
          <text id="t" xmlLang="fr">
            Hi
          </text>
        </svg>,
      )

      let updatedUseEl = container.querySelector('#u')
      invariant(updatedUseEl instanceof SVGUseElement)
      expect(updatedUseEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('#two')

      let updatedTextEl = container.querySelector('#t')
      invariant(updatedTextEl instanceof SVGTextElement)
      expect(updatedTextEl.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang')).toBe(
        'fr',
      )

      root.render(
        <svg>
          <use id="u" />
          <text id="t">Hi</text>
        </svg>,
      )

      let removedUseEl = container.querySelector('#u')
      invariant(removedUseEl instanceof SVGUseElement)
      expect(removedUseEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe(null)
      expect(removedUseEl.getAttribute('xlink:href')).toBe(null)

      let removedTextEl = container.querySelector('#t')
      invariant(removedTextEl instanceof SVGTextElement)
      expect(removedTextEl.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang')).toBe(
        null,
      )
      expect(removedTextEl.getAttribute('xml:lang')).toBe(null)
    })

    it('renders HTML subtree inside foreignObject with HTML namespace', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)

      render(
        <svg>
          <foreignObject>
            <div id="x">Hello</div>
          </foreignObject>
        </svg>,
      )

      let div = container.querySelector('#x')
      invariant(div)
      expect(div instanceof HTMLDivElement).toBe(true)
      expect(div.namespaceURI).toBe('http://www.w3.org/1999/xhtml')
    })

    it('updates and removes SVG attributes', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(
        <svg>
          <path id="p" strokeLinecap="round" />
        </svg>,
      )
      let path = container.querySelector('#p')
      invariant(path instanceof SVGPathElement)

      // Update value
      root.render(
        <svg>
          <path id="p" strokeLinecap="square" />
        </svg>,
      )
      let updated = container.querySelector('#p')
      invariant(updated instanceof SVGPathElement)
      expect(updated).toBe(path)
      expect(updated.getAttribute('stroke-linecap')).toBe('square')

      // Remove attribute
      root.render(
        <svg>
          <path id="p" />
        </svg>,
      )
      let removed = container.querySelector('#p')
      invariant(removed instanceof SVGPathElement)
      expect(removed.hasAttribute('stroke-linecap')).toBe(false)
    })

    it('uses canonical semantics for critical SVG attributes', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(
        <svg>
          <defs>
            <filter id="f" filterUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
              <feGaussianBlur id="blur" stdDeviation="2.5" />
            </filter>
            <linearGradient id="g" gradientUnits="userSpaceOnUse" />
            <mask id="m" maskUnits="userSpaceOnUse" />
            <clipPath id="c" clipPathUnits="objectBoundingBox" />
          </defs>
        </svg>,
      )

      let filter = container.querySelector('#f')
      invariant(filter instanceof SVGFilterElement)
      expect(filter.getAttribute('filterUnits')).toBe('userSpaceOnUse')
      expect(filter.getAttribute('filter-units')).toBe(null)
      expect(filter.filterUnits.baseVal).toBe(1)

      let blur = container.querySelector('#blur')
      invariant(blur instanceof SVGFEGaussianBlurElement)
      expect(blur.getAttribute('stdDeviation')).toBe('2.5')
      expect(blur.getAttribute('std-deviation')).toBe(null)

      let gradient = container.querySelector('#g')
      invariant(gradient instanceof SVGLinearGradientElement)
      expect(gradient.getAttribute('gradientUnits')).toBe('userSpaceOnUse')
      expect(gradient.getAttribute('gradient-units')).toBe(null)
      expect(gradient.gradientUnits.baseVal).toBe(1)

      let mask = container.querySelector('#m')
      invariant(mask instanceof SVGMaskElement)
      expect(mask.getAttribute('maskUnits')).toBe('userSpaceOnUse')
      expect(mask.getAttribute('mask-units')).toBe(null)
      expect(mask.maskUnits.baseVal).toBe(1)

      let clipPath = container.querySelector('#c')
      invariant(clipPath instanceof SVGClipPathElement)
      expect(clipPath.getAttribute('clipPathUnits')).toBe('objectBoundingBox')
      expect(clipPath.getAttribute('clip-path-units')).toBe(null)
      expect(clipPath.clipPathUnits.baseVal).toBe(2)
    })

    it('attaches events on SVG elements', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let clicked = false
      root.render(
        <svg>
          <circle
            id="c"
            mix={[
              on('click', () => {
                clicked = true
              }),
            ]}
          />
        </svg>,
      )
      root.flush()

      let circle = container.querySelector('#c')
      invariant(circle instanceof SVGCircleElement)
      circle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(clicked).toBe(true)
    })

    it('propagates SVG namespace through components', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function SvgGroup() {
        return ({ href, children }: { href: string; children?: RemixNode }) => (
          <g href={href}>{children}</g>
        )
      }

      root.render(
        <svg width="100" height="100">
          <SvgGroup href="/test">
            <path id="p" />
          </SvgGroup>
        </svg>,
      )

      let svg = container.querySelector('svg')
      let group = container.querySelector('g')
      let path = container.querySelector('path')

      invariant(svg instanceof SVGSVGElement)
      invariant(group instanceof SVGGElement)
      invariant(path instanceof SVGPathElement)

      // All elements should have SVG namespace
      expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(group.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg')
    })
  })
})
