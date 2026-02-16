import { describe, it, expect } from 'vitest'
import type { Handle } from '../lib/component.ts'
import { createRangeRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'

describe('createRangeRoot', () => {
  describe('basic rendering', () => {
    it('renders content between markers', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      let root = createRangeRoot([start, end])
      root.render(<div>Hello</div>)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><div>Hello</div><!--end-->')
    })

    it('renders text between markers', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      let root = createRangeRoot([start, end])
      root.render('Hello, world!')
      root.flush()

      expect(container.innerHTML).toBe('<!--start-->Hello, world!<!--end-->')
    })

    it('renders fragments between markers', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      let root = createRangeRoot([start, end])
      root.render(
        <>
          <p>First</p>
          <p>Second</p>
        </>,
      )
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><p>First</p><p>Second</p><!--end-->')
    })

    it('renders components between markers', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      function Greeting() {
        return () => <span>Hello!</span>
      }

      let root = createRangeRoot([start, end])
      root.render(<Greeting />)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><span>Hello!</span><!--end-->')
    })
  })

  describe('updates', () => {
    it('updates content between markers', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      let root = createRangeRoot([start, end])
      root.render(<div>First</div>)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><div>First</div><!--end-->')

      root.render(<div>Second</div>)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><div>Second</div><!--end-->')
    })

    it('handles adding children', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      let root = createRangeRoot([start, end])
      root.render(<div />)
      root.flush()

      root.render(
        <div>
          <span>Added</span>
        </div>,
      )
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><div><span>Added</span></div><!--end-->')
    })

    it('handles removing children', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      let root = createRangeRoot([start, end])
      root.render(
        <div>
          <span>To remove</span>
        </div>,
      )
      root.flush()

      root.render(<div />)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><div></div><!--end-->')
    })

    it('replaces all fragment children with different elements', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      let root = createRangeRoot([start, end])
      root.render(
        <>
          <div>First</div>
          <div>Second</div>
        </>,
      )
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><div>First</div><div>Second</div><!--end-->')

      // Replace divs with spans
      root.render(
        <>
          <span>A</span>
          <span>B</span>
        </>,
      )
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><span>A</span><span>B</span><!--end-->')
    })

    it('renders null then content', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      let root = createRangeRoot([start, end])
      root.render(null)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><!--end-->')

      root.render(<div>Now visible</div>)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><div>Now visible</div><!--end-->')
    })

    it('renders content then null then content', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      let root = createRangeRoot([start, end])
      root.render(<div>Visible</div>)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><div>Visible</div><!--end-->')

      root.render(null)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><!--end-->')

      root.render(<span>Back again</span>)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><span>Back again</span><!--end-->')
    })

    it('changes fragment child count', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      let root = createRangeRoot([start, end])
      root.render(
        <>
          <div>One</div>
          <div>Two</div>
          <div>Three</div>
        </>,
      )
      root.flush()

      expect(container.innerHTML).toBe(
        '<!--start--><div>One</div><div>Two</div><div>Three</div><!--end-->',
      )

      // Reduce to one child
      root.render(<div>Only</div>)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><div>Only</div><!--end-->')

      // Back to multiple
      root.render(
        <>
          <span>A</span>
          <span>B</span>
        </>,
      )
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><span>A</span><span>B</span><!--end-->')
    })
  })

  describe('events', () => {
    it('attaches event handlers', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

      let clicked = false
      let root = createRangeRoot([start, end])
      root.render(
        <button
          on={{
            click: () => {
              clicked = true
            },
          }}
        >
          Click me
        </button>,
      )
      root.flush()

      let button = container.querySelector('button')
      invariant(button)
      button.click()

      expect(clicked).toBe(true)
    })
  })

  describe('multiple range roots', () => {
    it('supports multiple ranges in same container', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<!--a--><div>A</div><!--/a--><p>static</p><!--b--><div>B</div><!--/b-->'

      let startA = container.childNodes[0] as Comment
      let endA = container.childNodes[2] as Comment
      let startB = container.childNodes[4] as Comment
      let endB = container.childNodes[6] as Comment

      let existingDivA = container.querySelector('div')
      let existingDivB = container.querySelectorAll('div')[1]

      let rootA = createRangeRoot([startA, endA])
      let rootB = createRangeRoot([startB, endB])

      rootA.render(<div>A updated</div>)
      rootB.render(<div>B updated</div>)
      rootA.flush()
      rootB.flush()

      // Content between markers updated, static content unchanged
      expect(container.innerHTML).toBe(
        '<!--a--><div>A updated</div><!--/a--><p>static</p><!--b--><div>B updated</div><!--/b-->',
      )

      // Original nodes reused
      expect(container.querySelector('div')).toBe(existingDivA)
      expect(container.querySelectorAll('div')[1]).toBe(existingDivB)
    })

    it('ranges are independent', () => {
      let container = document.createElement('div')
      let startA = document.createComment('a')
      let endA = document.createComment('/a')
      let startB = document.createComment('b')
      let endB = document.createComment('/b')

      container.appendChild(startA)
      container.appendChild(endA)
      container.appendChild(startB)
      container.appendChild(endB)

      let rootA = createRangeRoot([startA, endA])
      let rootB = createRangeRoot([startB, endB])

      rootA.render(<span>A</span>)
      rootA.flush()

      // Only A has content, B is empty
      expect(container.innerHTML).toBe('<!--a--><span>A</span><!--/a--><!--b--><!--/b-->')

      rootB.render(<span>B</span>)
      rootB.flush()

      expect(container.innerHTML).toBe(
        '<!--a--><span>A</span><!--/a--><!--b--><span>B</span><!--/b-->',
      )
    })
  })

  describe('boundary handling', () => {
    it('does not affect content before start marker', () => {
      let container = document.createElement('div')
      container.innerHTML = '<header>Before</header><!--start--><!--end-->'

      let start = container.childNodes[1] as Comment
      let end = container.childNodes[2] as Comment

      let root = createRangeRoot([start, end])
      root.render(<div>Inside</div>)
      root.flush()

      expect(container.innerHTML).toBe(
        '<header>Before</header><!--start--><div>Inside</div><!--end-->',
      )
    })

    it('does not affect content after end marker', () => {
      let container = document.createElement('div')
      // Range has existing content to hydrate
      container.innerHTML = '<!--start--><div>Old</div><!--end--><footer>After</footer>'

      let start = container.childNodes[0] as Comment
      let end = container.childNodes[2] as Comment

      let root = createRangeRoot([start, end])
      root.render(<div>New</div>)
      root.flush()

      expect(container.innerHTML).toBe('<!--start--><div>New</div><!--end--><footer>After</footer>')
    })

    it('handles empty ranges with content after end marker', () => {
      let container = document.createElement('div')
      // Empty range with content following it
      container.innerHTML = '<!--start--><!--end--><footer>After</footer>'

      let start = container.firstChild as Comment
      let end = container.childNodes[1] as Comment
      let footer = container.querySelector('footer')
      invariant(footer)

      let root = createRangeRoot([start, end])
      root.render(<div>New content</div>)
      root.flush()

      // Content should be inserted inside the range, not adopt the footer
      expect(container.innerHTML).toBe(
        '<!--start--><div>New content</div><!--end--><footer>After</footer>',
      )
      // Footer should be unchanged
      expect(container.querySelector('footer')).toBe(footer)
    })

    it('preserves surrounding content during updates', () => {
      let container = document.createElement('div')
      container.innerHTML = '<header>H</header><!--start--><p>Old</p><!--end--><footer>F</footer>'

      let start = container.childNodes[1] as Comment
      let end = container.childNodes[3] as Comment

      let root = createRangeRoot([start, end])
      root.render(<p>New</p>)
      root.flush()

      expect(container.innerHTML).toBe(
        '<header>H</header><!--start--><p>New</p><!--end--><footer>F</footer>',
      )

      // Multiple updates shouldn't affect boundaries
      root.render(<p>Updated again</p>)
      root.flush()

      expect(container.innerHTML).toBe(
        '<header>H</header><!--start--><p>Updated again</p><!--end--><footer>F</footer>',
      )
    })
  })

  describe('stateful components', () => {
    it('maintains component state across renders', () => {
      let container = document.createElement('div')
      let start = document.createComment('start')
      let end = document.createComment('end')
      container.appendChild(start)
      container.appendChild(end)

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
            {count}
          </button>
        )
      }

      let root = createRangeRoot([start, end])
      root.render(<Counter setup={0} />)
      root.flush()

      let button = container.querySelector('button')
      invariant(button)
      expect(button.textContent).toBe('0')

      button.click()
      root.flush()

      expect(button.textContent).toBe('1')

      button.click()
      root.flush()

      expect(button.textContent).toBe('2')
    })
  })
})
