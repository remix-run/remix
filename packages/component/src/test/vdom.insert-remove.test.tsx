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

    it.skip('removes attributes', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<input id="hello" value="world" />)
      let input = container.querySelector('input')
      expect(input).toBeInstanceOf(HTMLInputElement)
      expect((input as HTMLInputElement).value).toBe('world')
      expect(container.innerHTML).toBe('<input id="hello">')
      root.render(<input />)
      root.flush()
      expect((input as HTMLInputElement).value).toBe('')
      expect(container.innerHTML).toBe('<input id="">') // FIXME: should be <input>
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
