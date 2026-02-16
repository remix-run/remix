import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'

describe('vnode rendering', () => {
  describe('elements', () => {
    it('renders basic elements', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(<div>Hello, world!</div>)
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
    })

    it('renders nested elements', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(
        <div>
          Hello, <span>world!</span>
        </div>,
      )
      expect(container.innerHTML).toBe('<div>Hello, <span>world!</span></div>')
    })

    it('renders attributes', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(<input id="hello" value="world" />)
      let input = container.querySelector('input')
      invariant(input instanceof HTMLInputElement)
      expect(input.value).toBe('world')
      expect(container.innerHTML).toBe('<input id="hello">')
    })

    it('renders 0 as a child', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(<div>{0}</div>)
      expect(container.innerHTML).toBe('<div>0</div>')
    })

    it('renders style object via DOM properties; hydration leaves string in place', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(
        <div
          style={{
            marginTop: 12,
            display: 'block',
            lineHeight: Number.NaN,
            '--size': 10,
          }}
        >
          X
        </div>,
      )
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)
      expect(div.style.marginTop).toBe('12px')
      expect(div.style.display).toBe('block')
      expect(div.getAttribute('style') || '').toContain('--size: 10')
      expect(div.style.lineHeight).toBe('')

      let container2 = document.createElement('div')
      container2.innerHTML = '<div style="color: red">X</div>'
      let root2 = createRoot(container2)
      root2.render(<div style={{ color: 'blue' }}>X</div>)
      let div2 = container2.querySelector('div')
      invariant(div2 instanceof HTMLDivElement)
      expect(div2.style.color).toBe('blue')
    })
  })

  describe('fragments', () => {
    it('inserts fragments', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(
        <>
          <p>Hello</p>
          <p>world!</p>
        </>,
      )
      expect(container.innerHTML).toBe('<p>Hello</p><p>world!</p>')
    })

    it('inserts nested fragments', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(
        <div>
          <>
            <p>Hello</p>
            <p>world!</p>
          </>
          <p>Goodbye</p>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><p>Hello</p><p>world!</p><p>Goodbye</p></div>')
    })

    it('inserts new nodes in a parent', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(
        <div>
          <p>Hello</p>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><p>Hello</p></div>')

      let p = container.querySelector('p')
      invariant(p)
      render(
        <div>
          <p>Hello</p>
          <p>Goodbye</p>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><p>Hello</p><p>Goodbye</p></div>')
      expect(container.querySelector('p')).toBe(p)
    })
  })
})
