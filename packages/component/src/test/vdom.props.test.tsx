import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'

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
    it.todo('does not render css')
    it.todo('does not render children')
    it.todo('does not render tabIndex')
    it.todo('does not render acceptCharset')
  })

  describe('innerHTML prop', () => {
    it('sets innerHTML on element', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div innerHTML="<span>Hello</span>" />)
      expect(container.innerHTML).toBe('<div><span>Hello</span></div>')
    })

    it('ignores children when innerHTML is set', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div innerHTML="<span>From innerHTML</span>">
          <p>Ignored child</p>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><span>From innerHTML</span></div>')
    })

    it('updates innerHTML on re-render', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div innerHTML="<span>First</span>" />)
      expect(container.innerHTML).toBe('<div><span>First</span></div>')

      let div = container.querySelector('div')
      invariant(div)

      root.render(<div innerHTML="<span>Second</span>" />)
      expect(container.innerHTML).toBe('<div><span>Second</span></div>')
      expect(container.querySelector('div')).toBe(div)
    })

    it('clears innerHTML when removed', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div innerHTML="<span>Hello</span>" />)
      expect(container.innerHTML).toBe('<div><span>Hello</span></div>')

      root.render(<div />)
      expect(container.innerHTML).toBe('<div></div>')
    })

    it('switches from innerHTML to children', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div innerHTML="<span>From innerHTML</span>" />)
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

      root.render(<div innerHTML="<span>From innerHTML</span>" />)
      expect(container.innerHTML).toBe('<div><span>From innerHTML</span></div>')
    })
  })

  describe('css props', () => {
    it('adds data-css attribute and styles', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div css={{ color: 'rgb(255, 0, 0)' }}>Hello</div>)
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      expect(div.getAttribute('data-css')).toMatch(/^rmx-/)
      document.body.appendChild(container)
      expect(getComputedStyle(div).color).toBe('rgb(255, 0, 0)')
    })

    it('css prop is isolated from className', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div css={{ color: 'rgb(255, 0, 0)' }} className="custom-class">
          Hello
        </div>,
      )
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      // className is completely separate from css prop
      expect(div.className).toBe('custom-class')
      expect(div.getAttribute('data-css')).toMatch(/^rmx-/)
    })

    it('css prop is isolated from class', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div css={{ color: 'rgb(0, 255, 0)' }} class="another-class">
          Hello
        </div>,
      )
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      // class is completely separate from css prop
      expect(div.className).toBe('another-class')
      expect(div.getAttribute('data-css')).toMatch(/^rmx-/)
    })

    it('className updates independently of css prop', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div css={{ color: 'rgb(255, 0, 0)' }} className="first">
          Hello
        </div>,
      )
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      expect(div.className).toBe('first')
      expect(div.getAttribute('data-css')).toMatch(/^rmx-/)

      root.render(
        <div css={{ color: 'rgb(255, 0, 0)' }} className="second">
          Hello
        </div>,
      )
      expect(div.className).toBe('second')
      expect(div.getAttribute('data-css')).toMatch(/^rmx-/)
    })

    it('removes nested selector rules when they become undefined', async () => {
      let container = document.createElement('div')
      document.body.appendChild(container)
      let root = createRoot(container)

      root.render(
        <div
          css={{
            // Base styling for the child comes from the parent.
            '& span': { color: 'rgb(0, 0, 255)' },
            // More-specific nested selector is conditionally removed.
            '& span.special': { color: 'rgb(255, 0, 0)' },
          }}
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
          css={{
            '& span': { color: 'rgb(0, 0, 255)' },
            '& span.special': undefined,
          }}
        >
          <span className="special">Test</span>
        </div>,
      )

      // Once the more-specific selector becomes undefined, the child should fall back to the base rule.
      expect(getComputedStyle(child).color).toBe('rgb(0, 0, 255)')
    })
  })
})
