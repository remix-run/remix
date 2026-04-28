import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'

describe('vnode rendering', () => {
  describe('inserts', () => {
    it('renders text', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render('Hello, world!')
      expect(container.innerHTML).toBe('Hello, world!')
    })

    it('renders number', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(42)
      expect(container.innerHTML).toBe('42')
    })

    it('renders 0', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(0)
      expect(container.innerHTML).toBe('0')
    })

    it('renders bigint', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(BigInt(9007199254740991))
      expect(container.innerHTML).toBe('9007199254740991')
    })

    it('renders true', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(true)
      expect(container.innerHTML).toBe('')
    })

    it('renders false', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(false)
      expect(container.innerHTML).toBe('')
    })

    it('renders null', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(null)
      expect(container.innerHTML).toBe('')
    })

    it('renders undefined', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(undefined)
      expect(container.innerHTML).toBe('')
    })
  })

  describe('removals', () => {
    it('removes a text node', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(<div>Hello, world!</div>)
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      render(<div />)
      expect(container.innerHTML).toBe('<div></div>')
    })

    it('removes an element', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(
        <div>
          <span>Hello, world!</span>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><span>Hello, world!</span></div>')
      render(<div />)
      expect(container.innerHTML).toBe('<div></div>')
    })

    it('removes attributes', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<input id="hello" value="world" />)
      let input = container.querySelector('input')
      expect(input).toBeInstanceOf(HTMLInputElement)
      expect((input as HTMLInputElement).value).toBe('world')
      expect((input as HTMLInputElement).getAttribute('id')).toBe('hello')
      root.render(<input />)
      root.flush()
      expect((input as HTMLInputElement).value).toBe('')
      expect((input as HTMLInputElement).hasAttribute('id')).toBe(false)
      expect((input as HTMLInputElement).hasAttribute('value')).toBe(false)
    })

    it('removes reflected attributes without leaving empty values', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div id="hello" className="world">
          content
        </div>,
      )

      let div = container.querySelector('div')
      expect(div).toBeInstanceOf(HTMLDivElement)
      expect((div as HTMLDivElement).getAttribute('id')).toBe('hello')
      expect((div as HTMLDivElement).getAttribute('class')).toBe('world')

      root.render(<div>content</div>)
      root.flush()

      expect((div as HTMLDivElement).hasAttribute('id')).toBe(false)
      expect((div as HTMLDivElement).hasAttribute('class')).toBe(false)
    })

    it('removes a fragment', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(
        <div>
          <>
            <p>Hello</p>
            <p>world!</p>
          </>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><p>Hello</p><p>world!</p></div>')
      render(<div />)
      expect(container.innerHTML).toBe('<div></div>')
    })

    it('removes a component', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      function App() {
        return () => <div>Hello, world!</div>
      }
      render(
        <div>
          <App />
        </div>,
      )
      expect(container.innerHTML).toBe('<div><div>Hello, world!</div></div>')
      render(<div></div>)
      expect(container.innerHTML).toBe('<div></div>')
    })
  })
})
