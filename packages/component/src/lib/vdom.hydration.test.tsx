import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Handle } from './component.ts'
import { createRoot, createRangeRoot, resetStyleState } from './vdom.ts'
import { renderToString } from './stream.ts'
import { hydrationRoot } from './hydration-root.ts'
import { invariant } from './invariant.ts'

/**
 * Comprehensive hydration test suite.
 *
 * These tests serve as a specification for expected hydration behavior.
 * Some tests may fail initially until the implementation is updated (TDD approach).
 *
 * All tests use renderToString to produce realistic server markup.
 */

describe('hydration', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
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

    it('hydrates SVG xlinkHref as xlink:href', async () => {
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
      expect(existingUse.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('#icon-star')
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
  })

  describe('text node handling', () => {
    it('adopts single server text node when client has multiple text children', async () => {
      // Server renders "Hello world" as single text node
      let html = await renderToString(<span>Hello world</span>)
      container.innerHTML = html

      let existingSpan = container.querySelector('span')
      invariant(existingSpan)
      let originalTextNode = existingSpan.firstChild
      invariant(originalTextNode instanceof Text)

      // Client has two text children: ["Hello ", "world"]
      let root = createRoot(container)
      root.render(
        <span>
          {'Hello '}
          {'world'}
        </span>,
      )
      root.flush()

      // Span should be adopted
      expect(container.querySelector('span')).toBe(existingSpan)
      // Text content should match (even if internal structure differs)
      expect(existingSpan.textContent).toBe('Hello world')
    })

    it('subsequent update patches consolidated text content', async () => {
      let html = await renderToString(<span>Hello world</span>)
      container.innerHTML = html

      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let name = 'world'
      function render() {
        root.render(
          <span>
            {'Hello '}
            {name}
          </span>,
        )
        root.flush()
      }

      let root = createRoot(container)
      render()

      expect(existingSpan.textContent).toBe('Hello world')

      // Update the dynamic part
      name = 'Ryan'
      render()

      expect(existingSpan.textContent).toBe('Hello Ryan')
    })

    it('handles null children as empty text', async () => {
      let html = await renderToString(<div>{null}</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div>{null}</div>)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.textContent).toBe('')
    })

    it('handles undefined children as empty text', async () => {
      let html = await renderToString(<div>{undefined}</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div>{undefined}</div>)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.textContent).toBe('')
    })

    it('handles false children as empty text', async () => {
      let html = await renderToString(<div>{false}</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div>{false}</div>)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.textContent).toBe('')
    })

    it('handles true children as empty text', async () => {
      let html = await renderToString(<div>{true}</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div>{true}</div>)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.textContent).toBe('')
    })
  })

  describe('extra DOM nodes (browser extension injection)', () => {
    it('ignores extra nodes at the end of container', async () => {
      let html = await renderToString(
        <div>
          <span>Our content</span>
        </div>,
      )
      container.innerHTML = html

      // Simulate browser extension injecting content at the end
      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let injected = document.createElement('aside')
      injected.id = 'ext-injected'
      injected.textContent = 'extension content'
      existingDiv.appendChild(injected)

      let root = createRoot(container)
      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      // Our content should be adopted
      expect(container.querySelector('span')).toBe(existingSpan)
      // Injected content should still be there
      expect(existingDiv.querySelector('#ext-injected')).toBe(injected)
    })

    it('skips injected node at start and adopts our content', async () => {
      let html = await renderToString(
        <div>
          <span>Our content</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      // Simulate browser extension injecting content at the START
      let injected = document.createElement('aside')
      injected.id = 'ext-start'
      injected.textContent = 'extension content'
      existingDiv.insertBefore(injected, existingSpan)

      let root = createRoot(container)
      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      // Our span should be adopted (cursor advanced past injected aside)
      expect(container.querySelector('span')).toBe(existingSpan)
      // Injected content should still be there
      expect(existingDiv.querySelector('#ext-start')).toBe(injected)
    })

    it('handles injected nodes at both start and end', async () => {
      let html = await renderToString(
        <div>
          <span>Our content</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      // Inject at start
      let injectedStart = document.createElement('aside')
      injectedStart.id = 'ext-start'
      injectedStart.textContent = 'start extension'
      existingDiv.insertBefore(injectedStart, existingSpan)

      // Inject at end
      let injectedEnd = document.createElement('aside')
      injectedEnd.id = 'ext-end'
      injectedEnd.textContent = 'end extension'
      existingDiv.appendChild(injectedEnd)

      let root = createRoot(container)
      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      // Our span should be adopted
      expect(container.querySelector('span')).toBe(existingSpan)
      // Both injected elements should remain
      expect(existingDiv.querySelector('#ext-start')).toBe(injectedStart)
      expect(existingDiv.querySelector('#ext-end')).toBe(injectedEnd)
    })

    it('extra nodes survive through subsequent updates', async () => {
      let html = await renderToString(
        <div>
          <span>Content 1</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      // Inject at end
      let injected = document.createElement('aside')
      injected.id = 'extension'
      injected.textContent = 'extension content'
      existingDiv.appendChild(injected)

      let root = createRoot(container)
      root.render(
        <div>
          <span>Content 1</span>
        </div>,
      )
      root.flush()

      expect(existingDiv.querySelector('#extension')).toBe(injected)

      // Update our content
      root.render(
        <div>
          <span>Content 2</span>
        </div>,
      )
      root.flush()

      // Injected content should still be there after update
      expect(existingDiv.querySelector('#extension')).toBe(injected)
      expect(existingDiv.querySelector('span')?.textContent).toBe('Content 2')
    })
  })

  describe('attribute mismatch handling', () => {
    it('adopts element and patches mismatched attributes', async () => {
      let html = await renderToString(<div className="server-class" data-value="server" />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div className="client-class" data-value="client" />)
      root.flush()

      // Same DOM node should be adopted (not recreated)
      expect(container.querySelector('div')).toBe(existingDiv)
      // Attributes should be patched to client values
      expect(existingDiv.getAttribute('class')).toBe('client-class')
      expect(existingDiv.getAttribute('data-value')).toBe('client')
    })

    it('adds missing attributes during hydration', async () => {
      let html = await renderToString(<div className="existing" />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div className="existing" data-new="added" title="hello" />)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.getAttribute('data-new')).toBe('added')
      expect(existingDiv.getAttribute('title')).toBe('hello')
    })

    it('leaves extra attributes alone during hydration', async () => {
      let html = await renderToString(<div className="keep" data-extra="yes" title="extra" />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.getAttribute('data-extra')).toBe('yes')
      expect(existingDiv.getAttribute('title')).toBe('extra')

      let root = createRoot(container)
      root.render(<div className="keep" />)
      root.flush()

      // Element should be adopted
      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.getAttribute('class')).toBe('keep')
      // Extra attributes left alone during hydration (not tracked, so not removed)
      expect(existingDiv.hasAttribute('data-extra')).toBe(true)
      expect(existingDiv.hasAttribute('title')).toBe(true)
    })

    it('preserves DOM node identity when only attributes differ', async () => {
      let html = await renderToString(
        <div id="test" className="old" data-value="old">
          <span>Child</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('#test')
      let existingSpan = container.querySelector('span')
      invariant(existingDiv && existingSpan)

      let root = createRoot(container)
      root.render(
        <div id="test" className="new" data-value="new">
          <span>Child</span>
        </div>,
      )
      root.flush()

      // Both parent and child should be the same DOM nodes
      expect(container.querySelector('#test')).toBe(existingDiv)
      expect(container.querySelector('span')).toBe(existingSpan)
    })
  })

  describe('type mismatch handling', () => {
    it('advances cursor once on type mismatch to find our element', async () => {
      let html = await renderToString(
        <div>
          <span>Our content</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      // Inject different element type at start
      let injected = document.createElement('div')
      injected.className = 'injected'
      existingDiv.insertBefore(injected, existingSpan)

      // Suppress console.error for expected hydration mismatch log
      let errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      let root = createRoot(container)
      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      errorSpy.mockRestore()

      // Our span should be adopted after advancing past injected div
      expect(container.querySelector('span')).toBe(existingSpan)
    })

    it('recreates element if retry also fails', async () => {
      let html = await renderToString(
        <div>
          <span>Original</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      // Replace span with completely different structure
      existingDiv.innerHTML = '<div>Wrong</div><p>Also wrong</p>'

      let errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      let root = createRoot(container)
      root.render(
        <div>
          <span>Original</span>
        </div>,
      )
      root.flush()

      errorSpy.mockRestore()

      // Should have created a new span since no match found
      let newSpan = container.querySelector('span')
      expect(newSpan).not.toBe(existingSpan)
      expect(newSpan?.textContent).toBe('Original')
    })

    it('leaves skipped nodes in place', async () => {
      let html = await renderToString(
        <div>
          <span>Our content</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      // Inject element that will be skipped
      let skipped = document.createElement('aside')
      skipped.id = 'skipped'
      skipped.textContent = 'Extension content'
      existingDiv.insertBefore(skipped, existingSpan)

      let errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      let root = createRoot(container)
      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      errorSpy.mockRestore()

      // Skipped element should still be in the DOM
      expect(existingDiv.querySelector('#skipped')).toBe(skipped)
    })
  })

  describe('form elements', () => {
    it('hydrates input with value attribute', async () => {
      let html = await renderToString(<input type="text" value="server value" readOnly />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input type="text" value="server value" readOnly />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.value).toBe('server value')
    })

    it('hydrates input with defaultValue', async () => {
      let html = await renderToString(<input type="text" defaultValue="default" />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input type="text" defaultValue="default" />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.value).toBe('default')
    })

    it('hydrates checkbox with checked attribute', async () => {
      let html = await renderToString(<input type="checkbox" checked readOnly />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input type="checkbox" checked readOnly />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.checked).toBe(true)
    })

    it('hydrates checkbox with defaultChecked', async () => {
      let html = await renderToString(<input type="checkbox" defaultChecked />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input type="checkbox" defaultChecked />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.checked).toBe(true)
    })

    it('hydrates radio with checked attribute', async () => {
      let html = await renderToString(
        <div>
          <input type="radio" name="choice" value="a" checked readOnly />
          <input type="radio" name="choice" value="b" readOnly />
        </div>,
      )
      container.innerHTML = html

      let inputs = container.querySelectorAll('input')
      expect(inputs[0].checked).toBe(true)
      expect(inputs[1].checked).toBe(false)

      let root = createRoot(container)
      root.render(
        <div>
          <input type="radio" name="choice" value="a" checked readOnly />
          <input type="radio" name="choice" value="b" readOnly />
        </div>,
      )
      root.flush()

      let hydratedInputs = container.querySelectorAll('input')
      expect(hydratedInputs[0]).toBe(inputs[0])
      expect(hydratedInputs[1]).toBe(inputs[1])
      expect(hydratedInputs[0].checked).toBe(true)
      expect(hydratedInputs[1].checked).toBe(false)
    })

    it('hydrates textarea with value', async () => {
      let html = await renderToString(<textarea value="textarea content" readOnly />)
      container.innerHTML = html

      let existingTextarea = container.querySelector('textarea')
      invariant(existingTextarea)

      let root = createRoot(container)
      root.render(<textarea value="textarea content" readOnly />)
      root.flush()

      expect(container.querySelector('textarea')).toBe(existingTextarea)
      expect(existingTextarea.value).toBe('textarea content')
    })

    it('hydrates select with selected option', async () => {
      let html = await renderToString(
        <select value="b">
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>,
      )
      container.innerHTML = html

      let existingSelect = container.querySelector('select')
      invariant(existingSelect)

      let root = createRoot(container)
      root.render(
        <select value="b">
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>,
      )
      root.flush()

      expect(container.querySelector('select')).toBe(existingSelect)
      expect(existingSelect.value).toBe('b')
    })
  })

  describe('boolean attributes', () => {
    it('hydrates disabled attribute', async () => {
      let html = await renderToString(<button disabled>Click</button>)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)
      expect(existingButton.disabled).toBe(true)

      let root = createRoot(container)
      root.render(<button disabled>Click</button>)
      root.flush()

      expect(container.querySelector('button')).toBe(existingButton)
      expect(existingButton.disabled).toBe(true)
    })

    it('hydrates readonly attribute', async () => {
      let html = await renderToString(<input readOnly />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input readOnly />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.readOnly).toBe(true)
    })

    it('hydrates required attribute', async () => {
      let html = await renderToString(<input required />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input required />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.required).toBe(true)
    })

    it('hydrates multiple attribute on select', async () => {
      let html = await renderToString(
        <select multiple>
          <option>A</option>
          <option>B</option>
        </select>,
      )
      container.innerHTML = html

      let existingSelect = container.querySelector('select')
      invariant(existingSelect)

      let root = createRoot(container)
      root.render(
        <select multiple>
          <option>A</option>
          <option>B</option>
        </select>,
      )
      root.flush()

      expect(container.querySelector('select')).toBe(existingSelect)
      expect(existingSelect.multiple).toBe(true)
    })

    it('hydrates hidden attribute', async () => {
      let html = await renderToString(<div hidden>Hidden content</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div hidden>Hidden content</div>)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.hidden).toBe(true)
    })

    it('hydrates boolean attribute with true value', async () => {
      let html = await renderToString(<button disabled={true}>Click</button>)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      let root = createRoot(container)
      root.render(<button disabled={true}>Click</button>)
      root.flush()

      expect(container.querySelector('button')).toBe(existingButton)
      expect(existingButton.disabled).toBe(true)
    })

    it('hydrates boolean attribute with false value', async () => {
      let html = await renderToString(<button disabled={false}>Click</button>)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      let root = createRoot(container)
      root.render(<button disabled={false}>Click</button>)
      root.flush()

      expect(container.querySelector('button')).toBe(existingButton)
      expect(existingButton.disabled).toBe(false)
    })
  })

  describe('self-closing/void elements', () => {
    it('hydrates input element', async () => {
      let html = await renderToString(<input type="text" placeholder="Enter text" />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input type="text" placeholder="Enter text" />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.placeholder).toBe('Enter text')
    })

    it('hydrates br element', async () => {
      let html = await renderToString(
        <div>
          Line 1<br />
          Line 2
        </div>,
      )
      container.innerHTML = html

      let existingBr = container.querySelector('br')
      invariant(existingBr)

      let root = createRoot(container)
      root.render(
        <div>
          Line 1<br />
          Line 2
        </div>,
      )
      root.flush()

      expect(container.querySelector('br')).toBe(existingBr)
    })

    it('hydrates img element', async () => {
      let html = await renderToString(<img src="/image.png" alt="Test image" />)
      container.innerHTML = html

      let existingImg = container.querySelector('img')
      invariant(existingImg)

      let root = createRoot(container)
      root.render(<img src="/image.png" alt="Test image" />)
      root.flush()

      expect(container.querySelector('img')).toBe(existingImg)
      expect(existingImg.getAttribute('src')).toBe('/image.png')
      expect(existingImg.getAttribute('alt')).toBe('Test image')
    })

    it('hydrates hr element', async () => {
      let html = await renderToString(
        <div>
          <p>Above</p>
          <hr />
          <p>Below</p>
        </div>,
      )
      container.innerHTML = html

      let existingHr = container.querySelector('hr')
      invariant(existingHr)

      let root = createRoot(container)
      root.render(
        <div>
          <p>Above</p>
          <hr />
          <p>Below</p>
        </div>,
      )
      root.flush()

      expect(container.querySelector('hr')).toBe(existingHr)
    })

    it('hydrates meta element', async () => {
      let html = await renderToString(<meta name="description" content="Test page" />)
      container.innerHTML = html

      let existingMeta = container.querySelector('meta')
      invariant(existingMeta)

      let root = createRoot(container)
      root.render(<meta name="description" content="Test page" />)
      root.flush()

      expect(container.querySelector('meta')).toBe(existingMeta)
      expect(existingMeta.getAttribute('name')).toBe('description')
      expect(existingMeta.getAttribute('content')).toBe('Test page')
    })

    it('hydrates link element', async () => {
      let html = await renderToString(<link rel="stylesheet" href="/styles.css" />)
      container.innerHTML = html

      let existingLink = container.querySelector('link')
      invariant(existingLink)

      let root = createRoot(container)
      root.render(<link rel="stylesheet" href="/styles.css" />)
      root.flush()

      expect(container.querySelector('link')).toBe(existingLink)
      expect(existingLink.getAttribute('rel')).toBe('stylesheet')
      expect(existingLink.getAttribute('href')).toBe('/styles.css')
    })
  })

  describe('component edge cases', () => {
    it('hydrates component that returns null', async () => {
      function NullComponent() {
        return () => null
      }

      let html = await renderToString(
        <div>
          <NullComponent />
          <span>After</span>
        </div>,
      )
      container.innerHTML = html

      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let root = createRoot(container)
      root.render(
        <div>
          <NullComponent />
          <span>After</span>
        </div>,
      )
      root.flush()

      expect(container.querySelector('span')).toBe(existingSpan)
      expect(existingSpan.textContent).toBe('After')
    })

    it('hydrates component that returns fragment', async () => {
      function FragmentComponent() {
        return () => (
          <>
            <span>First</span>
            <span>Second</span>
          </>
        )
      }

      let html = await renderToString(
        <div>
          <FragmentComponent />
        </div>,
      )
      container.innerHTML = html

      let spans = container.querySelectorAll('span')
      expect(spans).toHaveLength(2)

      let root = createRoot(container)
      root.render(
        <div>
          <FragmentComponent />
        </div>,
      )
      root.flush()

      let hydratedSpans = container.querySelectorAll('span')
      expect(hydratedSpans[0]).toBe(spans[0])
      expect(hydratedSpans[1]).toBe(spans[1])
    })

    it('hydrates nested hydration boundaries', async () => {
      let Outer = hydrationRoot('/outer.js#Outer', function Outer(handle: Handle) {
        return (props: { children: any }) => <div className="outer">{props.children}</div>
      })

      let Inner = hydrationRoot('/inner.js#Inner', function Inner(handle: Handle) {
        return () => <span className="inner">Inner content</span>
      })

      let html = await renderToString(
        <Outer>
          <Inner />
        </Outer>,
      )
      container.innerHTML = html

      // Should have hydration comment markers
      expect(html).toContain('<!-- rmx:h:')
      expect(html).toContain('<!-- /rmx:h -->')

      let existingOuter = container.querySelector('.outer')
      let existingInner = container.querySelector('.inner')
      invariant(existingOuter && existingInner)

      // For this test, we use createRoot which should handle the comment markers
      let root = createRoot(container)
      root.render(
        <Outer>
          <Inner />
        </Outer>,
      )
      root.flush()

      // Both should be adopted
      expect(container.querySelector('.outer')).toBe(existingOuter)
      expect(container.querySelector('.inner')).toBe(existingInner)
    })

    it('hydrates component with state preservation', async () => {
      function Counter(handle: Handle, setup: number) {
        let count = setup
        return () => (
          <button
            on={{
              click: () => {
                count++
                handle.update()
              },
            }}
          >
            Count: {count}
          </button>
        )
      }

      let html = await renderToString(<Counter setup={5} />)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)
      expect(existingButton.textContent).toBe('Count: 5')

      let root = createRoot(container)
      root.render(<Counter setup={5} />)
      root.flush()

      // Button should be adopted
      expect(container.querySelector('button')).toBe(existingButton)

      // Clicking should work
      existingButton.click()
      root.flush()

      expect(existingButton.textContent).toBe('Count: 6')
    })
  })

  describe('additional scenarios', () => {
    it('hydrates context across component boundaries', async () => {
      function Provider(handle: Handle<{ value: string }>) {
        handle.context.set({ value: 'from context' })
        return (props: { children: any }) => <div className="provider">{props.children}</div>
      }

      function Consumer(handle: Handle) {
        let ctx = handle.context.get(Provider)
        return () => <span className="consumer">{ctx?.value ?? 'no context'}</span>
      }

      let html = await renderToString(
        <Provider>
          <Consumer />
        </Provider>,
      )
      container.innerHTML = html

      let existingProvider = container.querySelector('.provider')
      let existingConsumer = container.querySelector('.consumer')
      invariant(existingProvider && existingConsumer)
      expect(existingConsumer.textContent).toBe('from context')

      let root = createRoot(container)
      root.render(
        <Provider>
          <Consumer />
        </Provider>,
      )
      root.flush()

      expect(container.querySelector('.provider')).toBe(existingProvider)
      expect(container.querySelector('.consumer')).toBe(existingConsumer)
      expect(existingConsumer.textContent).toBe('from context')
    })

    it('hydrates SVG elements with case-sensitive tags', async () => {
      let html = await renderToString(
        <svg>
          <defs>
            <linearGradient id="grad1">
              <stop offset="0%" stopColor="red" />
              <stop offset="100%" stopColor="blue" />
            </linearGradient>
          </defs>
          <rect fill="url(#grad1)" width="100" height="100" />
        </svg>,
      )
      container.innerHTML = html

      let existingSvg = container.querySelector('svg')
      let existingGradient = container.querySelector('linearGradient')
      let existingRect = container.querySelector('rect')
      invariant(existingSvg && existingGradient && existingRect)

      let root = createRoot(container)
      root.render(
        <svg>
          <defs>
            <linearGradient id="grad1">
              <stop offset="0%" stopColor="red" />
              <stop offset="100%" stopColor="blue" />
            </linearGradient>
          </defs>
          <rect fill="url(#grad1)" width="100" height="100" />
        </svg>,
      )
      root.flush()

      expect(container.querySelector('svg')).toBe(existingSvg)
      expect(container.querySelector('linearGradient')).toBe(existingGradient)
      expect(container.querySelector('rect')).toBe(existingRect)
    })

    it('hydrates innerHTML prop', async () => {
      let html = await renderToString(<div innerHTML="<span>Raw HTML</span>" />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.innerHTML).toBe('<span>Raw HTML</span>')

      let root = createRoot(container)
      root.render(<div innerHTML="<span>Raw HTML</span>" />)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.innerHTML).toBe('<span>Raw HTML</span>')
    })

    it('hydrates style prop as object', async () => {
      let html = await renderToString(
        <div style={{ color: 'red', backgroundColor: 'blue', padding: '10px' }}>Styled</div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(
        <div style={{ color: 'red', backgroundColor: 'blue', padding: '10px' }}>Styled</div>,
      )
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      // Style should be applied
      expect(existingDiv.style.color).toBe('red')
      expect(existingDiv.style.backgroundColor).toBe('blue')
    })

    it('calls connect callback after hydration', async () => {
      let connectedNode: HTMLDivElement | null = null

      function WithConnect() {
        return () => (
          <div
            connect={(node) => {
              connectedNode = node as HTMLDivElement
            }}
          >
            Connected
          </div>
        )
      }

      let html = await renderToString(<WithConnect />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<WithConnect />)
      root.flush()

      // Connect should be called with the adopted node
      expect(connectedNode).toBe(existingDiv)
    })

    it('attaches event handlers during hydration', async () => {
      let clicked = false

      function Clickable() {
        return () => (
          <button
            on={{
              click: () => {
                clicked = true
              },
            }}
          >
            Click me
          </button>
        )
      }

      let html = await renderToString(<Clickable />)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      let root = createRoot(container)
      root.render(<Clickable />)
      root.flush()

      // Button should be adopted
      expect(container.querySelector('button')).toBe(existingButton)

      // Event should work
      existingButton.click()
      expect(clicked).toBe(true)
    })

    it('hydrates keyed elements', async () => {
      let items = [
        { id: 'a', text: 'Item A' },
        { id: 'b', text: 'Item B' },
        { id: 'c', text: 'Item C' },
      ]

      let html = await renderToString(
        <ul>
          {items.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>,
      )
      container.innerHTML = html

      let existingItems = container.querySelectorAll('li')
      expect(existingItems).toHaveLength(3)

      let root = createRoot(container)
      root.render(
        <ul>
          {items.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>,
      )
      root.flush()

      let hydratedItems = container.querySelectorAll('li')
      expect(hydratedItems[0]).toBe(existingItems[0])
      expect(hydratedItems[1]).toBe(existingItems[1])
      expect(hydratedItems[2]).toBe(existingItems[2])
    })

    it('hydrates deeply nested elements', async () => {
      let html = await renderToString(
        <div className="level-1">
          <div className="level-2">
            <div className="level-3">
              <div className="level-4">
                <span>Deep content</span>
              </div>
            </div>
          </div>
        </div>,
      )
      container.innerHTML = html

      let level1 = container.querySelector('.level-1')
      let level2 = container.querySelector('.level-2')
      let level3 = container.querySelector('.level-3')
      let level4 = container.querySelector('.level-4')
      let span = container.querySelector('span')
      invariant(level1 && level2 && level3 && level4 && span)

      let root = createRoot(container)
      root.render(
        <div className="level-1">
          <div className="level-2">
            <div className="level-3">
              <div className="level-4">
                <span>Deep content</span>
              </div>
            </div>
          </div>
        </div>,
      )
      root.flush()

      // All levels should be adopted
      expect(container.querySelector('.level-1')).toBe(level1)
      expect(container.querySelector('.level-2')).toBe(level2)
      expect(container.querySelector('.level-3')).toBe(level3)
      expect(container.querySelector('.level-4')).toBe(level4)
      expect(container.querySelector('span')).toBe(span)
    })
  })

  describe('css prop hydration', () => {
    afterEach(() => {
      // Reset the global style manager state between tests
      resetStyleState()
    })

    it('hydrates element with css prop and adopts server style', async () => {
      let html = await renderToString(<div css={{ color: 'red' }}>Hello</div>)

      // Inject server styles into document.head and append body content
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let originalDataCss = existingDiv.getAttribute('data-css')
      expect(originalDataCss).toMatch(/^rmx-/)

      let root = createRoot(container)
      root.render(<div css={{ color: 'red' }}>Hello</div>)
      root.flush()

      // Element should be adopted (same DOM node)
      expect(container.querySelector('div')).toBe(existingDiv)
      // data-css attribute should be preserved
      expect(existingDiv.getAttribute('data-css')).toBe(originalDataCss)
      // Style should apply
      expect(getComputedStyle(existingDiv).color).toBe('rgb(255, 0, 0)')
    })

    it('updates css prop after hydration', async () => {
      let html = await renderToString(<div css={{ color: 'red' }}>Hello</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div css={{ color: 'red' }}>Hello</div>)
      root.flush()

      expect(getComputedStyle(existingDiv).color).toBe('rgb(255, 0, 0)')

      // Update to different css
      root.render(<div css={{ color: 'blue' }}>Hello</div>)
      root.flush()

      expect(getComputedStyle(existingDiv).color).toBe('rgb(0, 0, 255)')
      expect(existingDiv.getAttribute('data-css')).toMatch(/^rmx-/)
    })

    it('removes css prop after hydration', async () => {
      let html = await renderToString(<div css={{ color: 'red' }}>Hello</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div css={{ color: 'red' }}>Hello</div>)
      root.flush()

      expect(existingDiv.hasAttribute('data-css')).toBe(true)

      // Remove css prop entirely
      root.render(<div>Hello</div>)
      root.flush()

      expect(existingDiv.hasAttribute('data-css')).toBe(false)
    })

    it('hydrates css prop combined with className', async () => {
      let html = await renderToString(
        <div className="my-class" css={{ color: 'green' }}>
          Hello
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.className).toBe('my-class')
      expect(existingDiv.getAttribute('data-css')).toMatch(/^rmx-/)

      let root = createRoot(container)
      root.render(
        <div className="my-class" css={{ color: 'green' }}>
          Hello
        </div>,
      )
      root.flush()

      // Element should be adopted
      expect(container.querySelector('div')).toBe(existingDiv)
      // Both className and data-css should be preserved
      expect(existingDiv.className).toBe('my-class')
      expect(existingDiv.getAttribute('data-css')).toMatch(/^rmx-/)
      expect(getComputedStyle(existingDiv).color).toBe('rgb(0, 128, 0)')
    })

    it('multiple elements with same css share style during hydration', async () => {
      let html = await renderToString(
        <div>
          <span css={{ color: 'purple' }}>First</span>
          <span css={{ color: 'purple' }}>Second</span>
        </div>,
      )
      container.innerHTML = html

      let spans = container.querySelectorAll('span')
      expect(spans).toHaveLength(2)

      // Both should have the same data-css selector (deduplication)
      let firstDataCss = spans[0].getAttribute('data-css')
      let secondDataCss = spans[1].getAttribute('data-css')
      expect(firstDataCss).toBe(secondDataCss)
      expect(firstDataCss).toMatch(/^rmx-/)

      let root = createRoot(container)
      root.render(
        <div>
          <span css={{ color: 'purple' }}>First</span>
          <span css={{ color: 'purple' }}>Second</span>
        </div>,
      )
      root.flush()

      // Both spans should be adopted
      let hydratedSpans = container.querySelectorAll('span')
      expect(hydratedSpans[0]).toBe(spans[0])
      expect(hydratedSpans[1]).toBe(spans[1])

      // Both should still have the same data-css
      expect(hydratedSpans[0].getAttribute('data-css')).toBe(firstDataCss)
      expect(hydratedSpans[1].getAttribute('data-css')).toBe(firstDataCss)

      // Style should apply to both
      expect(getComputedStyle(hydratedSpans[0]).color).toBe('rgb(128, 0, 128)')
      expect(getComputedStyle(hydratedSpans[1]).color).toBe('rgb(128, 0, 128)')
    })

    it('handles element unmount with css prop after hydration', async () => {
      let html = await renderToString(
        <div>
          <span css={{ color: 'orange' }}>Will unmount</span>
        </div>,
      )
      container.innerHTML = html

      let root = createRoot(container)
      root.render(
        <div>
          <span css={{ color: 'orange' }}>Will unmount</span>
        </div>,
      )
      root.flush()

      expect(container.querySelector('span')).not.toBe(null)

      // Remove the span
      root.render(<div />)
      root.flush()

      // Span should be gone
      expect(container.querySelector('span')).toBe(null)
    })

    it('adds css prop during hydration when server had none', async () => {
      // Server renders without css prop
      let html = await renderToString(<div>Hello</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.hasAttribute('data-css')).toBe(false)

      // Client adds css prop
      let root = createRoot(container)
      root.render(<div css={{ color: 'cyan' }}>Hello</div>)
      root.flush()

      // Element should be adopted and css applied
      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.getAttribute('data-css')).toMatch(/^rmx-/)
      expect(getComputedStyle(existingDiv).color).toBe('rgb(0, 255, 255)')
    })
  })
})
