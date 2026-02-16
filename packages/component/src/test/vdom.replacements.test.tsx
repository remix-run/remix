import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('type<-->type updates', () => {
    it('updates a text node', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render('Hello, world!')
      expect(container.innerHTML).toBe('Hello, world!')
      render('Hello, world! 2')
      expect(container.innerHTML).toBe('Hello, world! 2')
    })

    it('updates an element', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(<div>Hello, world!</div>)
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')

      let div = container.querySelector('div')
      render(<div>Hello, world! 2</div>)
      expect(container.innerHTML).toBe('<div>Hello, world! 2</div>')
      expect(container.querySelector('div')).toBe(div)
    })

    it('updates an element with attributes', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(<input id="hello" value="world" />)
      let input = container.querySelector('input')
      invariant(input)
      expect(input.getAttribute('id')).toBe('hello')
      expect(input.value).toBe('world')

      render(<input id="hello" value="world 2" />)
      expect(container.querySelector('input')).toBe(input)
      expect(input.getAttribute('id')).toBe('hello')
      expect(input.value).toBe('world 2')
    })

    it('updates a fragment', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(
        <>
          <p>Hello</p>
          <p>world!</p>
        </>,
      )
      let pTags = container.querySelectorAll('p')
      invariant(pTags.length === 2)

      expect(container.innerHTML).toBe('<p>Hello</p><p>world!</p>')
      render(
        <>
          <p>Goodbye</p>
          <p>Universe</p>
        </>,
      )
      expect(container.innerHTML).toBe('<p>Goodbye</p><p>Universe</p>')
      let newPTags = container.querySelectorAll('p')
      expect(newPTags.length).toBe(2)
      expect(newPTags[0]).toBe(pTags[0])
      expect(newPTags[1]).toBe(pTags[1])
    })

    it('updates a component', () => {
      let container = document.createElement('div')

      let setupCalls = 0
      function App(handle: Handle) {
        let state = ++setupCalls
        return ({ title }: { title: string }) => (
          <div>
            {title} {state}
          </div>
        )
      }

      let root = createRoot(container)
      root.render(<App title="Hello" />)
      expect(container.innerHTML).toBe('<div>Hello 1</div>')
      root.render(<App title="Goodbye" />)
      expect(container.innerHTML).toBe('<div>Goodbye 1</div>')
    })

    it('updates a component with a fragment', () => {
      let container = document.createElement('div')

      let setupCalls = 0
      function App(handle: Handle) {
        let state = ++setupCalls
        return ({ title }: { title: string }) => (
          <>
            <span>{title}</span>
            <span>{state}</span>
          </>
        )
      }

      let root = createRoot(container)
      root.render(<App title="Hello" />)
      expect(container.innerHTML).toBe('<span>Hello</span><span>1</span>')

      root.render(<App title="Goodbye" />)
      expect(container.innerHTML).toBe('<span>Goodbye</span><span>1</span>')
    })
  })

  describe('simple replacement', () => {
    it('replaces element -> text', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div>Hello, world!</div>)
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      root.render('Goodbye, element!')
      expect(container.innerHTML).toBe('Goodbye, element!')
    })

    it('replaces text -> element', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render('Hello, world!')
      expect(container.innerHTML).toBe('Hello, world!')
      root.render(<div>Goodbye, world!</div>)
      expect(container.innerHTML).toBe('<div>Goodbye, world!</div>')
    })

    it('replaces element -> component', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div>Hello, world!</div>)
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      function App() {
        return () => <div>Goodbye, world!</div>
      }
      root.render(<App />)
      expect(container.innerHTML).toBe('<div>Goodbye, world!</div>')
    })

    it('replaces component -> element', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      function App() {
        return () => <div>Hello, world!</div>
      }
      root.render(<App />)
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      root.render(<div>Goodbye, world!</div>)
      expect(container.innerHTML).toBe('<div>Goodbye, world!</div>')
    })

    it('replaces element -> element', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(<div>Hello, world!</div>)
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      root.render(<nav>Goodbye, world!</nav>)
      expect(container.innerHTML).toBe('<nav>Goodbye, world!</nav>')
    })

    it('replaces component -> component', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      function App() {
        return () => <div>Hello, world!</div>
      }
      root.render(<App />)
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      function App2() {
        return () => <div>Goodbye, world!</div>
      }
      root.render(<App2 />)
      expect(container.innerHTML).toBe('<div>Goodbye, world!</div>')
    })

    it('replaces component -> fragment', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      function App() {
        return () => <div>Hello, world!</div>
      }
      root.render(<App />)
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      root.render(
        <>
          <p>Goodbye</p>
          <p>world!</p>
        </>,
      )
      expect(container.innerHTML).toBe('<p>Goodbye</p><p>world!</p>')
    })

    it('replaces fragment -> component', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <>
          <div>Hello, world!</div>
        </>,
      )
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      function App() {
        return () => <div>Goodbye, world!</div>
      }
      root.render(<App />)
      expect(container.innerHTML).toBe('<div>Goodbye, world!</div>')
    })

    it('replaces fragment -> element', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <>
          <div>Hello, world!</div>
        </>,
      )
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      root.render(<div>Goodbye, world!</div>)
      expect(container.innerHTML).toBe('<div>Goodbye, world!</div>')
    })

    it('replaces fragment -> text', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <>
          <div>Hello, world!</div>
        </>,
      )
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      root.render('Goodbye, world!')
      expect(container.innerHTML).toBe('Goodbye, world!')
    })

    it('replaces text -> component', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render('Hello, world!')
      expect(container.innerHTML).toBe('Hello, world!')
      function App() {
        return () => <div>Goodbye, world!</div>
      }
      root.render(<App />)
      expect(container.innerHTML).toBe('<div>Goodbye, world!</div>')
    })
  })

  describe('complex replacements', () => {
    it('preserves siblings', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div>
          <div>div</div>
          <span>span</span>
          <p>p</p>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><div>div</div><span>span</span><p>p</p></div>')

      let div = container.querySelector('div')
      let p = container.querySelector('p')
      invariant(div && p)
      root.render(
        <div>
          <div>div</div>
          <nav>nav</nav>
          <p>p</p>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><div>div</div><nav>nav</nav><p>p</p></div>')
      expect(container.querySelector('div')).toBe(div)
      expect(container.querySelector('p')).toBe(p)
    })

    it('replaces null children', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.render(
        <div>
          <div>div</div>
          {null}
          <p>p</p>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><div>div</div><p>p</p></div>')
      let div = container.querySelector('div')
      let p = container.querySelector('p')
      invariant(div && p)

      root.render(
        <div>
          <div>div</div>
          <span>span</span>
          <p>p</p>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><div>div</div><span>span</span><p>p</p></div>')
      expect(container.querySelector('div')).toBe(div)
      expect(container.querySelector('p')).toBe(p)
    })

    it('replaces fragment components', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      function Frag() {
        return () => (
          <>
            <span>A</span>
            <span>B</span>
          </>
        )
      }
      root.render(
        <div>
          <Frag />
          <main>main</main>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><span>A</span><span>B</span><main>main</main></div>')
      let main = container.querySelector('main')
      invariant(main)

      root.render(
        <div>
          <div>one</div>
          <main>main</main>
        </div>,
      )
      expect(container.innerHTML).toBe('<div><div>one</div><main>main</main></div>')
      expect(container.querySelector('main')).toBe(main)
    })

    it('replaces components within elements', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      function App() {
        return () => <div>Hello, world!</div>
      }
      root.render(
        <div>
          <App />
        </div>,
      )
      expect(container.innerHTML).toBe('<div><div>Hello, world!</div></div>')

      function App2() {
        return () => <div>Goodbye, world!</div>
      }
      root.render(
        <div>
          <App2 />
        </div>,
      )
      expect(container.innerHTML).toBe('<div><div>Goodbye, world!</div></div>')
    })
  })
})
