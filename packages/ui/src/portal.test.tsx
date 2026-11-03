import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import {
  createRoot,
  Frame,
  on,
  type FrameHandle,
  type Handle,
  type RemixNode,
  type VirtualRootOptions,
} from '@remix-run/component'
import { renderToString } from '@remix-run/component/server'
import { Portal } from './portal.tsx'

let roots: ReturnType<typeof createRoot>[] = []

function render(node: RemixNode, options?: VirtualRootOptions) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container, options)
  roots.push(root)
  root.render(node)
  root.flush()
  return { container, root }
}

function get<element extends HTMLElement>(selector: string) {
  let node = document.querySelector<element>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

function Provider(handle: Handle<{ children?: RemixNode; value: string }, { value: string }>) {
  return () => {
    handle.context.set({ value: handle.props.value })
    return handle.props.children
  }
}

function StatefulChild(handle: Handle<{ label?: string; onDispose?(): void }>) {
  let count = 0
  handle.signal.addEventListener('abort', () => handle.props.onDispose?.())
  return () => (
    <button
      id="portal-child"
      mix={on('click', () => {
        count++
        void handle.update()
      })}
    >
      {handle.props.label ?? handle.context.get(Provider)?.value}:{count}
    </button>
  )
}

afterEach(() => {
  for (let root of roots) root.dispose()
  roots = []
  document.body.innerHTML = ''
})

describe('Portal', () => {
  it('renders outside the authored ancestors without adding a stacking context', () => {
    let { container } = render(
      <div style={{ overflow: 'hidden', transform: 'translateX(10px)' }}>
        <Portal>
          <button id="portal-child">Action</button>
        </Portal>
      </div>,
    )
    let child = get('#portal-child')
    expect(container.contains(child)).toBe(false)
    expect(child.isConnected).toBe(true)
    expect(child.closest('[hidden]')).toBe(null)
    let host = child.parentElement
    if (!host) throw new Error('Missing portal host')
    expect(host.parentElement).toBe(document.body)
    expect(getComputedStyle(host).display).toBe('contents')
    expect(getComputedStyle(host).zIndex).toBe('auto')
  })

  it('updates inherited context and props while preserving child state and DOM', async () => {
    let disposeCount = 0
    let { root } = render(
      <Provider value="first">
        <Portal>
          <StatefulChild onDispose={() => disposeCount++} />
        </Portal>
      </Provider>,
    )
    let child = get<HTMLButtonElement>('#portal-child')
    expect(child.textContent).toBe('first:0')
    child.click()
    await Promise.resolve()
    expect(child.textContent).toBe('first:1')

    root.render(
      <Provider value="second">
        <Portal>
          <StatefulChild onDispose={() => disposeCount++} />
        </Portal>
      </Provider>,
    )
    root.flush()
    expect(get('#portal-child')).toBe(child)
    expect(child.textContent).toBe('second:1')

    root.render(
      <Provider value="third">
        <Portal>
          <StatefulChild label="prop" onDispose={() => disposeCount++} />
        </Portal>
      </Provider>,
    )
    root.flush()
    expect(child.textContent).toBe('prop:1')
    expect(disposeCount).toBe(0)
    root.dispose()
    expect(child.isConnected).toBe(false)
    expect(disposeCount).toBe(1)
  })

  it('preserves state when its container changes and leaves unrelated content intact', async () => {
    let first = document.createElement('aside')
    let second = document.createElement('aside')
    first.textContent = 'First container'
    second.textContent = 'Second container'
    document.body.append(first, second)
    let { root } = render(
      <Portal container={first}>
        <StatefulChild label="state" />
      </Portal>,
    )
    let child = get<HTMLButtonElement>('#portal-child')
    expect(first.contains(child)).toBe(true)
    child.click()
    await Promise.resolve()
    root.render(
      <Portal container={second}>
        <StatefulChild label="state" />
      </Portal>,
    )
    root.flush()
    expect(get('#portal-child')).toBe(child)
    expect(child.textContent).toBe('state:1')
    expect(first.textContent).toBe('First container')
    expect(second.contains(child)).toBe(true)
    root.render(null)
    root.flush()
    expect(second.textContent).toBe('Second container')
  })

  it('rejects another document as the destination without disturbing mounted content', (t) => {
    t.mock.method(console, 'error', () => {})
    let { root } = render(
      <Portal>
        <StatefulChild label="state" />
      </Portal>,
    )
    let child = get('#portal-child')
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    root.render(
      <Portal container={document.implementation.createHTMLDocument().body}>
        <StatefulChild label="state" />
      </Portal>,
    )
    root.flush()
    expect(errors.length).toBe(1)
    expect(errors[0] instanceof Error && errors[0].message).toBe(
      'Portal container must belong to the same document as its marker',
    )
    expect(get('#portal-child')).toBe(child)
  })

  it('disposes nested portals and aborts their descendants when the owner unmounts', () => {
    let disposeCount = 0
    let { container, root } = render(
      <Portal>
        <div id="outer">
          <Portal>
            <StatefulChild onDispose={() => disposeCount++} />
          </Portal>
        </div>
      </Portal>,
    )
    expect(document.querySelector('#outer')).not.toBe(null)
    expect(document.querySelector('#portal-child')).not.toBe(null)
    root.render(null)
    root.flush()
    expect(document.querySelector('#outer')).toBe(null)
    expect(document.querySelector('#portal-child')).toBe(null)
    expect(document.body.children.length).toBe(1)
    expect(document.body.firstElementChild).toBe(container)
    expect(disposeCount).toBe(1)
  })

  it('emits only an inert marker on the server and mounts children during hydration', async () => {
    let element = (
      <Portal>
        <button id="portal-child">Client content</button>
      </Portal>
    )
    let html = await renderToString(element)
    expect(html.includes('Client content')).toBe(false)
    expect(html.includes('<template')).toBe(true)
    let container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)
    let root = createRoot(container)
    roots.push(root)
    root.render(element)
    root.flush()
    expect(get('#portal-child').textContent).toBe('Client content')
    expect(document.querySelectorAll('#portal-child').length).toBe(1)
    expect(container.contains(get('#portal-child'))).toBe(false)
  })

  it('forwards render errors to the owning root once', (t) => {
    t.mock.method(console, 'error', () => {})
    let failure = new Error('Portal child failed')
    let errors: unknown[] = []
    function Broken() {
      return () => {
        throw failure
      }
    }
    let { root } = render(null)
    root.addEventListener('error', (event) => errors.push(event.error))
    root.render(
      <Portal>
        <Broken />
      </Portal>,
    )
    root.flush()
    expect(errors).toEqual([failure])
  })

  it('forwards errors from later child updates without rerendering the parent', async (t) => {
    t.mock.method(console, 'error', () => {})
    let failure = new Error('Portal update failed')
    let errors: unknown[] = []
    let ownerRenders = 0
    function Child(handle: Handle) {
      let broken = false
      return () => {
        if (broken) throw failure
        return (
          <button
            id="break-child"
            mix={on('click', () => {
              broken = true
              void handle.update()
            })}
          >
            Break child
          </button>
        )
      }
    }
    function Owner() {
      return () => {
        ownerRenders++
        return (
          <Portal>
            <Portal>
              <Child />
            </Portal>
          </Portal>
        )
      }
    }
    let { root } = render(<Owner />)
    root.addEventListener('error', (event) => errors.push(event.error))
    get<HTMLButtonElement>('#break-child').click()
    await Promise.resolve()
    expect(errors).toEqual([failure])
    expect(ownerRenders).toBe(1)
  })

  it('aborts pending child updates when the owner is removed', async () => {
    let update = () => Promise.resolve(AbortSignal.abort())
    function Child(handle: Handle) {
      update = () => handle.update()
      return () => <span id="portal-child">Child</span>
    }
    let { root } = render(
      <Portal>
        <Child />
      </Portal>,
    )
    let pending = update()
    root.dispose()
    expect((await pending).aborted).toBe(true)
    expect(document.querySelector('#portal-child')).toBe(null)
    expect((await update()).aborted).toBe(true)
  })

  it('shares the owning frame and supports child frames', async () => {
    let ownerFrame: FrameHandle | undefined
    let portalFrame: FrameHandle | undefined
    let loaded: string[] = []
    function Child(handle: Handle) {
      portalFrame = handle.frame
      return () => <Frame name="portal-frame" src="/details" />
    }
    function App(handle: Handle) {
      ownerFrame = handle.frame
      return () => (
        <Portal>
          <Child />
        </Portal>
      )
    }
    let { root } = render(<App />, {
      frameInit: {
        src: '/owner',
        resolveFrame(src) {
          loaded.push(src)
          return '<p id="frame-content">Frame content</p>'
        },
      },
    })
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    root.flush()
    expect(portalFrame).toBe(ownerFrame)
    expect(portalFrame?.src).toBe('/owner')
    expect(loaded).toEqual(['/details'])
    expect(get('#frame-content').textContent).toBe('Frame content')
  })
})
