import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
import { link } from '../index.ts'
import { createRoot } from '../runtime/vdom.ts'
import { renderToString } from '../server/stream.ts'
import { invariant } from '../runtime/vnode.ts'

describe('hydration', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    for (let node of Array.from(document.head.childNodes)) {
      document.head.removeChild(node)
    }
  })

  describe('special case props to HTML attributes', () => {
    it('hydrates className as class attribute', async () => {
      let html = await renderToString(<div className="my-class">Hello</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.getAttribute('class')).toBe('my-class')

      let root = createRoot(container)
      root.render(<div className="my-class">Hello</div>)
      root.flush()

      // Same DOM node should be adopted
      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.getAttribute('class')).toBe('my-class')
    })

    it('hydrates htmlFor as for attribute', async () => {
      let html = await renderToString(
        <div>
          <label htmlFor="my-input">Label</label>
          <input id="my-input" />
        </div>,
      )
      container.innerHTML = html

      let existingLabel = container.querySelector('label')
      invariant(existingLabel)
      expect(existingLabel.getAttribute('for')).toBe('my-input')

      let root = createRoot(container)
      root.render(
        <div>
          <label htmlFor="my-input">Label</label>
          <input id="my-input" />
        </div>,
      )
      root.flush()

      expect(container.querySelector('label')).toBe(existingLabel)
      expect(existingLabel.getAttribute('for')).toBe('my-input')
    })

    it('hydrates tabIndex as tabindex attribute', async () => {
      let html = await renderToString(<button tabIndex={0}>Click</button>)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      let root = createRoot(container)
      root.render(<button tabIndex={0}>Click</button>)
      root.flush()

      expect(container.querySelector('button')).toBe(existingButton)
      expect(existingButton.getAttribute('tabindex')).toBe('0')
    })

    it('hydrates role and tabIndex added by link mixins', async () => {
      let html = await renderToString(<li mix={link('/docs')}>Docs</li>)
      container.innerHTML = html

      let existingItem = container.querySelector('li')
      invariant(existingItem)

      let root = createRoot(container)
      root.render(<li mix={link('/docs')}>Docs</li>)
      root.flush()

      expect(container.querySelector('li')).toBe(existingItem)
      expect(existingItem.getAttribute('role')).toBe('link')
      expect(existingItem.getAttribute('tabindex')).toBe('0')
    })

    it('hydrates acceptCharset as accept-charset attribute', async () => {
      let html = await renderToString(<form acceptCharset="UTF-8" />)
      container.innerHTML = html

      let existingForm = container.querySelector('form')
      invariant(existingForm)

      let root = createRoot(container)
      root.render(<form acceptCharset="UTF-8" />)
      root.flush()

      expect(container.querySelector('form')).toBe(existingForm)
      expect(existingForm.getAttribute('accept-charset')).toBe('UTF-8')
    })

    it('hydrates httpEquiv as http-equiv attribute', async () => {
      let html = await renderToString(<meta httpEquiv="refresh" content="5" />)
      container.innerHTML = html

      let existingMeta = container.querySelector('meta')
      invariant(existingMeta)

      let root = createRoot(container)
      root.render(<meta httpEquiv="refresh" content="5" />)
      root.flush()

      expect(container.querySelector('meta')).toBe(existingMeta)
      expect(document.head.querySelector('meta')).toBeNull()
      expect(existingMeta.getAttribute('http-equiv')).toBe('refresh')
    })

    it('hydrates aria-* attributes unchanged', async () => {
      let html = await renderToString(
        <button aria-label="Close" aria-expanded="false">
          X
        </button>,
      )
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      let root = createRoot(container)
      root.render(
        <button aria-label="Close" aria-expanded="false">
          X
        </button>,
      )
      root.flush()

      expect(container.querySelector('button')).toBe(existingButton)
      expect(existingButton.getAttribute('aria-label')).toBe('Close')
      expect(existingButton.getAttribute('aria-expanded')).toBe('false')
    })

    it('hydrates data-* attributes unchanged', async () => {
      let html = await renderToString(<div data-testid="my-div" data-value="42" />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div data-testid="my-div" data-value="42" />)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.getAttribute('data-testid')).toBe('my-div')
      expect(existingDiv.getAttribute('data-value')).toBe('42')
    })

    it('hydrates data-rmx-document and data-rmx-preserve-dom as boolean attributes', async () => {
      let html = await renderToString(
        <a href="/login" data-rmx-preserve-dom={true} data-rmx-document={false} />,
      )
      expect(html).toBe('<a href="/login" data-rmx-preserve-dom></a>')
      container.innerHTML = html
      let serverHtml = container.innerHTML

      let existingAnchor = container.querySelector('a')
      invariant(existingAnchor)

      let root = createRoot(container)
      root.render(<a href="/login" data-rmx-preserve-dom={true} data-rmx-document={false} />)
      root.flush()

      expect(container.querySelector('a')).toBe(existingAnchor)
      expect(container.innerHTML).toBe(serverHtml)
    })

    it('hydrates and updates MathML boolean attributes as strings', async (t) => {
      function math(value: boolean) {
        return (
          <math displaystyle={value}>
            <mover accent={value}>
              <munder accentunder={value}>
                <mo
                  fence={value}
                  largeop={value}
                  movablelimits={value}
                  separator={value}
                  stretchy={value}
                  symmetric={value}
                >
                  ∑
                </mo>
                <mi>a</mi>
              </munder>
              <mi>b</mi>
            </mover>
          </math>
        )
      }

      container.innerHTML = await renderToString(math(true))
      let existingMath = container.querySelector('math')
      invariant(existingMath)

      let root = createRoot(container)
      t.after(() => root.dispose())
      root.render(math(true))
      root.flush()

      expect(container.querySelector('math')).toBe(existingMath)
      expect(container.innerHTML).toBe(
        '<math displaystyle="true"><mover accent="true"><munder accentunder="true">' +
          '<mo fence="true" largeop="true" movablelimits="true" separator="true" stretchy="true" symmetric="true">∑</mo>' +
          '<mi>a</mi></munder><mi>b</mi></mover></math>',
      )
      expect(getComputedStyle(existingMath).getPropertyValue('math-style')).toBe('normal')

      root.render(math(false))
      root.flush()

      expect(container.querySelector('math')).toBe(existingMath)
      expect(container.innerHTML).toBe(
        '<math displaystyle="false"><mover accent="false"><munder accentunder="false">' +
          '<mo fence="false" largeop="false" movablelimits="false" separator="false" stretchy="false" symmetric="false">∑</mo>' +
          '<mi>a</mi></munder><mi>b</mi></mover></math>',
      )
      expect(getComputedStyle(existingMath).getPropertyValue('math-style')).toBe('compact')
    })

    it('hydrates SVG xlinkHref as href', async () => {
      let html = await renderToString(
        <svg>
          <use xlinkHref="#icon-star" />
        </svg>,
      )
      container.innerHTML = html

      let existingUse = container.querySelector('use')
      invariant(existingUse)

      let root = createRoot(container)
      root.render(
        <svg>
          <use xlinkHref="#icon-star" />
        </svg>,
      )
      root.flush()

      expect(container.querySelector('use')).toBe(existingUse)
      expect(existingUse.getAttribute('href')).toBe('#icon-star')
    })

    it('hydrates and updates SVG xlinkTitle in the XLink namespace', async () => {
      let XLINK_NS = 'http://www.w3.org/1999/xlink'
      let html = await renderToString(
        <svg>
          <use href="#one" xlinkTitle="One" />
        </svg>,
      )
      container.innerHTML = html

      let existingUse = container.querySelector('use')
      invariant(existingUse)
      expect(existingUse.getAttributeNS(XLINK_NS, 'title')).toBe('One')

      let root = createRoot(container)
      root.render(
        <svg>
          <use href="#one" xlinkTitle="One" />
        </svg>,
      )
      root.flush()
      expect(container.querySelector('use')).toBe(existingUse)

      root.render(
        <svg>
          <use href="#one" xlinkTitle="Two" />
        </svg>,
      )
      root.flush()
      expect(existingUse.getAttributeNS(XLINK_NS, 'title')).toBe('Two')
      expect(existingUse.attributes.length).toBe(2)
    })

    it('hydrates SVG viewBox with preserved case', async () => {
      let html = await renderToString(<svg viewBox="0 0 24 24" />)
      container.innerHTML = html

      let existingSvg = container.querySelector('svg')
      invariant(existingSvg)

      let root = createRoot(container)
      root.render(<svg viewBox="0 0 24 24" />)
      root.flush()

      expect(container.querySelector('svg')).toBe(existingSvg)
      expect(existingSvg.getAttribute('viewBox')).toBe('0 0 24 24')
    })

    it('hydrates SVG preserveAspectRatio with preserved case', async () => {
      let html = await renderToString(<svg preserveAspectRatio="xMidYMid meet" />)
      container.innerHTML = html

      let existingSvg = container.querySelector('svg')
      invariant(existingSvg)

      let root = createRoot(container)
      root.render(<svg preserveAspectRatio="xMidYMid meet" />)
      root.flush()

      expect(container.querySelector('svg')).toBe(existingSvg)
      expect(existingSvg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
    })

    it('hydrates SVG filterUnits with canonical case and semantics', async () => {
      let html = await renderToString(
        <svg>
          <defs>
            <filter id="f" filterUnits="userSpaceOnUse" />
          </defs>
        </svg>,
      )
      container.innerHTML = html

      let existingFilter = container.querySelector('#f')
      invariant(existingFilter instanceof SVGFilterElement)

      let root = createRoot(container)
      root.render(
        <svg>
          <defs>
            <filter id="f" filterUnits="userSpaceOnUse" />
          </defs>
        </svg>,
      )
      root.flush()

      expect(container.querySelector('#f')).toBe(existingFilter)
      expect(existingFilter.getAttribute('filterUnits')).toBe('userSpaceOnUse')
      expect(existingFilter.getAttribute('filter-units')).toBe(null)
      expect(existingFilter.filterUnits.baseVal).toBe(1)
    })

    it('skips redundant DOM attribute and style mutations when hydrated props match SSR output', async (t) => {
      let tree = (
        <div
          id="card"
          class="metric-card"
          tabIndex={0}
          data-kind="summary"
          aria-expanded={false}
          style={{ backgroundColor: '#fff', padding: '12px', marginTop: 8 }}
        >
          <a href="/details" title="View details">
            Open
          </a>
          <button disabled>Locked</button>
        </div>
      )

      container.innerHTML = await renderToString(tree)
      let mutations: MutationRecord[] = []
      let observer = new MutationObserver((records) => mutations.push(...records))
      observer.observe(container, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      })
      t.after(() => observer.disconnect())

      let root = createRoot(container)
      t.after(() => root.dispose())
      root.render(tree)
      root.flush()
      mutations.push(...observer.takeRecords())

      expect(mutations.length).toBe(0)
    })

    it('applies non-reflected input indeterminate property and patches mismatched boolean/style props during hydration', async (t) => {
      container.innerHTML = await renderToString(
        <div>
          <input type="checkbox" indeterminate />
          <button disabled>Action</button>
          <span style="color: red">Label</span>
        </div>,
      )
      let root = createRoot(container)
      t.after(() => root.dispose())
      root.render(
        <div>
          <input type="checkbox" indeterminate />
          <button disabled={false}>Action</button>
          <span style="color: green">Label</span>
        </div>,
      )
      root.flush()

      let input = container.querySelector('input')
      let button = container.querySelector('button')
      let span = container.querySelector('span')
      invariant(input && button && span)
      expect(input.indeterminate).toBe(true)
      expect(button.disabled).toBe(false)
      expect(button.hasAttribute('disabled')).toBe(false)
      expect(span.getAttribute('style')).toBe('color: green')
    })

    it('hydrates namespaced SVG attributes without redundant DOM writes', async (t) => {
      let tree = (
        <svg>
          <use href="#icon" xlinkTitle="Star" />
        </svg>
      )
      container.innerHTML = await renderToString(tree)

      let mutations: MutationRecord[] = []
      let observer = new MutationObserver((records) => mutations.push(...records))
      observer.observe(container, { attributes: true, subtree: true })
      t.after(() => observer.disconnect())

      let root = createRoot(container)
      t.after(() => root.dispose())
      root.render(tree)
      root.flush()
      mutations.push(...observer.takeRecords())

      expect(mutations.length).toBe(0)

      // Mismatched namespaced attribute is still patched during hydration
      let container2 = document.createElement('div')
      container2.innerHTML = await renderToString(
        <svg>
          <use href="#icon" xlinkTitle="Server" />
        </svg>,
      )
      let root2 = createRoot(container2)
      t.after(() => root2.dispose())
      root2.render(
        <svg>
          <use href="#icon" xlinkTitle="Client" />
        </svg>,
      )
      root2.flush()
      let use = container2.querySelector('use')
      invariant(use)
      expect(use.getAttributeNS('http://www.w3.org/1999/xlink', 'title')).toBe('Client')
    })

    it('applies media element DOM-only properties during hydration', async (t) => {
      let node = <video playbackRate={2} volume={0.5} />
      container.innerHTML = await renderToString(node)

      let root = createRoot(container)
      t.after(() => root.dispose())
      root.render(node)
      root.flush()

      let video = container.querySelector('video')
      invariant(video instanceof HTMLVideoElement)
      expect(video.playbackRate).toBe(2)
      expect(video.volume).toBe(0.5)
    })
  })
})
