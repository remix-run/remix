import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createElement } from '../runtime/create-element.ts'
import { createRoot } from '../runtime/vdom.ts'
import { invariant } from '../runtime/invariant.ts'
import { css, unsafeHTML } from '../index.ts'

describe('vnode rendering', () => {
  describe('special attributes', () => {
    it.todo('className')
    it.todo('htmlFor')
    it.todo('acceptCharset')
    it.todo('httpEquiv')
    it.todo('xlinkHref')
    it.todo('xmlLang')
    it.todo('xmlSpace')
    it.todo('data-*')
    it.todo('aria-*')
  })

  describe('special props', () => {
    it.todo('style')
    it.todo('value')
    it.todo('defaultValue')
    it.todo('checked')
    it.todo('defaultChecked')
    it.todo('disabled')
  })

  describe('framework props', () => {
    it.todo('does not render key')
    it.todo('does not render on')
    it.todo('does not render mix')
    it.todo('does not render children')
    it.todo('does not render tabIndex')
    it.todo('does not render acceptCharset')
  })

  describe('enumerated attributes', () => {
    it('sets booleanish string attributes as explicit false values', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(<img alt="" contentEditable={false} draggable={false} spellCheck={false} />)

      let img = container.querySelector('img')
      invariant(img instanceof HTMLImageElement)
      expect(img.getAttribute('contenteditable')).toBe('false')
      expect(img.getAttribute('draggable')).toBe('false')
      expect(img.getAttribute('spellcheck')).toBe('false')
    })

    it('sets translate with yes/no attribute values', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(<div translate="no" />)

      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      expect(div.getAttribute('translate')).toBe('no')
    })

    it('preserves string false values for booleanish string attributes', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(<img alt="" contentEditable="false" draggable="false" spellcheck="false" />)

      let img = container.querySelector('img')
      invariant(img instanceof HTMLImageElement)
      expect(img.getAttribute('contenteditable')).toBe('false')
      expect(img.getAttribute('draggable')).toBe('false')
      expect(img.getAttribute('spellcheck')).toBe('false')
    })
  })

  describe('innerHTML prop', () => {
    it('sets innerHTML on element', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div innerHTML={unsafeHTML('<span>Hello</span>')} />)
      expect(container.innerHTML).toBe('<div><span>Hello</span></div>')
    })

    it('rejects unbranded innerHTML values', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let props = JSON.parse('{"innerHTML":"<img src=invalid onerror=alert(1)>"}')

      expect(() => root.render(createElement('div', props))).toThrow('Invalid innerHTML prop')

      expect(container.innerHTML).toBe('')
    })

    it('sets branded iframe srcDoc', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<iframe srcDoc={unsafeHTML('<p>HTML</p>')} />)

      expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toBe('<p>HTML</p>')
    })

    it('sets branded iframe srcdoc', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<iframe srcdoc={unsafeHTML('<p>HTML</p>')} />)

      expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toBe('<p>HTML</p>')
    })

    it('rejects unbranded iframe srcDoc values before DOM mutation', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      expect(() =>
        root.render(createElement('iframe', { srcDoc: '<img src=invalid onerror=alert(1)>' })),
      ).toThrow('Invalid srcDoc prop')

      expect(container.innerHTML).toBe('')
    })

    it('rejects JSON-shaped iframe srcDoc values before DOM mutation', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      expect(() =>
        root.render(createElement('iframe', { srcDoc: { value: '<p>HTML</p>' } })),
      ).toThrow('Invalid srcDoc prop')

      expect(container.innerHTML).toBe('')
    })

    it('rejects unbranded iframe srcdoc values before DOM mutation', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      expect(() =>
        root.render(createElement('iframe', { srcdoc: '<img src=invalid onerror=alert(1)>' })),
      ).toThrow('Invalid srcdoc prop')

      expect(container.innerHTML).toBe('')
    })

    it('rejects JSON-shaped iframe srcdoc values before DOM mutation', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      expect(() =>
        root.render(createElement('iframe', { srcdoc: { value: '<p>HTML</p>' } })),
      ).toThrow('Invalid srcdoc prop')

      expect(container.innerHTML).toBe('')
    })

    it('rejects outerHTML before replacing a host node', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(<div data-existing="yes" />)
      let existing = container.querySelector('div')
      invariant(existing)

      expect(() => root.render(createElement('div', { outerHTML: '<p>replacement</p>' }))).toThrow(
        'Invalid outerHTML prop',
      )

      expect(container.querySelector('div')).toBe(existing)
      expect(container.innerHTML).toBe('<div data-existing="yes"></div>')
    })

    it('ignores children when innerHTML is set', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div innerHTML={unsafeHTML('<span>From innerHTML</span>')}>
          <p>Ignored child</p>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><span>From innerHTML</span></div>')
    })

    it('updates innerHTML on re-render', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div innerHTML={unsafeHTML('<span>First</span>')} />)
      expect(container.innerHTML).toBe('<div><span>First</span></div>')

      let div = container.querySelector('div')
      invariant(div)

      root.render(<div innerHTML={unsafeHTML('<span>Second</span>')} />)
      expect(container.innerHTML).toBe('<div><span>Second</span></div>')
      expect(container.querySelector('div')).toBe(div)
    })

    it('clears innerHTML when removed', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div innerHTML={unsafeHTML('<span>Hello</span>')} />)
      expect(container.innerHTML).toBe('<div><span>Hello</span></div>')

      root.render(<div />)
      expect(container.innerHTML).toBe('<div></div>')
    })

    it('switches from innerHTML to children', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div innerHTML={unsafeHTML('<span>From innerHTML</span>')} />)
      expect(container.innerHTML).toBe('<div><span>From innerHTML</span></div>')

      root.render(
        <div>
          <p>From children</p>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><p>From children</p></div>')
    })

    it('switches from children to innerHTML', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div>
          <p>From children</p>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><p>From children</p></div>')

      root.render(<div innerHTML={unsafeHTML('<span>From innerHTML</span>')} />)
      expect(container.innerHTML).toBe('<div><span>From innerHTML</span></div>')
    })

    it('switches from text children to innerHTML without throwing', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let renderError: unknown
      root.addEventListener('error', (event) => {
        renderError = (event as ErrorEvent).error
      })

      root.render(<div>From text child</div>)
      expect(container.innerHTML).toBe('<div>From text child</div>')

      root.render(<div innerHTML={unsafeHTML('<span>From innerHTML</span>')} />)
      expect(container.innerHTML).toBe('<div><span>From innerHTML</span></div>')
      expect(renderError).toBeUndefined()
    })
  })

  describe('css mixin', () => {
    it('adds className-based styles', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div mix={[css({ color: 'rgb(255, 0, 0)' })]}>Hello</div>)
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      expect(div.className).toMatch(/rmxc-/)
      document.body.appendChild(container)
      expect(getComputedStyle(div).color).toBe('rgb(255, 0, 0)')
    })

    it('composes with className without overriding it', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div mix={[css({ color: 'rgb(255, 0, 0)' })]} className="custom-class">
          Hello
        </div>,
      )
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      expect(div.className).toContain('custom-class')
      expect(div.className).toMatch(/rmxc-/)
    })

    it('ignores class when composing css mixin className', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div mix={[css({ color: 'rgb(0, 255, 0)' })]} class="another-class">
          Hello
        </div>,
      )
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      expect(div.className).toMatch(/rmxc-/)
    })

    it('className updates independently of css mixin output', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div mix={[css({ color: 'rgb(255, 0, 0)' })]} className="first">
          Hello
        </div>,
      )
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      expect(div.className).toContain('first')
      let generated = div.className.split(/\s+/).find((token) => token.startsWith('rmxc-'))
      invariant(generated)

      root.render(
        <div mix={[css({ color: 'rgb(255, 0, 0)' })]} className="second">
          Hello
        </div>,
      )
      expect(div.className).toContain('second')
      expect(div.className).toContain(generated)
    })

    it('removes nested selector rules when they become undefined', async () => {
      let container = document.createElement('div')
      document.body.appendChild(container)
      let root = createRoot(container)

      root.render(
        <div
          mix={[
            css({
              // Base styling for the child comes from the parent.
              '& span': { color: 'rgb(0, 0, 255)' },
              // More-specific nested selector is conditionally removed.
              '& span.special': { color: 'rgb(255, 0, 0)' },
            }),
          ]}
        >
          <span className="special">Test</span>
        </div>,
      )

      let child = container.querySelector('span')
      invariant(child)

      // More-specific nested selector should win.
      expect(getComputedStyle(child).color).toBe('rgb(255, 0, 0)')

      root.render(
        <div
          mix={[
            css({
              '& span': { color: 'rgb(0, 0, 255)' },
              '& span.special': undefined,
            }),
          ]}
        >
          <span className="special">Test</span>
        </div>,
      )

      // Once the more-specific selector becomes undefined, the child should fall back to the base rule.
      expect(getComputedStyle(child).color).toBe('rgb(0, 0, 255)')
    })
  })
})
