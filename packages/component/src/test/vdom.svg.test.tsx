import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRoot } from '../runtime/vdom.ts'
import { invariant } from '../runtime/vnode.ts'
import { on } from '../index.ts'
import type { Handle, RemixNode } from '../runtime/component.ts'

describe('vnode rendering', () => {
  describe('svg', () => {
    it('renders SVG root and children with SVG namespace and attributes', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)

      render(
        <svg viewBox="0 0 24 24" fill="none" class="icon">
          <path strokeLinecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>,
      )

      let svg = container.querySelector('svg')
      let path = container.querySelector('path')
      invariant(svg instanceof SVGSVGElement)
      invariant(path instanceof SVGPathElement)

      expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg')

      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(svg.getAttribute('class')).toBe('icon')
      expect(path.getAttribute('stroke-linecap')).toBe('round')
      expect(path.getAttribute('stroke-linejoin')).toBe('round')
    })

    it('normalizes xlinkHref and xlink:href to href on SVG elements', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(
        <svg>
          <use id="a" xlinkHref="#one" />
          <use id="b" xlink:href="#two" />
        </svg>,
      )

      let a = container.querySelector('#a')
      let b = container.querySelector('#b')
      invariant(a instanceof SVGUseElement)
      invariant(b instanceof SVGUseElement)

      expect(a.getAttribute('href')).toBe('#one')
      expect(b.getAttribute('href')).toBe('#two')

      root.render(
        <svg>
          <use id="a" xlinkHref="#three" />
          <use id="b" />
        </svg>,
      )

      expect(a.getAttribute('href')).toBe('#three')
      expect(b.getAttribute('href')).toBe(null)
    })

    it('sets, updates, and removes xml:lang in the XML namespace on SVG elements', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let XML_NS = 'http://www.w3.org/XML/1998/namespace'

      root.render(
        <svg>
          <text id="t" xmlLang="en">
            Hi
          </text>
        </svg>,
      )
      let text = container.querySelector('#t')
      invariant(text instanceof SVGTextElement)
      expect(text.getAttributeNS(XML_NS, 'lang')).toBe('en')

      root.render(
        <svg>
          <text id="t" xml:lang="fr">
            Hi
          </text>
        </svg>,
      )
      expect(text.getAttributeNS(XML_NS, 'lang')).toBe('fr')

      root.render(
        <svg>
          <text id="t">Hi</text>
        </svg>,
      )
      expect(text.getAttributeNS(XML_NS, 'lang')).toBe(null)
    })

    it('sets, updates, and removes xlink:title in the XLink namespace on SVG elements', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let XLINK_NS = 'http://www.w3.org/1999/xlink'

      root.render(
        <svg>
          <use id="u" href="#one" xlinkTitle="One" />
        </svg>,
      )
      let use = container.querySelector('#u')
      invariant(use instanceof SVGUseElement)
      expect(use.getAttributeNS(XLINK_NS, 'title')).toBe('One')
      expect(use.getAttribute('xlinkTitle')).toBe(null)

      root.render(
        <svg>
          <use id="u" href="#one" xlink:title="Two" />
        </svg>,
      )
      expect(use.getAttributeNS(XLINK_NS, 'title')).toBe('Two')

      root.render(
        <svg>
          <use id="u" href="#one" />
        </svg>,
      )
      expect(use.getAttributeNS(XLINK_NS, 'title')).toBe(null)
    })

    it('normalizes className to class on SVG elements', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(<svg className="icon" />)
      let svg = container.querySelector('svg')
      invariant(svg instanceof SVGSVGElement)
      expect(svg.getAttribute('class')).toBe('icon')

      root.render(<svg />)
      expect(svg.getAttribute('class')).toBe(null)
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
          <path id="p" stroke-linecap="round" />
        </svg>,
      )
      let path = container.querySelector('#p')
      invariant(path instanceof SVGPathElement)

      // Update value
      root.render(
        <svg>
          <path id="p" stroke-linecap="square" />
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

    it('preserves camelCase for canonical SVG attributes', () => {
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

    it('sets SVG booleanish string attributes as explicit values', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(
        <svg>
          <animate id="a" autoReverse={false} />
          <rect id="r" externalResourcesRequired={false} focusable={false} />
          <feColorMatrix id="m" preserveAlpha={false} />
        </svg>,
      )

      let animate = container.querySelector('#a')
      invariant(animate instanceof SVGElement)
      expect(animate.getAttribute('autoReverse')).toBe('false')

      let rect = container.querySelector('#r')
      invariant(rect instanceof SVGElement)
      expect(rect.getAttribute('externalResourcesRequired')).toBe('false')
      expect(rect.getAttribute('focusable')).toBe('false')

      let matrix = container.querySelector('#m')
      invariant(matrix instanceof SVGElement)
      expect(matrix.getAttribute('preserveAlpha')).toBe('false')
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

      function SvgGroup(handle: Handle<{ href: string; children?: RemixNode }>) {
        return () => <g href={handle.props.href}>{handle.props.children}</g>
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

      expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(group.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg')
    })
  })
})
