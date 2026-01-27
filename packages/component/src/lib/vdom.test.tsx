import { describe, it, expect } from 'vitest'
import { createRoot } from './vdom.ts'
import { invariant } from './invariant.ts'
import type { Dispatched } from '@remix-run/interaction'
import type { Assert, Equal } from './test/utils.ts'
import type { Handle, RemixNode } from './component.ts'

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
  })

  describe('svg', () => {
    it('renders SVG root and children with SVG namespace and attributes', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)

      render(
        <svg viewBox="0 0 24 24" fill="none">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>,
      )

      let svg = container.querySelector('svg')
      let path = container.querySelector('path')
      invariant(svg instanceof SVGSVGElement)
      invariant(path instanceof SVGPathElement)

      expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg')

      // Attribute casing: preserve exceptions and kebab-case general SVG attrs
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
      expect(path.getAttribute('stroke-linecap')).toBe('round')
      expect(path.getAttribute('stroke-linejoin')).toBe('round')
    })

    it('supports xlinkHref -> xlink:href on SVG elements', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)

      render(
        <svg>
          <use xlinkHref="#my-id" />
        </svg>,
      )

      let useEl = container.querySelector('use')
      invariant(useEl instanceof SVGUseElement)

      expect(useEl.getAttribute('xlink:href')).toBe('#my-id')
    })

    it('renders HTML subtree inside foreignObject with HTML namespace', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)

      render(
        <svg>
          <foreignObject>
            <div id="x">Hello</div>
          </foreignObject>
        </svg>,
      )

      let div = container.querySelector('#x')
      invariant(div)
      expect(div instanceof HTMLDivElement).toBe(true)
      expect(div.namespaceURI).toBe('http://www.w3.org/1999/xhtml')
    })

    it('updates and removes SVG attributes', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.render(
        <svg>
          <path id="p" strokeLinecap="round" />
        </svg>,
      )
      let path = container.querySelector('#p')
      invariant(path instanceof SVGPathElement)

      // Update value
      root.render(
        <svg>
          <path id="p" strokeLinecap="square" />
        </svg>,
      )
      let updated = container.querySelector('#p')
      invariant(updated instanceof SVGPathElement)
      expect(updated).toBe(path)
      expect(updated.getAttribute('stroke-linecap')).toBe('square')

      // Remove attribute
      root.render(
        <svg>
          <path id="p" />
        </svg>,
      )
      let removed = container.querySelector('#p')
      invariant(removed instanceof SVGPathElement)
      expect(removed.hasAttribute('stroke-linecap')).toBe(false)
    })

    it('attaches events on SVG elements', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let clicked = false
      root.render(
        <svg>
          <circle
            id="c"
            on={{
              click: () => {
                clicked = true
              },
            }}
          />
        </svg>,
      )
      root.flush() // attach events

      let circle = container.querySelector('#c')
      invariant(circle instanceof SVGCircleElement)
      circle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(clicked).toBe(true)
    })

    it('hydrates existing SVG subtree and preserves nodes', () => {
      let container = document.createElement('div')
      container.innerHTML =
        '<svg viewBox="0 0 24 24"><path id="p" stroke-linecap="round"></path></svg>'

      let root = createRoot(container)
      let preSvg = container.querySelector('svg')
      let prePath = container.querySelector('#p')
      invariant(preSvg instanceof SVGSVGElement && prePath instanceof SVGPathElement)

      root.render(
        <svg viewBox="0 0 24 24">
          <path id="p" strokeLinecap="round" />
        </svg>,
      )

      let postSvg = container.querySelector('svg')
      let postPath = container.querySelector('#p')
      invariant(postSvg instanceof SVGSVGElement && postPath instanceof SVGPathElement)
      expect(postSvg).toBe(preSvg)
      expect(postPath).toBe(prePath)
      // Attribute should remain correct post-hydration
      expect(postPath.getAttribute('stroke-linecap')).toBe('round')
    })

    it('propagates SVG namespace through components', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      function SvgGroup() {
        return ({ href, children }: { href: string; children?: RemixNode }) => (
          <g href={href}>{children}</g>
        )
      }

      root.render(
        <svg width="100" height="100">
          <SvgGroup href="/test">
            <path id="p" />
          </SvgGroup>
        </svg>,
      )

      let svg = container.querySelector('svg')
      let group = container.querySelector('g')
      let path = container.querySelector('path')

      invariant(svg instanceof SVGSVGElement)
      invariant(group instanceof SVGGElement)
      invariant(path instanceof SVGPathElement)

      // All elements should have SVG namespace
      expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(group.namespaceURI).toBe('http://www.w3.org/2000/svg')
      expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg')
    })
  })

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

    it.skip('updates an element with attributes', () => {
      let container = document.createElement('div')
      let { render } = createRoot(container)
      render(<input id="hello" value="world" />)
      expect(container.innerHTML).toBe('<input id="hello" value="world">')

      let input = container.querySelector('input')
      render(<input id="hello" value="world 2" />)
      expect(container.innerHTML).toBe('<input id="hello" value="world 2">')
      expect(container.querySelector('input')).toBe(input)
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
      invariant(input instanceof HTMLInputElement)
      expect(input.value).toBe('world')
      expect(container.innerHTML).toBe('<input id="hello">')
      root.render(<input />)
      root.flush()
      expect(input.value).toBe('')
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

  describe('components', () => {
    it.todo('warns when render is called after component is removed')

    it('inserts a component', () => {
      let container = document.createElement('div')
      function App() {
        return () => <div>Hello, world!</div>
      }
      let { render } = createRoot(container)
      render(<App />)
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
    })

    it('updates a component', () => {
      let container = document.createElement('div')

      let capturedUpdate = () => {}
      function App(handle: Handle) {
        let count = 1
        capturedUpdate = () => {
          count++
          handle.update()
        }
        return () => <div>{count}</div>
      }

      let root = createRoot(container)
      root.render(<App />)
      expect(container.innerHTML).toBe('<div>1</div>')
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)

      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<div>2</div>')
      expect(container.querySelector('div')).toBe(div)

      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<div>3</div>')
      expect(container.querySelector('div')).toBe(div)
    })

    it('updates a component with a fragment', () => {
      let container = document.createElement('div')

      let capturedUpdate = () => {}
      function App(handle: Handle) {
        let count = 1
        capturedUpdate = () => {
          count++
          handle.update()
        }
        return () => (
          <>
            {Array.from({ length: count }).map((_, i) => (
              <span>{i}</span>
            ))}
          </>
        )
      }

      let root = createRoot(container)
      root.render(<App />)
      expect(container.innerHTML).toBe('<span>0</span>')
      let span = container.querySelector('span')
      invariant(span)

      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<span>0</span><span>1</span>')
      let newSpanTags = container.querySelectorAll('span')
      expect(newSpanTags.length).toBe(2)
      expect(newSpanTags[0]).toBe(span)

      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<span>0</span><span>1</span><span>2</span>')
    })
  })

  it('runs update tasks after updates', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let taskRan = false
    let capturedUpdate = () => {}
    function App(handle: Handle) {
      capturedUpdate = () => {
        handle.queueTask(() => {
          taskRan = true
        })
        handle.update()
      }

      return () => <div>Hello, world!</div>
    }

    root.render(<App />)
    root.flush()
    expect(taskRan).toBe(false)

    capturedUpdate()
    expect(taskRan).toBe(false)
    root.flush()
    expect(taskRan).toBe(true)
  })

  it('runs task provided to render', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let taskRan = false
    let capturedUpdate = () => {}
    function App(handle: Handle) {
      capturedUpdate = () => {
        handle.update(() => {
          taskRan = true
        })
      }

      return () => <div>Hello, world!</div>
    }

    root.render(<App />)
    root.flush()
    expect(taskRan).toBe(false)

    capturedUpdate()
    expect(taskRan).toBe(false)
    root.flush()
    expect(taskRan).toBe(true)
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

  describe('events integration', () => {
    it('attaches events', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let clicked = false
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

      expect(container.innerHTML).toBe('<button>Click me</button>')
      root.flush() // events attachment happens after rendering

      let button = container.querySelector('button')
      invariant(button)
      button.click()
      expect(clicked).toBe(true)
    })

    it('reuses the event container', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let clickCount = 0
      function App() {
        return () => (
          <button
            on={{
              click: () => {
                clickCount++
              },
            }}
          >
            Click me
          </button>
        )
      }

      root.render(<App />)
      root.flush()

      let button = container.querySelector('button')
      invariant(button)
      button.click()
      expect(clickCount).toBe(1)

      root.render(<App />)
      root.flush()

      button.click()
      expect(clickCount).toBe(2)
    })

    it('cleans up the event container', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let clickCount = 0
      root.render(
        <button
          on={{
            click: () => {
              clickCount++
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
      expect(clickCount).toBe(1)

      // remove on prop
      root.render(<button>Click me</button>)
      root.flush()

      button.click()
      expect(clickCount).toBe(1)
    })
  })

  describe('context', () => {
    it('provides and reads context', () => {
      let container = document.createElement('div')

      function App(handle: Handle<{ value: string }>) {
        handle.context.set({ value: 'test' })
        return ({ children }: { children: RemixNode }) => <div>{children}</div>
      }

      function Child(handle: Handle) {
        let { value } = handle.context.get(App)
        return () => <main>Child: {value}</main>
      }

      let root = createRoot(container)
      root.render(
        <App>
          <Child />
        </App>,
      )
      expect(container.innerHTML).toContain('Child: test')
    })

    it('provides context on updates', () => {
      let container = document.createElement('div')

      let capturedUpdate = () => {}
      function App(handle: Handle<{ value: string }>) {
        handle.context.set({ value: 'test' })
        capturedUpdate = () => {
          handle.context.set({ value: 'test2' })
          handle.update()
        }
        return ({ children }: { children: RemixNode }) => <div>{children}</div>
      }

      function Child(handle: Handle) {
        return () => {
          let { value } = handle.context.get(App)
          return <main>Child: {value}</main>
        }
      }

      let root = createRoot(container)
      root.render(
        <App>
          <Child />
        </App>,
      )
      expect(container.innerHTML).toContain('Child: test')

      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toContain('Child: test2')
    })

    it('renders descendants in order of appearance', () => {
      let container = document.createElement('div')

      let options: string[] = []
      let renderListbox = () => {}

      function Listbox(handle: Handle<{ registerOption: (option: string) => void }>) {
        handle.context.set({
          registerOption: (option: string) => {
            options.push(option)
          },
        })

        renderListbox = handle.update

        return ({ children }: { children: RemixNode }) => {
          options = []
          return <div>{children}</div>
        }
      }

      function Option(handle: Handle) {
        let { registerOption } = handle.context.get(Listbox)
        return ({ value }: { value: string }) => {
          registerOption(value)
          return <div>Option</div>
        }
      }

      function App(handle: Handle) {
        return () => (
          <Listbox>
            <Option value="Option 1" />
            <Option value="Option 2" />
            <Option value="Option 3" />
          </Listbox>
        )
      }

      let root = createRoot(container)

      root.render(<App />)
      expect(options).toEqual(['Option 1', 'Option 2', 'Option 3'])

      renderListbox()
      root.flush()
      expect(options).toEqual(['Option 1', 'Option 2', 'Option 3'])
    })
  })

  describe('scheduling', () => {
    it('skips descendant updates if ancestor is scheduled', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let capturedParentUpdate = () => {}
      let appRenderCount = 0
      function Parent(handle: Handle) {
        capturedParentUpdate = () => {
          handle.update()
        }
        return ({ children }: { children: RemixNode }) => {
          appRenderCount++
          return children
        }
      }

      let childRenderCount = 0
      let capturedChildUpdate = () => {}
      function Child(handle: Handle) {
        capturedChildUpdate = () => {
          handle.update()
        }
        return () => {
          childRenderCount++
          return <div>Hello, world!</div>
        }
      }

      root.render(
        <Parent>
          <Child />
        </Parent>,
      )
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      expect(appRenderCount).toBe(1)
      expect(childRenderCount).toBe(1)

      capturedChildUpdate()
      capturedParentUpdate()
      root.flush()

      expect(appRenderCount).toBe(2)
      expect(childRenderCount).toBe(2)

      // swap order
      capturedParentUpdate()
      capturedChildUpdate()
      root.flush()

      expect(appRenderCount).toBe(3)
      expect(childRenderCount).toBe(3)
    })

    it('only runs tasks once', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let taskCount = 0
      let capturedUpdate = () => {}
      function App(handle: Handle) {
        handle.queueTask(() => {
          taskCount++
        })

        capturedUpdate = () => {
          handle.update(() => {
            taskCount++
          })
        }
        return () => null
      }

      root.render(<App />)
      root.flush()
      expect(taskCount).toBe(1)

      capturedUpdate()
      root.flush()
      expect(taskCount).toBe(2)
    })
  })

  describe('signals', () => {
    it('provides mounted signal on handle.signal', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let capturedSignal: AbortSignal | undefined
      function App(handle: Handle) {
        capturedSignal = handle.signal
        return () => null
      }

      root.render(<App />)
      invariant(capturedSignal)
      expect(capturedSignal).toBeInstanceOf(AbortSignal)
      expect(capturedSignal.aborted).toBe(false)

      root.render(null)
      root.flush()
      expect(capturedSignal.aborted).toBe(true)
    })

    it('provides render signal to tasks and aborts on re-render', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let signals: AbortSignal[] = []
      function App(handle: Handle) {
        handle.queueTask((signal) => {
          signals.push(signal)
        })
        return () => null
      }

      root.render(<App />)
      root.flush()

      expect(signals.length).toBe(1)
      invariant(signals[0])
      expect(signals[0]).toBeInstanceOf(AbortSignal)
      expect(signals[0].aborted).toBe(false)

      root.render(<App />)
      root.flush()
      expect(signals.length).toBe(1)
      invariant(signals[0])
      expect(signals[0].aborted).toBe(true)
    })
  })

  describe('on', () => {
    it('adds event listeners to an event target', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let clickCount = 0

      function App(handle: Handle) {
        handle.on(document, {
          click: () => {
            clickCount++
          },
        })
        return () => <div>App</div>
      }

      root.render(<App />)
      root.flush()

      document.dispatchEvent(new MouseEvent('click'))
      expect(clickCount).toBe(1)

      document.dispatchEvent(new MouseEvent('click'))
      expect(clickCount).toBe(2)
    })

    it('removes event listeners when component is disconnected', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let clickCount = 0

      function App(handle: Handle) {
        handle.on(document, {
          click: (event) => {
            clickCount++
          },
        })
        return () => <div>App</div>
      }

      root.render(<App />)
      root.flush()

      document.dispatchEvent(new MouseEvent('click'))
      expect(clickCount).toBe(1)

      root.render(null)
      root.flush()

      document.dispatchEvent(new MouseEvent('click'))
      expect(clickCount).toBe(1)
    })

    describe('types', () => {
      it('provides literal event and target types to listeners', () => {
        function App(handle: Handle) {
          handle.on(document, {
            keydown: (event) => {
              type test = Assert<Equal<typeof event, Dispatched<KeyboardEvent, Document>>>
            },
          })
          return () => <div>App</div>
        }
      })
    })
  })

  describe('connect', () => {
    it('connects host node lifecycle to component scope', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let capturedNode: Element | null = null

      function App(handle: Handle) {
        return () => (
          <div
            connect={(node: Element, signal: AbortSignal) => {
              capturedNode = node
              signal.addEventListener('abort', () => {
                capturedNode = null
              })
            }}
          >
            Hello, world!
          </div>
        )
      }

      root.render(<App />)
      root.flush()
      expect(capturedNode).toBeInstanceOf(HTMLDivElement)

      root.render(null)
      root.flush()
      expect(capturedNode).toBe(null)
    })
  })

  it('calls connect only once', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let capturedUpdate = () => {}
    let connectCalls = 0

    function App(handle: Handle) {
      capturedUpdate = () => handle.update()
      return () => (
        <div
          connect={() => {
            connectCalls++
          }}
        >
          Hello, world!
        </div>
      )
    }
    root.render(<App />)
    root.flush()
    expect(connectCalls).toBe(1)

    capturedUpdate()
    root.flush()
    expect(connectCalls).toBe(1)
  })

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
  })
})
