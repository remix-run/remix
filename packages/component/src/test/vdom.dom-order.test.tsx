import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('conditional rendering and DOM order', () => {
    it('maintains DOM order when component switches element types via self-update', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let showB = false
      let capturedUpdate = () => {}

      function A(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => (showB ? <span>B</span> : <div>A</div>)
      }

      root.render(
        <main>
          <A />
          <p>C</p>
        </main>,
      )
      expect(container.innerHTML).toBe('<main><div>A</div><p>C</p></main>')

      showB = true
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<main><span>B</span><p>C</p></main>')

      showB = false
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<main><div>A</div><p>C</p></main>')
    })

    it('maintains DOM order when component switches from component to element via self-update', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let showB = false
      let capturedUpdate = () => {}

      function B() {
        return () => <span>B</span>
      }

      function A(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => (showB ? <B /> : <div>A</div>)
      }

      root.render(
        <main>
          <A />
          <p>C</p>
        </main>,
      )
      expect(container.innerHTML).toBe('<main><div>A</div><p>C</p></main>')

      showB = true
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<main><span>B</span><p>C</p></main>')

      showB = false
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<main><div>A</div><p>C</p></main>')
    })

    it('updates correctly when replaced component self-updates from component to element', () => {
      // This tests the stale anchor bug: when component A is replaced by B,
      // the anchor for B is captured from A's DOM. If B then self-updates
      // to change its content type, the stale anchor must not be used.
      let container = document.createElement('div')
      let root = createRoot(container)

      function Loading() {
        return () => <div>Loading...</div>
      }

      let loaded = false
      let capturedUpdate = () => {}

      function PageB(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => (loaded ? <div>Loaded!</div> : <Loading />)
      }

      function PageA() {
        return () => <div>Page A</div>
      }

      let Page: typeof PageA | typeof PageB = PageA

      function App(handle: Handle) {
        return () => (
          <main>
            <nav>Nav</nav>
            <Page />
          </main>
        )
      }

      root.render(<App />)
      expect(container.innerHTML).toBe('<main><nav>Nav</nav><div>Page A</div></main>')

      // Switch to PageB (captures anchor from PageA's div)
      Page = PageB
      root.render(<App />)
      expect(container.innerHTML).toBe('<main><nav>Nav</nav><div>Loading...</div></main>')

      // PageB self-updates: Loading -> div (must not use stale PageA anchor)
      loaded = true
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<main><nav>Nav</nav><div>Loaded!</div></main>')
    })

    it('updates correctly when component switches from element to component via self-update', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function Loading() {
        return () => <span>Loading...</span>
      }

      let showLoading = false
      let capturedUpdate = () => {}

      function A(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => (showLoading ? <Loading /> : <div>Content</div>)
      }

      root.render(
        <main>
          <A />
          <p>Footer</p>
        </main>,
      )
      expect(container.innerHTML).toBe('<main><div>Content</div><p>Footer</p></main>')

      showLoading = true
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<main><span>Loading...</span><p>Footer</p></main>')

      showLoading = false
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<main><div>Content</div><p>Footer</p></main>')
    })

    it('updates correctly with deeply nested component type changes', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function Inner() {
        return () => <span>Inner</span>
      }

      function Middle() {
        return () => <Inner />
      }

      let useNested = true
      let capturedUpdate = () => {}

      function Outer(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => (useNested ? <Middle /> : <div>Direct</div>)
      }

      root.render(
        <main>
          <Outer />
          <footer>Footer</footer>
        </main>,
      )
      expect(container.innerHTML).toBe('<main><span>Inner</span><footer>Footer</footer></main>')

      useNested = false
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<main><div>Direct</div><footer>Footer</footer></main>')

      useNested = true
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<main><span>Inner</span><footer>Footer</footer></main>')
    })

    it('updates correctly when multiple components are replaced and self-update', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function LoadingA() {
        return () => <span>Loading A...</span>
      }

      function LoadingB() {
        return () => <span>Loading B...</span>
      }

      let loadedA = false
      let loadedB = false
      let capturedUpdateA = () => {}
      let capturedUpdateB = () => {}

      function CompA(handle: Handle) {
        capturedUpdateA = () => handle.update()
        return () => (loadedA ? <div>A Done</div> : <LoadingA />)
      }

      function CompB(handle: Handle) {
        capturedUpdateB = () => handle.update()
        return () => (loadedB ? <div>B Done</div> : <LoadingB />)
      }

      root.render(
        <main>
          <CompA />
          <CompB />
        </main>,
      )
      expect(container.innerHTML).toBe(
        '<main><span>Loading A...</span><span>Loading B...</span></main>',
      )

      // Update A first
      loadedA = true
      capturedUpdateA()
      root.flush()
      expect(container.innerHTML).toBe('<main><div>A Done</div><span>Loading B...</span></main>')

      // Then update B
      loadedB = true
      capturedUpdateB()
      root.flush()
      expect(container.innerHTML).toBe('<main><div>A Done</div><div>B Done</div></main>')
    })

    it('maintains DOM order when replaced component self-updates with same element type', () => {
      // Tests that anchor calculation works for same-type updates (element->element)
      // after a component replacement. The anchor should be the next sibling, not the
      // component's own content.
      let container = document.createElement('div')
      let root = createRoot(container)

      let count = 0
      let capturedUpdate = () => {}

      function PageB(handle: Handle) {
        capturedUpdate = () => handle.update()
        return () => <div>Count: {count}</div>
      }

      function PageA() {
        return () => <div>Page A</div>
      }

      let Page: typeof PageA | typeof PageB = PageA

      function App(handle: Handle) {
        return () => (
          <main>
            <nav>Nav</nav>
            <Page />
            <footer>Footer</footer>
          </main>
        )
      }

      root.render(<App />)
      expect(container.innerHTML).toBe(
        '<main><nav>Nav</nav><div>Page A</div><footer>Footer</footer></main>',
      )

      // Replace PageA with PageB (anchor is captured from PageA's div)
      Page = PageB
      root.render(<App />)
      expect(container.innerHTML).toBe(
        '<main><nav>Nav</nav><div>Count: 0</div><footer>Footer</footer></main>',
      )

      // PageB self-updates: same element type (div->div), should maintain position
      count = 1
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe(
        '<main><nav>Nav</nav><div>Count: 1</div><footer>Footer</footer></main>',
      )

      // Another self-update
      count = 2
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe(
        '<main><nav>Nav</nav><div>Count: 2</div><footer>Footer</footer></main>',
      )
    })

    it('maintains DOM order when fragment component adds children via self-update with siblings', () => {
      // Critical test: a component renders a fragment, has siblings after it,
      // and grows the fragment via self-update. Without proper anchor calculation,
      // new children would be appended after the siblings.
      let container = document.createElement('div')
      let root = createRoot(container)

      let items = [0]
      let capturedUpdate = () => {}

      function List(handle: Handle) {
        capturedUpdate = () => handle.update()
        // No keys - uses index-based diff
        return () => (
          <>
            {items.map((i) => (
              <span>{i}</span>
            ))}
          </>
        )
      }

      root.render(
        <main>
          <List />
          <footer>Footer</footer>
        </main>,
      )
      expect(container.innerHTML).toBe('<main><span>0</span><footer>Footer</footer></main>')

      // Add more items - new spans must appear BEFORE footer
      items = [0, 1]
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe(
        '<main><span>0</span><span>1</span><footer>Footer</footer></main>',
      )

      // Add even more
      items = [0, 1, 2]
      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe(
        '<main><span>0</span><span>1</span><span>2</span><footer>Footer</footer></main>',
      )
    })
  })
})
