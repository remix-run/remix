import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'
import {
  createMixin,
  createRoot,
  createRangeRoot,
  css,
  Frame,
  Fragment,
  on,
  Portal,
  ref,
  run,
  clientEntry,
  type FrameHandle,
  type Handle,
  type RemixNode,
  unsafeHTML,
} from '../index.ts'
import { render } from '../runtime/render.ts'
import { renderToStream, renderToString } from '../server/stream.ts'
import type { RunInit } from '../runtime/run.ts'
import { invariant } from '../runtime/invariant.ts'
import { jsx } from '../jsx-runtime.ts'
import { drain } from './utils.ts'

describe('Portal', () => {
  it('renders nothing on the server without evaluating portal children', async () => {
    function Child(): () => RemixNode {
      throw new Error('Portal children should not render on the server')
    }
    expect(
      await renderToString(
        <Portal>
          <Child />
        </Portal>,
      ),
    ).toBe('')
    expect(
      await renderToString(
        <section>
          Before<Portal>Hidden</Portal>After
        </section>,
      ),
    ).toBe('<section>BeforeAfter</section>')
  })

  it('renders no portal content during a client entry server render', async () => {
    let Entry = clientEntry('/portal.js#Entry', function Entry() {
      return () => <Portal>Hidden content</Portal>
    })
    let html = await renderToString(<Entry />)
    expect(html).toContain('<!-- rmx:h:')
    expect(html).not.toContain('Hidden content')
    expect(html).not.toContain('rmx:portal')
  })

  it('preserves portals in nested client-entry props without rendering them on the server', async (t) => {
    let Entry = clientEntry(
      '/portal.js#Entry',
      function Entry(
        handle: Handle<{
          content: { nested: RemixNode[] }
          data: { $rmxPortal: boolean; props: { children: string } }
        }>,
      ) {
        return () => (
          <section>
            <i>Before</i>
            {handle.props.content.nested}
            <b>After</b>
            <output>{JSON.stringify(handle.props.data)}</output>
          </section>
        )
      },
    )
    let data = { $rmxPortal: true, props: { children: 'Ordinary data' } }
    let source = document.createElement('div')
    source.innerHTML = await renderToString(
      <Entry
        content={{
          nested: [
            <Portal key="first">
              <p id="serialized-portal">Content</p>
            </Portal>,
          ],
        }}
        data={data}
      />,
    )
    expect(source.querySelector('#serialized-portal')).toBeNull()
    expect(source.innerHTML).toContain('$rmxPortal')
    let following = source.querySelector('b')
    document.body.append(source)
    let app = run({ loadModule: () => Entry })
    t.after(() => {
      app.dispose()
      source.remove()
    })
    await app.ready()
    expect(source.querySelector('b')).toBe(following)
    expect(source.querySelector('output')?.textContent).toBe(JSON.stringify(data))
    expect(document.body.querySelector('#serialized-portal')?.parentElement).toBe(document.body)
    app.dispose()
    expect(document.body.querySelector('#serialized-portal')).toBeNull()
  })

  it('rejects element destinations in serialised portal props', async () => {
    let Entry = clientEntry(
      '/portal.js#Entry',
      function Entry(handle: Handle<{ children?: RemixNode }>) {
        return () => handle.props.children
      },
    )
    await expect(
      renderToString(
        <Entry>
          <Portal container={document.createElement('div')}>Content</Portal>
        </Entry>,
      ),
    ).rejects.toThrow('Portals with custom containers cannot be serialized.')
  })

  it('rejects null destinations in serialised portal props', async () => {
    let Entry = clientEntry(
      '/portal.js#Entry',
      function Entry(handle: Handle<{ children?: RemixNode }>) {
        return () => handle.props.children
      },
    )
    await expect(
      renderToString(<Entry>{jsx(Portal, { container: null, children: 'Content' })}</Entry>),
    ).rejects.toThrow('Portals with custom containers cannot be serialized.')
  })

  it('leaves no source DOM for empty, populated or nested portals', (t) => {
    let first = document.createElement('div')
    let second = document.createElement('div')
    let { root, container, cleanup } = render(
      <Portal container={first}>
        <Portal container={second}>
          <b>Nested</b>
        </Portal>
      </Portal>,
    )
    t.after(cleanup)
    expect(container.childNodes.length).toBe(0)
    expect(first.childNodes.length).toBe(2)
    expect(second.textContent).toBe('Nested')
    root.render(<Portal container={first}>Content</Portal>)
    expect(container.childNodes.length).toBe(0)
    expect(first.textContent).toBe('Content')
    expect(second.childNodes.length).toBe(0)
    root.render(<Portal container={first} />)
    expect(container.childNodes.length).toBe(0)
    expect(first.childNodes.length).toBe(2)
    cleanup()
    expect(first.childNodes.length).toBe(0)
  })

  it('replaces portal-only component output independently between source siblings', async (t) => {
    let destination = document.createElement('div')
    let mode = 'portal'
    let update = async (_mode: string) => {}
    function Content(handle: Handle) {
      update = async (next) => {
        mode = next
        await handle.update()
      }
      return () => {
        if (mode === 'portal')
          return (
            <Portal container={destination}>
              <input />
            </Portal>
          )
        if (mode === 'host') return <strong>Inline</strong>
        if (mode === 'fragment')
          return (
            <>
              <b>One</b>
              <i>Two</i>
            </>
          )
        return null
      }
    }
    let { container, cleanup } = render(
      <section>
        <span>Before</span>
        <Content />
        <u>After</u>
      </section>,
    )
    t.after(cleanup)
    let section = container.querySelector('section')
    let before = container.querySelector('span')
    let after = container.querySelector('u')
    invariant(section)
    expect(section.childNodes.length).toBe(2)
    for (let next of ['host', 'portal', 'fragment', 'empty', 'portal', 'host']) {
      await update(next)
      expect(section.firstChild).toBe(before)
      expect(section.lastChild).toBe(after)
      expect(section.textContent).toBe(
        next === 'host'
          ? 'BeforeInlineAfter'
          : next === 'fragment'
            ? 'BeforeOneTwoAfter'
            : 'BeforeAfter',
      )
      expect(destination.querySelectorAll('input').length).toBe(next === 'portal' ? 1 : 0)
    }
  })

  it('keeps source order when keyed portal-only components reorder and gain DOM', async (t) => {
    let destination = document.createElement('div')
    let updates = new Map<string, () => Promise<void>>()
    let signals = new Map<string, AbortSignal>()
    function Item(handle: Handle<{ name: string; inline: boolean }>) {
      signals.set(handle.props.name, handle.signal)
      updates.set(handle.props.name, async () => {
        await handle.update()
      })
      return () =>
        handle.props.inline ? (
          <span>{handle.props.name}</span>
        ) : (
          <Portal container={destination}>
            <input aria-label={handle.props.name} />
          </Portal>
        )
    }
    let tree = (order: string[], inline: string[]) => (
      <section>
        <b key="before">Before</b>
        {order.map((name) => (
          <Item key={name} name={name} inline={inline.includes(name)} />
        ))}
        <u key="after">After</u>
      </section>
    )
    let { root, container, cleanup } = render(tree(['a', 'b', 'c'], []))
    t.after(cleanup)
    let initialSignals = new Map(signals)
    let before = container.querySelector('b')
    let after = container.querySelector('u')
    for (let order of [
      ['c', 'a', 'b'],
      ['b', 'c', 'a'],
      ['a', 'c', 'b'],
      ['b', 'a', 'c'],
    ]) {
      for (let inline of [[], ['a'], ['a', 'b', 'c'], ['c'], []]) {
        root.render(tree(order, inline))
        for (let name of order) await updates.get(name)?.()
        expect(container.textContent).toBe(
          'Before' + order.filter((name) => inline.includes(name)).join('') + 'After',
        )
        expect(container.querySelector('section')?.childNodes.length).toBe(inline.length + 2)
        expect(destination.querySelectorAll('input').length).toBe(3 - inline.length)
        expect(container.querySelector('b')).toBe(before)
        expect(container.querySelector('u')).toBe(after)
        for (let name of order) {
          expect(signals.get(name)).toBe(initialSignals.get(name))
          expect(signals.get(name)?.aborted).toBe(false)
        }
      }
    }
    root.render(tree(['c'], []))
    expect(initialSignals.get('a')?.aborted).toBe(true)
    expect(initialSignals.get('b')?.aborted).toBe(true)
    expect(initialSignals.get('c')?.aborted).toBe(false)
    expect(destination.querySelectorAll('input').length).toBe(1)
  })

  it('bounds portal-only child replacements by the enclosing destination range', async (t) => {
    let destination = document.createElement('div')
    let nestedDestination = document.createElement('div')
    let inline = false
    let update = async () => {}
    function Content(handle: Handle) {
      update = async () => {
        inline = !inline
        await handle.update()
      }
      return () =>
        inline ? (
          <>
            <b>Inline</b>
            <i>Tail</i>
          </>
        ) : (
          <Portal container={nestedDestination}>Nested</Portal>
        )
    }
    let { container, cleanup } = render(
      <>
        <Portal container={destination}>
          <Content />
        </Portal>
        <Portal container={destination}>
          <u>Neighbour</u>
        </Portal>
      </>,
    )
    t.after(cleanup)
    let neighbour = destination.querySelector('u')
    for (let i = 0; i < 4; i++) {
      await update()
      expect(container.childNodes.length).toBe(0)
      expect(destination.textContent).toBe(inline ? 'InlineTailNeighbour' : 'Neighbour')
      expect(nestedDestination.textContent).toBe(inline ? '' : 'Nested')
      expect(destination.querySelector('u')).toBe(neighbour)
    }
    cleanup()
    expect(destination.childNodes.length).toBe(0)
    expect(nestedDestination.childNodes.length).toBe(0)
  })

  it('keeps inline and portaled content separate when source and destination are the same element', (t) => {
    let source = document.createElement('div')
    source.innerHTML = '<b>Before</b><u>After</u>'
    let before = source.firstChild
    let after = source.lastChild
    let root = createRoot(source)
    t.after(() => root.dispose())
    let tree = (inline: boolean) => (
      <>
        <b>Before</b>
        {inline ? (
          <i>Inline</i>
        ) : (
          <Portal container={source}>
            <input />
          </Portal>
        )}
        <u>After</u>
      </>
    )
    root.render(tree(false))
    expect(source.firstChild).toBe(before)
    expect(source.querySelector('u')).toBe(after)
    let input = source.querySelector('input')
    invariant(input)
    input.value = 'Keep'
    root.render(tree(false))
    expect(source.querySelector('input')).toBe(input)
    expect(input.value).toBe('Keep')
    root.render(tree(true))
    expect(source.innerHTML).toBe('<b>Before</b><i>Inline</i><u>After</u>')
    root.render(tree(false))
    expect(source.firstChild).toBe(before)
    expect(source.querySelector('u')).toBe(after)
    expect(source.querySelectorAll('input').length).toBe(1)
    root.render(null)
    expect(source.childNodes.length).toBe(0)
  })

  it('does not move destination content when a keyed source fragment moves in the same container', (t) => {
    let source = document.createElement('div')
    document.body.append(source)
    let tree = (reverse: boolean) => {
      let group = (
        <Fragment key="group">
          <b>Start</b>
          <Portal container={source}>
            <input defaultValue="Draft" />
          </Portal>
          <i>End</i>
        </Fragment>
      )
      let sibling = <u key="sibling">Sibling</u>
      return <>{reverse ? [sibling, group] : [group, sibling]}</>
    }
    let { root, cleanup } = render(tree(false), { container: source })
    t.after(cleanup)
    let input = source.querySelector('input')
    invariant(input)
    input.focus()
    let removed: Node[] = []
    let observer = new MutationObserver(() => {})
    observer.observe(source, { childList: true })
    t.after(() => observer.disconnect())
    root.render(tree(true))
    root.render(tree(false))
    removed.push(...observer.takeRecords().flatMap((record) => Array.from(record.removedNodes)))
    expect(source.querySelector('input')).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(removed.includes(input)).toBe(false)
    expect(source.textContent).toBe('StartEndSibling')
  })

  it('hydrates merged source text around a portal and respects a range end during replacement', async (t) => {
    let destination = document.createElement('div')
    let source = document.createElement('div')
    source.innerHTML = 'Outside<!--start-->BeforeAfter<!--end--><u>Outside sibling</u>'
    let start = source.childNodes[1]
    let end = source.childNodes[3]
    invariant(start && end)
    let following = source.lastChild
    let root = createRangeRoot([start, end])
    t.after(() => root.dispose())
    root.render(
      <>
        Before<Portal container={destination}>Elsewhere</Portal>After
      </>,
    )
    expect(source.textContent).toBe('OutsideBeforeAfterOutside sibling')
    expect(source.childNodes.length).toBe(6)
    expect(destination.textContent).toBe('Elsewhere')
    root.render(<Portal container={destination}>Only portal</Portal>)
    expect(start.nextSibling).toBe(end)
    root.render(<b>Inline</b>)
    expect(start.nextSibling?.textContent).toBe('Inline')
    expect(start.nextSibling?.nextSibling).toBe(end)
    root.render(<Portal container={destination}>Again</Portal>)
    expect(start.nextSibling).toBe(end)
    root.dispose()
    expect(source.lastChild).toBe(following)
    expect(source.innerHTML).toBe('Outside<!--start--><!--end--><u>Outside sibling</u>')
    expect(destination.childNodes.length).toBe(0)
  })

  it('does not consume an adjacent client-entry boundary when mounting during hydration', async (t) => {
    let destination = document.createElement('div')
    let mounts = 0
    let clicks = 0
    let Inner = clientEntry('/inner.js#Inner', function Inner(handle: Handle) {
      handle.queueTask(() => {
        mounts++
      })
      return () => (
        <button
          mix={on('click', () => {
            clicks++
          })}
        >
          Inner
        </button>
      )
    })
    let Outer = clientEntry('/outer.js#Outer', function Outer() {
      return () => (
        <section>
          <Portal container={destination}>Portaled</Portal>
          <Inner />
        </section>
      )
    })
    let source = document.createElement('div')
    source.innerHTML = await renderToString(<Outer />)
    let button = source.querySelector('button')
    invariant(button)
    document.body.append(source)
    let app = run({ loadModule: (_url, name) => (name === 'Outer' ? Outer : Inner) })
    t.after(() => {
      app.dispose()
      source.remove()
    })
    await app.ready()
    expect(source.querySelectorAll('button').length).toBe(1)
    expect(source.querySelector('button')).toBe(button)
    expect(mounts).toBe(1)
    button.click()
    expect(clicks).toBe(1)
    expect(destination.textContent).toBe('Portaled')
  })

  it('does not affect source element selectors', (t) => {
    let destination = document.createElement('div')
    let { container, root, cleanup } = render(
      <section>
        <Portal container={destination}>Portaled</Portal>
        <button>First</button>
        <Portal container={destination} />
        <p>Second</p>
        <Portal container={destination} />
      </section>,
    )
    t.after(cleanup)
    let section = container.querySelector('section')
    invariant(section)
    expect(section.children.length).toBe(2)
    expect(section.querySelector(':scope > :first-child')?.textContent).toBe('First')
    expect(section.querySelector(':scope > :nth-child(2)')?.textContent).toBe('Second')
    expect(section.querySelector(':scope > :last-child')?.textContent).toBe('Second')
    expect(destination.textContent).toBe('Portaled')
    root.render(
      <section>
        <Portal container={destination}>Elsewhere</Portal>
      </section>,
    )
    expect(section.matches(':empty')).toBe(true)
    expect(destination.textContent).toBe('Elsewhere')
  })

  it('renders into the document body without a wrapper and cleans up on disposal', (t) => {
    let { container, cleanup } = render(
      <section>
        Before
        <Portal>
          <p data-portal-test="body">Outside</p>
        </Portal>
        After
      </section>,
    )
    t.after(cleanup)
    let content = document.querySelector('[data-portal-test="body"]')
    expect(content?.parentNode).toBe(document.body)
    expect(container.textContent).toBe('BeforeAfter')
    cleanup()
    expect(content?.isConnected).toBe(false)
  })

  it('shares a destination with other portals and existing DOM without claiming it', (t) => {
    let destination = document.createElement('div')
    destination.innerHTML = '<p>Existing</p>'
    let existing = destination.firstChild
    let { root, cleanup } = render(
      <>
        <Portal container={destination}>
          <b>First</b>
        </Portal>
        <Portal container={destination}>
          <i>Second</i>
        </Portal>
      </>,
    )
    t.after(cleanup)
    expect(destination.textContent).toBe('ExistingFirstSecond')
    root.render(<Portal container={destination} />)
    expect(destination.textContent).toBe('Existing')
    expect(destination.firstChild).toBe(existing)
    cleanup()
    expect(destination.innerHTML).toBe('<p>Existing</p>')
  })

  it('preserves component and mixin context, frames, and commit ordering', async (t) => {
    let destination = document.createElement('div')
    let frame: FrameHandle | undefined
    let seenFrame: FrameHandle | undefined
    let mixinFrame: FrameHandle | undefined
    let taskContent = ''
    let mixinContext = ''
    let update = async () => {}
    function Provider(handle: Handle<{ children?: RemixNode }, string>) {
      frame = handle.frame
      handle.context.set('Initial')
      update = async () => {
        handle.context.set('Updated')
        await handle.update()
      }
      handle.queueTask(() => {
        taskContent = destination.textContent ?? ''
      })
      return () => handle.props.children
    }
    let readContext = createMixin((handle) => {
      mixinFrame = handle.frame
      return () => {
        mixinContext = handle.context.get(Provider)
        return handle.element
      }
    })
    function Child(handle: Handle) {
      seenFrame = handle.frame
      return () => <p mix={readContext()}>{handle.context.get(Provider)}</p>
    }
    let { cleanup } = render(
      <Provider>
        <Portal container={destination}>
          <Child />
        </Portal>
      </Provider>,
    )
    t.after(cleanup)
    expect(taskContent).toBe('Initial')
    expect(seenFrame).toBe(frame)
    expect(mixinFrame).toBe(frame)
    expect(mixinContext).toBe('Initial')
    await update()
    expect(destination.textContent).toBe('Updated')
    expect(mixinContext).toBe('Updated')
  })

  it('retains children in the same destination and remounts them when the destination changes', async (t) => {
    let first = document.createElement('div')
    let second = document.createElement('div')
    let setups = 0
    let signal: AbortSignal | undefined
    let refSignal: AbortSignal | undefined
    function Counter(handle: Handle) {
      setups++
      signal = handle.signal
      let count = 0
      return () => (
        <>
          <input
            defaultValue="Draft"
            mix={ref((_node, signal) => {
              refSignal = signal
            })}
          />
          <button
            mix={on('click', () => {
              count++
              handle.update()
            })}
          >
            {count}
          </button>
        </>
      )
    }
    let { root, act, cleanup } = render(
      <Portal container={first}>
        <Counter />
      </Portal>,
    )
    t.after(cleanup)
    let button = first.querySelector('button')
    let input = first.querySelector('input')
    invariant(input && button)
    input.value = 'Edited'
    await act(() => button.click())
    let firstSignal = signal
    let firstRefSignal = refSignal
    root.render(
      <Portal container={first}>
        <Counter />
      </Portal>,
    )
    expect(first.querySelector('input')).toBe(input)
    expect(input.value).toBe('Edited')
    expect(button.textContent).toBe('1')
    expect(setups).toBe(1)
    expect(firstSignal?.aborted).toBe(false)
    root.render(
      <Portal container={second}>
        <Counter />
      </Portal>,
    )
    expect(first.childNodes.length).toBe(0)
    let nextButton = second.querySelector('button')
    let nextInput = second.querySelector('input')
    invariant(nextButton && nextInput)
    expect(nextButton).not.toBe(button)
    expect(nextInput).not.toBe(input)
    expect(nextButton.textContent).toBe('0')
    expect(nextInput.value).toBe('Draft')
    expect(setups).toBe(2)
    expect(firstSignal?.aborted).toBe(true)
    expect(firstRefSignal?.aborted).toBe(true)
    expect(signal?.aborted).toBe(false)
    expect(refSignal?.aborted).toBe(false)
    await act(() => nextButton.click())
    expect(nextButton.textContent).toBe('1')
    cleanup()
    expect(signal?.aborted).toBe(true)
    expect(refSignal?.aborted).toBe(true)
    expect(second.childNodes.length).toBe(0)
  })

  it('bounds independent fragment updates by the portal destination range', async (t) => {
    let first = document.createElement('div')
    let second = document.createElement('div')
    let update = async (_expanded: boolean) => {}
    let expanded = false
    function Children(handle: Handle) {
      update = async (value) => {
        expanded = value
        await handle.update()
      }
      return () => (
        <>
          <b>Start</b>
          {expanded && <i>End</i>}
        </>
      )
    }
    let { root, cleanup } = render(
      <>
        <Portal container={first}>
          <Children />
        </Portal>
        <Portal container={second}>
          <u>Other portal</u>
        </Portal>
        <p>Source sibling</p>
      </>,
    )
    t.after(cleanup)
    // A queued update on the old subtree must not affect its replacement.
    let updated = update(true)
    root.render(
      <>
        <Portal container={second}>
          <Children />
        </Portal>
        <Portal container={second}>
          <u>Other portal</u>
        </Portal>
        <p>Source sibling</p>
      </>,
    )
    await updated
    expect(first.textContent).toBe('')
    expect(second.textContent).toBe('Other portalStartEnd')
    await update(false)
    expect(second.textContent).toBe('Other portalStart')
  })

  it('treats omitted, undefined, and explicit body destinations as the same destination', (t) => {
    let setups = 0
    function Child() {
      setups++
      return () => <input data-portal-test="default-body" defaultValue="Initial" />
    }
    let { root, cleanup } = render(
      <Portal>
        <Child />
      </Portal>,
    )
    t.after(cleanup)
    let input = document.querySelector<HTMLInputElement>('[data-portal-test="default-body"]')
    invariant(input)
    input.value = 'Edited'
    root.render(
      <Portal container={undefined}>
        <Child />
      </Portal>,
    )
    root.render(
      <Portal container={document.body}>
        <Child />
      </Portal>,
    )
    root.render(
      <Portal>
        <Child />
      </Portal>,
    )
    expect(document.querySelector('[data-portal-test="default-body"]')).toBe(input)
    expect(input.value).toBe('Edited')
    expect(setups).toBe(1)
  })

  it('renders into a custom destination when the root and destination are inside an iframe', (t) => {
    let frame = document.createElement('iframe')
    document.body.append(frame)
    t.after(() => frame.remove())
    let doc = frame.contentDocument
    invariant(doc)
    let source = doc.createElement('div')
    let destination = doc.createElement('section')
    doc.body.append(source, destination)
    let root = createRoot(source)
    t.after(() => root.dispose())

    root.render(
      <Portal container={destination}>
        <b>Content</b>
      </Portal>,
    )
    expect(source.childNodes.length).toBe(0)
    expect(destination.querySelector('b')?.textContent).toBe('Content')
    root.render(<Portal container={destination}>Updated</Portal>)
    expect(destination.textContent).toBe('Updated')
    root.dispose()
    expect(destination.childNodes.length).toBe(0)
  })

  it('rejects an SVG element as a container', (t) => {
    let destination = document.createElement('div')
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    let { root, cleanup } = render(<Portal container={destination}>Content</Portal>)
    t.after(cleanup)
    expect(() => root.render(jsx(Portal, { container: svg, children: 'Changed' }))).toThrow(
      'Portal container must be an HTMLElement',
    )
    expect(destination.textContent).toBe('Content')
  })

  it('rejects a null destination without removing existing portal content', (t) => {
    let destination = document.createElement('div')
    let { root, cleanup } = render(<Portal container={destination}>Content</Portal>)
    t.after(cleanup)
    expect(() => root.render(jsx(Portal, { container: null, children: 'Changed' }))).toThrow(
      'Portal container must be an HTMLElement',
    )
    expect(destination.textContent).toBe('Content')
  })

  it('mounts in the new destination before queued work and ref callbacks run', (t) => {
    let first = document.createElement('div')
    let second = document.createElement('div')
    let events: string[] = []
    function Child(handle: Handle) {
      let element: Element | undefined
      handle.queueTask(() => {
        events.push(element?.parentNode === first ? 'first task' : 'second task')
      })
      handle.signal.addEventListener('abort', () => events.push('dispose'))
      return () => (
        <input
          mix={ref((node) => {
            element = node
            events.push(node.parentNode === first ? 'first ref' : 'second ref')
          })}
        />
      )
    }
    let { root, cleanup } = render(
      <Portal container={first}>
        <Child />
      </Portal>,
    )
    t.after(cleanup)
    root.render(
      <Portal container={second}>
        <Child />
      </Portal>,
    )
    expect(events).toEqual(['first ref', 'first task', 'dispose', 'second ref', 'second task'])
  })

  it('does not reclaim exiting children when switching destinations and returning', async (t) => {
    let first = document.createElement('div')
    let second = document.createElement('div')
    let finish = Promise.withResolvers<void>()
    let removed = Promise.withResolvers<void>()
    t.after(() => finish.resolve())
    let exit = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => finish.promise))
      handle.addEventListener('remove', () => removed.resolve())
      return () => handle.element
    })
    let view = (container: HTMLElement) => (
      <Portal container={container}>
        <input key="draft" defaultValue="Initial" mix={exit()} />
      </Portal>
    )
    let { root, cleanup } = render(view(first))
    t.after(cleanup)
    let initial = first.querySelector('input')
    invariant(initial)
    initial.value = 'Edited'
    root.render(view(second))
    let middle = second.querySelector('input')
    invariant(middle)
    expect(initial.parentNode).toBe(first)
    expect(middle).not.toBe(initial)
    root.render(view(first))
    let returned = first.querySelectorAll('input')[1]
    invariant(returned)
    expect(returned).not.toBe(initial)
    expect(returned.value).toBe('Initial')
    finish.resolve()
    await removed.promise
    expect(first.querySelectorAll('input').length).toBe(1)
    expect(first.querySelector('input')).toBe(returned)
    expect(second.childNodes.length).toBe(0)
  })

  it('recovers after a replacement subtree throws, including when returning to the original destination', (t) => {
    let first = document.createElement('div')
    let second = document.createElement('div')
    let fail = false
    function Child() {
      if (fail) throw new Error('Replacement failed')
      return () => <input defaultValue="Recovered" />
    }
    let { root, container, cleanup } = render(
      <>
        <b>Before</b>
        <Portal container={first}>
          <Child />
        </Portal>
        <i>After</i>
      </>,
    )
    t.after(cleanup)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    t.mock.method(console, 'error', () => {})
    fail = true
    root.render(
      <>
        <b>Before</b>
        <Portal container={second}>
          <Child />
        </Portal>
        <i>After</i>
      </>,
    )
    expect(errors.length).toBe(1)
    expect(first.childNodes.length).toBe(0)
    expect(second.childNodes.length).toBe(0)
    fail = false
    root.render(
      <>
        <b>Before</b>
        <Portal container={first}>
          <Child />
        </Portal>
        <i>After</i>
      </>,
    )
    expect(errors.length).toBe(1)
    expect(first.querySelector('input')?.value).toBe('Recovered')
    expect(container.textContent).toBe('BeforeAfter')
    expect(container.childNodes.length).toBe(2)
  })

  it('keeps keyed source order separate from destination placement and reconciles keyed children', (t) => {
    let destination = document.createElement('div')
    let { root, container, cleanup } = render(
      <>
        <Portal key="a" container={destination}>
          <b key="one">One</b>
          <i key="two">Two</i>
        </Portal>
        <p key="middle">Middle</p>
        <Portal key="b" container={destination}>
          <u>Three</u>
        </Portal>
      </>,
    )
    t.after(cleanup)
    let one = destination.querySelector('b')
    let two = destination.querySelector('i')
    let middle = container.firstChild
    root.render(
      <>
        <Portal key="b" container={destination}>
          <u>Three</u>
        </Portal>
        <p key="middle">Middle</p>
        <Portal key="a" container={destination}>
          <i key="two">Two</i>
          <b key="one">One</b>
        </Portal>
      </>,
    )
    expect(destination.textContent).toBe('TwoOneThree')
    expect(destination.querySelector('b')).toBe(one)
    expect(destination.querySelector('i')).toBe(two)
    expect(container.firstChild).toBe(middle)
    expect(container.childNodes.length).toBe(1)
    expect(container.children.length).toBe(1)
    expect(container.children[0].localName).toBe('p')
    cleanup()
    expect(destination.childNodes.length).toBe(0)
  })

  it('cleans up nested portals when an authored host ancestor is removed', (t) => {
    let first = document.createElement('div')
    let second = document.createElement('div')
    let signal: AbortSignal | undefined
    function Child(handle: Handle) {
      signal = handle.signal
      return () => <b>Nested</b>
    }
    let { root, cleanup } = render(
      <section>
        <Portal container={first}>
          <div>
            <Portal container={second}>
              <Child />
            </Portal>
          </div>
        </Portal>
      </section>,
    )
    t.after(cleanup)
    expect(second.textContent).toBe('Nested')
    root.render(<p>Replacement</p>)
    expect(first.childNodes.length).toBe(0)
    expect(second.childNodes.length).toBe(0)
    expect(signal?.aborted).toBe(true)
  })

  it('uses destination DOM event propagation and form ownership', async (t) => {
    let destination = document.createElement('form')
    let sourceClicks = 0
    let destinationClicks = 0
    destination.addEventListener('click', () => {
      destinationClicks++
    })
    let { act, cleanup } = render(
      <form
        mix={on('click', () => {
          sourceClicks++
        })}
      >
        <Portal container={destination}>
          <button type="button">Click</button>
          <input name="name" defaultValue="Mark" />
        </Portal>
      </form>,
    )
    t.after(cleanup)
    await act(() => destination.querySelector('button')?.click())
    expect(destinationClicks).toBe(1)
    expect(sourceClicks).toBe(0)
    expect(new FormData(destination).get('name')).toBe('Mark')
  })

  it('reports descendant render and task errors on the owning root', (t) => {
    let destination = document.createElement('div')
    let source = document.createElement('div')
    let root = createRoot(source)
    t.after(() => root.dispose())
    let errors: unknown[] = []
    root.addEventListener('error', (event) => {
      errors.push(event.error)
    })
    t.mock.method(console, 'error', () => {})
    let renderError = new Error('Portal render')
    let taskError = new Error('Portal task')
    function BadRender() {
      throw renderError
      return () => null
    }
    function BadTask(handle: Handle) {
      handle.queueTask(() => {
        throw taskError
      })
      return () => <b>Mounted</b>
    }
    root.render(
      <Portal container={destination}>
        <BadRender />
      </Portal>,
    )
    expect(errors).toEqual([renderError])
    expect(source.childNodes.length).toBe(0)
    expect(destination.childNodes.length).toBe(0)
    root.render(
      <Portal container={destination}>
        <BadTask />
      </Portal>,
    )
    expect(errors).toEqual([renderError, taskError])
    expect(destination.textContent).toBe('Mounted')
  })

  it('removes newly mounted portals when a later source sibling fails to render', (t) => {
    let first = document.createElement('div')
    let second = document.createElement('div')
    let root = createRoot(document.createElement('div'))
    t.after(() => root.dispose())
    t.mock.method(console, 'error', () => {})
    let error = new Error('Later sibling failed')
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    let signal: AbortSignal | undefined
    function Child(handle: Handle) {
      signal = handle.signal
      return () => <b>Content</b>
    }
    function BadSibling() {
      throw error
      return () => null
    }
    root.render(
      <section>
        <Portal container={first}>
          <Portal container={second}>
            <Child />
          </Portal>
        </Portal>
        <BadSibling />
      </section>,
    )
    expect(errors).toEqual([error])
    expect(first.childNodes.length).toBe(0)
    expect(second.childNodes.length).toBe(0)
    expect(signal?.aborted).toBe(true)
  })

  it('removes only newly created portals when a source update fails', (t) => {
    let destination = document.createElement('div')
    let { root, cleanup } = render(
      <>
        <Portal key="existing" container={destination}>
          <b>Existing</b>
        </Portal>
      </>,
    )
    t.after(cleanup)
    t.mock.method(console, 'error', () => {})
    let error = new Error('Source update failed')
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    let child = destination.querySelector('b')
    let start = destination.firstChild
    let end = destination.lastChild
    function BadSibling() {
      throw error
      return () => null
    }
    root.render(
      <>
        <Portal key="existing" container={destination}>
          <b>Existing</b>
        </Portal>
        <Portal key="new" container={destination}>
          <i>Abandoned</i>
        </Portal>
        <Fragment key="bad">
          <BadSibling />
        </Fragment>
      </>,
    )
    expect(errors).toEqual([error])
    expect(destination.textContent).toBe('Existing')
    expect(destination.querySelector('b')).toBe(child)
    expect(destination.firstChild).toBe(start)
    expect(destination.lastChild).toBe(end)
    root.render(
      <>
        <Portal key="existing" container={destination}>
          <b>Recovered</b>
        </Portal>
      </>,
    )
    expect(destination.textContent).toBe('Recovered')
    expect(destination.querySelector('b')).toBe(child)
    cleanup()
    expect(destination.childNodes.length).toBe(0)
  })

  it('lets completed children finish exiting when initial portal rendering fails', async (t) => {
    let destination = document.createElement('div')
    let finish = Promise.withResolvers<void>()
    let removed = Promise.withResolvers<void>()
    t.after(() => finish.resolve())
    let exit = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => finish.promise))
      handle.addEventListener('remove', () => removed.resolve())
      return () => handle.element
    })
    let error = new Error('Initial render failed')
    function BadChild() {
      throw error
      return () => null
    }
    let root = createRoot(document.createElement('div'))
    t.after(() => root.dispose())
    t.mock.method(console, 'error', () => {})
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    root.render(
      <Portal container={destination}>
        <b mix={exit()}>Leaving</b>
        <BadChild />
      </Portal>,
    )
    expect(errors).toEqual([error])
    expect(destination.textContent).toBe('Leaving')
    expect(destination.firstChild?.nodeType).toBe(Node.COMMENT_NODE)
    expect(destination.lastChild?.nodeType).toBe(Node.COMMENT_NODE)
    finish.resolve()
    await removed.promise
    expect(destination.childNodes.length).toBe(0)
  })

  it('rejects a different document and keeps an existing destination intact', (t) => {
    let destination = document.createElement('div')
    let other = document.implementation.createHTMLDocument().body
    let { root, cleanup } = render(
      <Portal container={destination}>
        <b>Content</b>
      </Portal>,
    )
    t.after(cleanup)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => {
      errors.push(event.error)
    })
    t.mock.method(console, 'error', () => {})
    root.render(
      <Portal container={other}>
        <b>Changed</b>
      </Portal>,
    )
    expect(errors.length).toBe(1)
    expect(String(errors[0])).toContain('same document')
    expect(destination.textContent).toBe('Content')
    expect(other.childNodes.length).toBe(0)
  })

  it('rejects using a portal child as its replacement destination', (t) => {
    let destination = document.createElement('div')
    let { root, cleanup } = render(
      <Portal container={destination}>
        <section />
      </Portal>,
    )
    t.after(cleanup)
    let child = destination.querySelector('section')
    invariant(child)
    let errors: unknown[] = []
    root.addEventListener('error', (event) => {
      errors.push(event.error)
    })
    t.mock.method(console, 'error', () => {})
    root.render(
      <Portal container={child}>
        <section />
      </Portal>,
    )
    expect(String(errors[0])).toContain('inside its own children')
    expect(destination.querySelector('section')).toBe(child)
  })

  it('mounts during hydration without consuming source siblings', async (t) => {
    let destination = document.createElement('div')
    let Slot = clientEntry(
      '/slot.js#Slot',
      function Slot(handle: Handle<{ children?: RemixNode }>) {
        return () => (
          <section>
            Before
            <Portal container={destination}>{handle.props.children}</Portal>
            <i>After</i>
          </section>
        )
      },
    )
    let source = document.createElement('div')
    source.innerHTML = await renderToString(
      <Slot>
        <b>Client content</b>
      </Slot>,
    )
    expect(source.textContent).toContain('BeforeAfter')
    expect(source.querySelector('b')).toBeNull()
    expect(source.innerHTML).not.toContain('rmx:p')
    expect(source.innerHTML).not.toContain('$rmxPortal')
    let sibling = source.querySelector('i')
    document.body.append(source)
    let app = run({ loadModule: () => Slot })
    t.after(() => {
      app.dispose()
      source.remove()
    })
    await app.ready()
    expect(source.querySelector('i')).toBe(sibling)
    expect(destination.textContent).toBe('Client content')
    app.dispose()
    expect(destination.childNodes.length).toBe(0)
  })

  it('stops skipping comments at the hydration range end before claiming an outside sibling', (t) => {
    let source = document.createElement('div')
    source.innerHTML =
      '<!--start--><!--ordinary--><!--end--><input aria-label="Outside" value="Keep me">'
    let start = source.firstChild
    let end = source.childNodes[2]
    let outside = source.querySelector('input')
    invariant(start instanceof Comment && end instanceof Comment && outside)
    let destination = document.createElement('div')
    let root = createRangeRoot([start, end])
    t.after(() => root.dispose())
    root.render(
      <>
        <Portal container={destination}>Portal content</Portal>
        <input aria-label="Inside" defaultValue="New content" />
      </>,
    )
    let inside = source.querySelector('input[aria-label="Inside"]')
    expect(inside).not.toBe(outside)
    expect(inside?.nextSibling).toBe(end)
    expect(end.nextSibling).toBe(outside)
    expect(outside.getAttribute('aria-label')).toBe('Outside')
    expect(outside.value).toBe('Keep me')
    expect(destination.textContent).toBe('Portal content')
    root.dispose()
    expect(source.querySelectorAll('input').length).toBe(1)
    expect(source.querySelector('input')).toBe(outside)
    expect(destination.childNodes.length).toBe(0)
  })

  it('inserts adjacent portals among hydrated text, components and empty children', async (t) => {
    let destination = document.createElement('div')
    let tree = (
      <section>
        Before
        {null}
        <Portal container={destination}>One</Portal>
        <Portal container={destination}>Two</Portal>
        <i>After</i>
        {false}
        <Portal container={destination}>Three</Portal>
        Tail
      </section>
    )
    let source = document.createElement('div')
    source.innerHTML = '<section>Before<!--ordinary--><i>After</i>Tail</section>'
    let section = source.querySelector('section')
    invariant(section)
    let sibling = section.querySelector('i')
    let root = createRoot(source)
    t.after(() => root.dispose())
    root.render(tree)
    expect(section.querySelector('i')).toBe(sibling)
    expect(section.textContent).toBe('BeforeAfterTail')
    expect(section.children.length).toBe(1)
    expect(destination.textContent).toBe('OneTwoThree')
    root.render(null)
    expect(destination.childNodes.length).toBe(0)
  })

  it('mounts into a ref destination after commit and returns to the default body', async (t) => {
    let destination: HTMLElement | null = null
    let useBody = false
    let mounts = 0
    let update = async () => {}
    function App(handle: Handle) {
      update = async () => {
        useBody = true
        await handle.update()
      }
      return () => {
        let target = useBody ? undefined : destination
        return (
          <>
            <div
              mix={ref((node) => {
                invariant(node instanceof HTMLElement)
                destination = node
                handle.update()
              })}
            />
            {target !== null && (
              <Portal container={target}>
                <b
                  data-portal-test="ref"
                  mix={ref(() => {
                    mounts++
                  })}
                >
                  Content
                </b>
              </Portal>
            )}
          </>
        )
      }
    }
    let { cleanup } = render(<App />)
    t.after(cleanup)
    let content = document.querySelector('[data-portal-test="ref"]')
    invariant(content)
    expect(content.parentNode).toBe(destination)
    expect(mounts).toBe(1)
    await update()
    let nextContent = document.querySelector('[data-portal-test="ref"]')
    invariant(nextContent)
    expect(nextContent).not.toBe(content)
    expect(content.parentNode).toBeNull()
    expect(nextContent.parentNode).toBe(document.body)
    expect(mounts).toBe(2)
    cleanup()
    expect(nextContent.isConnected).toBe(false)
  })

  it('keeps generated styles and HTML namespaces when authored inside SVG', (t) => {
    let { cleanup } = render(
      <svg>
        <Portal>
          <p data-portal-test="styled" mix={css({ color: 'rgb(12, 34, 56)' })}>
            HTML
          </p>
        </Portal>
      </svg>,
    )
    t.after(cleanup)
    let content = document.querySelector('[data-portal-test="styled"]')
    invariant(content)
    expect(content.namespaceURI).toBe('http://www.w3.org/1999/xhtml')
    expect(getComputedStyle(content).color).toBe('rgb(12, 34, 56)')
  })

  it('disposes a portal in a hydrated range without touching surrounding content', async (t) => {
    let destination = document.createElement('div')
    let source = document.createElement('div')
    source.innerHTML = 'Before<!--start--><!--end-->After'
    let start = source.childNodes[1]
    let end = source.childNodes[2]
    invariant(start && end)
    let root = createRangeRoot([start, end])
    t.after(() => root.dispose())
    root.render(
      <Portal container={destination}>
        <b>Outside</b>
      </Portal>,
    )
    expect(destination.textContent).toBe('Outside')
    root.dispose()
    expect(source.innerHTML).toBe('Before<!--start--><!--end-->After')
    expect(destination.childNodes.length).toBe(0)
  })

  it('lets mixins finish deferred removal after the portal is disposed', async (t) => {
    let destination = document.createElement('div')
    let finish = Promise.withResolvers<void>()
    let removed = Promise.withResolvers<void>()
    let persist = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => {
        event.persistNode(() => finish.promise)
      })
      handle.addEventListener('remove', () => removed.resolve())
      return () => handle.element
    })
    let { cleanup } = render(
      <Portal container={destination}>
        <b mix={persist()}>Leaving</b>
      </Portal>,
    )
    t.after(cleanup)
    let start = destination.firstChild
    let end = destination.lastChild
    cleanup()
    expect(destination.textContent).toBe('Leaving')
    expect(start?.nodeType).toBe(Node.COMMENT_NODE)
    expect(end?.nodeType).toBe(Node.COMMENT_NODE)
    expect(destination.firstChild).toBe(start)
    expect(destination.lastChild).toBe(end)
    expect(destination.childNodes.length).toBe(3)
    finish.resolve()
    await removed.promise
    expect(destination.childNodes.length).toBe(0)
  })

  it('keeps its range until all independently exiting children have been removed', async (t) => {
    let destination = document.createElement('div')
    let first = Promise.withResolvers<void>()
    let second = Promise.withResolvers<void>()
    let firstRemoved = Promise.withResolvers<void>()
    let secondRemoved = Promise.withResolvers<void>()
    t.after(() => {
      first.resolve()
      second.resolve()
    })
    let firstExit = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => first.promise))
      handle.addEventListener('remove', () => firstRemoved.resolve())
      return () => handle.element
    })
    let secondExit = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => second.promise))
      handle.addEventListener('remove', () => secondRemoved.resolve())
      return () => handle.element
    })
    let { cleanup } = render(
      <Portal container={destination}>
        <b mix={firstExit()}>First</b>
        <i mix={secondExit()}>Second</i>
      </Portal>,
    )
    t.after(cleanup)
    let start = destination.firstChild
    let end = destination.lastChild
    cleanup()
    second.resolve()
    await secondRemoved.promise
    expect(destination.textContent).toBe('First')
    expect(destination.firstChild).toBe(start)
    expect(destination.lastChild).toBe(end)
    expect(destination.childNodes.length).toBe(3)
    first.resolve()
    await firstRemoved.promise
    expect(destination.childNodes.length).toBe(0)
  })

  it('keeps its range when a child starts exiting before the portal is disposed', async (t) => {
    let destination = document.createElement('div')
    let finish = Promise.withResolvers<void>()
    let removed = Promise.withResolvers<void>()
    t.after(() => finish.resolve())
    let exit = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => finish.promise))
      handle.addEventListener('remove', () => removed.resolve())
      return () => handle.element
    })
    let { root, cleanup } = render(
      <Portal container={destination}>
        <b mix={exit()}>Leaving</b>
      </Portal>,
    )
    t.after(cleanup)
    let start = destination.firstChild
    let end = destination.lastChild
    root.render(<Portal container={destination} />)
    cleanup()
    expect(destination.firstChild).toBe(start)
    expect(destination.lastChild).toBe(end)
    expect(destination.childNodes.length).toBe(3)
    finish.resolve()
    await removed.promise
    expect(destination.childNodes.length).toBe(0)
  })

  it('preserves an exiting portal range during raw HTML destination updates', async (t) => {
    let finish = Promise.withResolvers<void>()
    let removed = Promise.withResolvers<void>()
    t.after(() => finish.resolve())
    let exit = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => finish.promise))
      handle.addEventListener('remove', () => removed.resolve())
      return () => handle.element
    })
    let host = render(<section />)
    t.after(host.cleanup)
    let destination = host.container.querySelector('section')
    invariant(destination)
    let portal = render(
      <Portal container={destination}>
        <b mix={exit()}>Leaving</b>
      </Portal>,
    )
    t.after(portal.cleanup)
    let start = destination.firstChild
    let end = destination.lastChild
    portal.cleanup()
    host.root.render(<section innerHTML={unsafeHTML('<i>Updated</i>')} />)
    expect(destination.textContent).toBe('UpdatedLeaving')
    expect(destination.childNodes[1]).toBe(start)
    expect(destination.lastChild).toBe(end)
    finish.resolve()
    await removed.promise
    expect(destination.innerHTML).toBe('<i>Updated</i>')
    host.root.render(<section />)
    expect(destination.childNodes.length).toBe(0)
  })

  it('resolves frames inside a portal through the owning root', async (t) => {
    let destination = document.createElement('div')
    let committed = Promise.withResolvers<void>()
    let { cleanup } = render(
      <Portal container={destination}>
        <Frame src="/portaled-frame" />
      </Portal>,
      {
        frameInit: {
          resolveFrame(src) {
            expect(src).toBe('/portaled-frame')
            return <p mix={ref(() => committed.resolve())}>Frame content</p>
          },
        },
      },
    )
    t.after(cleanup)
    await committed.promise
    expect(destination.textContent).toBe('Frame content')
    cleanup()
    expect(destination.childNodes.length).toBe(0)
  })
  it('keeps a portal when the destination removes its own rendered children', async (t) => {
    let destination: HTMLElement | null = null
    let hints = ['Workspace hint']
    let update = async () => {}
    let errors: unknown[] = []
    function App(handle: Handle) {
      update = async () => {
        hints = []
        await handle.update()
      }
      return () => (
        <>
          <div
            mix={ref((node) => {
              invariant(node instanceof HTMLElement)
              destination = node
              handle.update()
            })}
          >
            {hints.map((hint) => (
              <p>{hint}</p>
            ))}
          </div>
          {destination && (
            <Portal container={destination}>
              <b>Draft</b>
            </Portal>
          )}
        </>
      )
    }
    let { root, container, cleanup } = render(<App />)
    t.after(cleanup)
    root.addEventListener('error', (event) => errors.push(event.error))
    t.mock.method(console, 'error', () => {})
    let target = container.querySelector('div')
    invariant(target)
    let draft = target.querySelector('b')
    await update()
    expect(errors).toEqual([])
    expect(target.textContent).toBe('Draft')
    expect(target.querySelector('b')).toBe(draft)
  })

  it('removes all destination content when disposed after a failed portal update', (t) => {
    let destination = document.createElement('div')
    let { root, cleanup } = render(
      <Portal container={destination}>
        <b>Original</b>
      </Portal>,
    )
    t.after(cleanup)
    t.mock.method(console, 'error', () => {})
    let error = new Error('Update failed')
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    function NewChild() {
      return () => <i>New child</i>
    }
    function BadChild() {
      throw error
      return () => null
    }
    root.render(
      <Portal container={destination}>
        <b>Updated</b>
        <NewChild />
        <BadChild />
      </Portal>,
    )
    expect(errors).toEqual([error])
    cleanup()
    expect(destination.childNodes.length).toBe(0)
  })
  it('removes all destination content when disposed after a descendant update fails', async (t) => {
    let destination = document.createElement('div')
    let nestedDestination = document.createElement('div')
    let update = async () => {}
    let failing = false
    let error = new Error('Independent update failed')
    function NewChild() {
      return () => <i>New child</i>
    }
    function BadChild() {
      throw error
      return () => null
    }
    function Content(handle: Handle) {
      update = async () => {
        failing = true
        await handle.update()
      }
      return () =>
        failing ? (
          <>
            <Portal container={nestedDestination}>
              <b>Nested</b>
            </Portal>
            Stray text
            <section>
              <NewChild />
              <BadChild />
            </section>
          </>
        ) : (
          <b>Original</b>
        )
    }
    let { root, cleanup } = render(
      <Portal container={destination}>
        <Content />
      </Portal>,
    )
    t.after(cleanup)
    t.mock.method(console, 'error', () => {})
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    // Await the root's error event because this update does not commit.
    let failed = Promise.withResolvers<void>()
    root.addEventListener('error', () => failed.resolve(), { once: true })
    void update()
    await failed.promise
    expect(errors).toEqual([error])
    expect(nestedDestination.childNodes.length).toBe(0)
    cleanup()
    expect(destination.childNodes.length).toBe(0)
  })

  it('clears failed update leftovers while preserving exits and neighbouring portals', async (t) => {
    let destination = document.createElement('div')
    let finish = Promise.withResolvers<void>()
    let removed = Promise.withResolvers<void>()
    t.after(() => finish.resolve())
    let exit = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => finish.promise))
      handle.addEventListener('remove', () => removed.resolve())
      return () => handle.element
    })
    let error = new Error('Descendant update failed')
    function BadChild() {
      throw error
      return () => null
    }
    let update = () => {}
    function Content(handle: Handle) {
      let failing = false
      update = () => {
        failing = true
        void handle.update()
      }
      return () =>
        failing ? (
          <>
            Stray<i>Unrecorded</i>
            <BadChild />
          </>
        ) : (
          <span>Original</span>
        )
    }
    let { root, cleanup } = render(
      <>
        <Portal key="owner" container={destination}>
          <b mix={exit()}>Leaving</b>
          <Content />
        </Portal>
        <Portal key="neighbour" container={destination}>
          <u>Neighbour</u>
        </Portal>
      </>,
    )
    t.after(cleanup)
    t.mock.method(console, 'error', () => {})
    let errors: unknown[] = []
    root.addEventListener('error', (event) => errors.push(event.error))
    let start = destination.firstChild
    let end = destination.childNodes[3]
    let neighbour = destination.querySelector('u')
    update()
    root.flush()
    expect(errors).toEqual([error])
    root.render(
      <>
        <Portal key="neighbour" container={destination}>
          <u>Neighbour</u>
        </Portal>
      </>,
    )
    expect(destination.textContent).toBe('LeavingNeighbour')
    expect(destination.firstChild).toBe(start)
    expect(destination.childNodes[2]).toBe(end)
    expect(destination.querySelector('u')).toBe(neighbour)
    finish.resolve()
    await removed.promise
    expect(destination.textContent).toBe('Neighbour')
    expect(destination.childNodes.length).toBe(3)
    cleanup()
    expect(destination.childNodes.length).toBe(0)
  })
  it('reconciles element, text, empty, and fragment content within its own destination range', (t) => {
    let destination = document.createElement('div')
    let { root, cleanup } = render(
      <>
        <Portal container={destination}>
          <div>Original</div>
        </Portal>
        <Portal container={destination}>
          <u>Neighbour</u>
        </Portal>
      </>,
    )
    t.after(cleanup)
    let neighbour = destination.querySelector('u')
    root.render(
      <>
        <Portal container={destination}>
          <p>Replacement</p>
        </Portal>
        <Portal container={destination}>
          <u>Neighbour</u>
        </Portal>
      </>,
    )
    expect(destination.textContent).toBe('ReplacementNeighbour')
    root.render(
      <>
        <Portal container={destination}>{['First', 'Second']}</Portal>
        <Portal container={destination}>
          <u>Neighbour</u>
        </Portal>
      </>,
    )
    expect(destination.textContent).toBe('FirstSecondNeighbour')
    root.render(
      <>
        <Portal container={destination}>{['Second', 'First']}</Portal>
        <Portal container={destination}>
          <u>Neighbour</u>
        </Portal>
      </>,
    )
    expect(destination.textContent).toBe('SecondFirstNeighbour')
    root.render(
      <>
        <Portal container={destination} />
        <Portal container={destination}>
          <u>Neighbour</u>
        </Portal>
      </>,
    )
    expect(destination.textContent).toBe('Neighbour')
    root.render(
      <>
        <Portal container={destination}>
          <>
            <b>Restored</b> text
          </>
        </Portal>
        <Portal container={destination}>
          <u>Neighbour</u>
        </Portal>
      </>,
    )
    expect(destination.textContent).toBe('Restored textNeighbour')
    expect(destination.querySelector('u')).toBe(neighbour)
  })

  it('removes an empty portal and its conditional source siblings without disturbing later siblings', (t) => {
    let destination = document.createElement('div')
    let { root, container, cleanup } = render(
      <section>
        <>
          <Portal container={destination} />
          <b>Conditional</b>
        </>
        <p>Permanent</p>
      </section>,
    )
    t.after(cleanup)
    let permanent = container.querySelector('p')
    root.render(
      <section>
        {null}
        <p>Permanent</p>
      </section>,
    )
    expect(container.textContent).toBe('Permanent')
    expect(container.querySelector('p')).toBe(permanent)
    expect(destination.childNodes.length).toBe(0)
  })

  it('restores SVG and HTML namespaces across nested portals and foreignObject siblings', (t) => {
    let first = document.createElement('div')
    let second = document.createElement('div')
    let { container, cleanup } = render(
      <svg>
        <circle data-node="source-before" />
        <Portal container={first}>
          <div data-node="html-first" />
          <svg>
            <circle data-node="svg-before" />
            <foreignObject>
              <div data-node="foreign-html" />
              <Portal container={second}>
                <div data-node="html-second" />
                <svg>
                  <circle data-node="nested-svg" />
                </svg>
              </Portal>
              <div data-node="foreign-after" />
            </foreignObject>
            <circle data-node="svg-after" />
          </svg>
        </Portal>
        <circle data-node="source-after" />
      </svg>,
    )
    t.after(cleanup)
    expect(container.querySelector('[data-node="source-before"]')?.namespaceURI).toBe(
      'http://www.w3.org/2000/svg',
    )
    expect(container.querySelector('[data-node="source-after"]')?.namespaceURI).toBe(
      'http://www.w3.org/2000/svg',
    )
    expect(first.querySelector('[data-node="html-first"]')?.namespaceURI).toBe(
      'http://www.w3.org/1999/xhtml',
    )
    expect(first.querySelector('[data-node="svg-before"]')?.namespaceURI).toBe(
      'http://www.w3.org/2000/svg',
    )
    expect(first.querySelector('[data-node="foreign-html"]')?.namespaceURI).toBe(
      'http://www.w3.org/1999/xhtml',
    )
    expect(first.querySelector('[data-node="foreign-after"]')?.namespaceURI).toBe(
      'http://www.w3.org/1999/xhtml',
    )
    expect(first.querySelector('[data-node="svg-after"]')?.namespaceURI).toBe(
      'http://www.w3.org/2000/svg',
    )
    expect(second.querySelector('[data-node="html-second"]')?.namespaceURI).toBe(
      'http://www.w3.org/1999/xhtml',
    )
    expect(second.querySelector('[data-node="nested-svg"]')?.namespaceURI).toBe(
      'http://www.w3.org/2000/svg',
    )
  })

  it('follows native capture, bubbling, and stopPropagation when the destination is inside the source root', async (t) => {
    let destination: HTMLElement | null = null
    let stop = false
    let log: string[] = []
    function App(handle: Handle) {
      return () => (
        <section
          mix={[
            on(
              'click',
              () => {
                log.push('capture ancestor')
              },
              true,
            ),
            on('click', () => {
              log.push('bubble ancestor')
            }),
          ]}
        >
          <div
            mix={ref((node) => {
              invariant(node instanceof HTMLElement)
              destination = node
              handle.update()
            })}
          />
          {destination && (
            <Portal container={destination}>
              <button
                mix={[
                  on(
                    'click',
                    () => {
                      log.push('capture child')
                    },
                    true,
                  ),
                  on('click', (event) => {
                    log.push('bubble child')
                    if (stop) event.stopPropagation()
                  }),
                ]}
              >
                Click
              </button>
            </Portal>
          )}
        </section>
      )
    }
    let { container, act, cleanup } = render(<App />)
    t.after(cleanup)
    await act(() => container.querySelector('button')?.click())
    expect(log).toEqual(['capture ancestor', 'capture child', 'bubble child', 'bubble ancestor'])
    log = []
    stop = true
    await act(() => container.querySelector('button')?.click())
    expect(log).toEqual(['capture ancestor', 'capture child', 'bubble child'])
  })

  it('keeps portals from independent roots isolated in a shared destination', (t) => {
    let destination = document.createElement('div')
    let first = render(
      <Portal container={destination}>
        <b>First root</b>
      </Portal>,
    )
    let second = render(
      <Portal container={destination}>
        <i>Second root</i>
      </Portal>,
    )
    t.after(first.cleanup)
    t.after(second.cleanup)
    let remaining = destination.querySelector('i')
    first.cleanup()
    expect(destination.textContent).toBe('Second root')
    second.root.render(
      <Portal container={destination}>
        <i>Updated</i>
      </Portal>,
    )
    expect(destination.querySelector('i')).toBe(remaining)
    expect(destination.textContent).toBe('Updated')
    second.cleanup()
    expect(destination.childNodes.length).toBe(0)
  })
  it('preserves a portal while its destination updates raw HTML content', async (t) => {
    let destination: HTMLElement | null = null
    let html = '<p>Original hint</p>'
    let update = async () => {}
    function App(handle: Handle) {
      update = async () => {
        html = '<p>Updated hint</p>'
        await handle.update()
      }
      return () => (
        <>
          <div
            innerHTML={unsafeHTML(html)}
            mix={ref((node) => {
              invariant(node instanceof HTMLElement)
              destination = node
              handle.update()
            })}
          />
          {destination && (
            <Portal container={destination}>
              <b>Draft</b>
            </Portal>
          )}
        </>
      )
    }
    let { container, cleanup } = render(<App />)
    t.after(cleanup)
    let draft = container.querySelector('b')
    await update()
    expect(container.textContent).toBe('Updated hintDraft')
    expect(container.querySelector('b')).toBe(draft)
  })

  it('reflects a controlled select value after portaled options are added and removed', async (t) => {
    let destination: HTMLSelectElement | null = null
    let show = true
    let update = async () => {}
    function App(handle: Handle) {
      update = async () => {
        show = false
        await handle.update()
      }
      return () => (
        <>
          <select
            value="b"
            mix={ref((node) => {
              invariant(node instanceof HTMLSelectElement)
              destination = node
              handle.update()
            })}
          >
            <option value="a">A</option>
          </select>
          {destination && (
            <Portal container={destination}>{show && <option value="b">B</option>}</Portal>
          )}
        </>
      )
    }
    let { container, cleanup } = render(<App />)
    t.after(cleanup)
    let select = container.querySelector('select')
    invariant(select)
    expect(select.value).toBe('b')
    await update()
    expect(select.value).toBe('')
    expect(select.selectedIndex).toBe(-1)
  })
})

describe('Portal hydration', () => {
  it('provides connected portal refs before initial owner tasks and cleans them up independently', async (t) => {
    let visible = true
    let input: HTMLInputElement | undefined
    let inputSignal: AbortSignal | undefined
    let ownerSignal: AbortSignal | undefined
    let events: string[] = []
    let Entry = clientEntry(
      '/entry.js#Entry',
      function Entry(handle: Handle<{ visible: boolean }>) {
        handle.queueTask(() => {
          ownerSignal = handle.signal
          invariant(input)
          expect(input.isConnected).toBe(true)
          expect(input.parentElement).toBe(document.body)
          input.focus()
          events.push('owner task')
        })
        return () =>
          handle.props.visible && (
            <Portal>
              <input
                aria-label="Initial portal input"
                mix={ref((node, signal) => {
                  invariant(node instanceof HTMLInputElement)
                  input = node
                  inputSignal = signal
                  events.push('ref')
                })}
              />
            </Portal>
          )
      },
    )
    let renderPage = () => renderDocument(<Entry visible={visible} />)
    setDocument(await renderPage())
    expect(document.querySelector('input')).toBeNull()
    let app = run({ loadModule: () => Entry, resolveFrame: renderPage })
    t.after(() => app.dispose())
    await app.ready()
    invariant(input)
    expect(document.activeElement).toBe(input)
    expect(events).toEqual(['ref', 'owner task'])
    expect(inputSignal?.aborted).toBe(false)
    await app.frames.top.reload()
    expect(document.querySelector('input')).toBe(input)
    expect(events).toEqual(['ref', 'owner task'])
    expect(inputSignal?.aborted).toBe(false)
    visible = false
    await app.frames.top.reload()
    expect(input.isConnected).toBe(false)
    expect(inputSignal?.aborted).toBe(true)
    expect(ownerSignal?.aborted).toBe(false)
    app.dispose()
    expect(ownerSignal?.aborted).toBe(true)
  })

  it('only mounts portals inside a client entry', async (t) => {
    let version = 1
    function Notice(handle: Handle<{ label: string; version: number }>) {
      return () => (
        <Portal>
          <p>
            {handle.props.label} {handle.props.version}
          </p>
        </Portal>
      )
    }
    let Entry = clientEntry('/entry.js#Entry', function Entry(handle: Handle<{ version: number }>) {
      return () => <Notice label="Client" version={handle.props.version} />
    })
    let renderPage = () =>
      renderDocument(
        <main>
          <Notice label="Server" version={version} />
          <Entry version={version} />
          <i>Following</i>
        </main>,
      )
    setDocument(await renderPage())
    expect(document.querySelector('p')).toBeNull()
    let following = document.querySelector('i')
    let app = run({ loadModule: () => Entry, resolveFrame: renderPage })
    t.after(() => app.dispose())
    await app.ready()
    let content = document.querySelector('p')
    invariant(content)
    expect(content.parentElement).toBe(document.body)
    expect(content.textContent).toBe('Client 1')
    expect(document.querySelectorAll('p').length).toBe(1)
    expect(document.querySelector('i')).toBe(following)
    version++
    await app.frames.top.reload()
    expect(document.querySelector('p')).toBe(content)
    expect(content.textContent).toBe('Client 2')
    expect(document.querySelectorAll('p').length).toBe(1)
    expect(document.querySelector('i')).toBe(following)
    app.dispose()
    expect(content.isConnected).toBe(false)
  })

  it('does not load nested frames or register nested client entries during server rendering', async (t) => {
    function Child(): () => RemixNode {
      throw new Error('Portal children must not run on the server')
    }
    let Nested = clientEntry('/nested.js#Nested', Child)
    let requests = 0
    let modules = 0
    let html = await renderToString(
      <Portal>
        <Frame src="/unrequested" />
        <Nested />
      </Portal>,
    )
    expect(html).toBe('')
    document.body.innerHTML = html
    let app = run({
      loadModule() {
        modules++
        return Nested
      },
      resolveFrame() {
        requests++
        throw new Error('Unexpected frame request')
      },
    })
    t.after(() => app.dispose())
    await app.ready()
    expect(modules).toBe(0)
    expect(requests).toBe(0)
    expect(document.body.textContent).toBe('')
    app.dispose()
  })

  it('mounts a nested client entry once and retains it when its portal owner reloads', async (t) => {
    let version = 1
    let mounts = 0
    let clicks = 0
    let childSignal: AbortSignal | undefined
    let Nested = clientEntry('/nested.js#Nested', function Nested(handle: Handle) {
      handle.queueTask(() => {
        mounts++
        childSignal = handle.signal
      })
      return () => (
        <button
          mix={on('click', () => {
            clicks++
          })}
        >
          Nested action
        </button>
      )
    })
    let Entry = clientEntry('/entry.js#Entry', function Entry(handle: Handle<{ version: number }>) {
      return () => (
        <Portal>
          <span>{handle.props.version}</span>
          <Nested />
        </Portal>
      )
    })
    let renderPage = () =>
      renderDocument(
        <main>
          <Entry version={version} />
          <i>Following</i>
        </main>,
      )
    setDocument(await renderPage())
    let modules: string[] = []
    let app = run({
      loadModule(_url, name) {
        modules.push(name)
        return Entry
      },
      resolveFrame: renderPage,
    })
    t.after(() => app.dispose())
    await app.ready()
    let button = document.querySelector('button')
    invariant(button)
    expect(modules).toEqual(['Entry'])
    expect(mounts).toBe(1)
    button.click()
    expect(clicks).toBe(1)
    version++
    await app.frames.top.reload()
    expect(document.querySelector('button')).toBe(button)
    expect(document.body.querySelector('span')?.textContent).toBe('2')
    expect(mounts).toBe(1)
    button.click()
    expect(clicks).toBe(2)
    app.dispose()
    expect(childSignal?.aborted).toBe(true)
    expect(button.isConnected).toBe(false)
  })

  it('loads and hydrates a frame passed inside serialised Portal JSX and preserves it on owner reload', async (t) => {
    let version = 1
    let loads = 0
    let nestedMounts = 0
    let nestedReady = Promise.withResolvers<void>()
    let Nested = clientEntry('/nested.js#Nested', function Nested(handle: Handle) {
      handle.queueTask(() => {
        nestedMounts++
        nestedReady.resolve()
      })
      return () => <input aria-label="Portaled frame draft" defaultValue="Initial" />
    })
    let Entry = clientEntry(
      '/entry.js#Entry',
      function Entry(handle: Handle<{ children?: RemixNode }>) {
        return () => (
          <section>
            <b>Before</b>
            {handle.props.children}
            <i>After</i>
          </section>
        )
      },
    )
    let renderPage = () =>
      renderDocument(
        <main>
          <Entry>
            <Portal>
              <label>Version {version}</label>
              <Frame name="portaled" src="/nested" />
            </Portal>
          </Entry>
        </main>,
      )
    setDocument(await renderPage())
    let following = document.querySelector('i')
    let app = run({
      loadModule: (_url, name) => (name === 'Nested' ? Nested : Entry),
      resolveFrame(src) {
        if (src.endsWith('/nested')) {
          loads++
          return renderToString(<Nested />)
        }
        return renderPage()
      },
    })
    t.after(() => app.dispose())
    await app.ready()
    await nestedReady.promise
    let input = document.querySelector('input')
    invariant(input)
    input.value = 'Keep draft'
    expect(loads).toBe(1)
    expect(nestedMounts).toBe(1)
    expect(document.querySelector('i')).toBe(following)
    version++
    await app.frames.top.reload()
    expect(document.querySelector('input')).toBe(input)
    expect(input.value).toBe('Keep draft')
    expect(loads).toBe(2)
    expect(nestedMounts).toBe(1)
    expect(document.querySelector('label')?.textContent).toBe('Version 2')
    app.dispose()
    expect(input.isConnected).toBe(false)
  })

  it('does not mount a portal after its owner is removed while its module is loading', async (t) => {
    let show = true
    let mounts = 0
    let moduleRequested = Promise.withResolvers<void>()
    let module = Promise.withResolvers<typeof Entry>()
    let Entry = clientEntry('/entry.js#Entry', function Entry(handle: Handle) {
      handle.queueTask(() => mounts++)
      return () => (
        <Portal>
          <p>Late content</p>
        </Portal>
      )
    })
    let renderPage = () =>
      renderDocument(
        <main>
          {show && <Entry />}
          <i>Following</i>
        </main>,
      )
    setDocument(await renderPage())
    let app = run({
      loadModule() {
        moduleRequested.resolve()
        return module.promise
      },
      resolveFrame: renderPage,
    })
    t.after(() => app.dispose())
    await moduleRequested.promise
    show = false
    await app.frames.top.reload()
    module.resolve(Entry)
    await app.ready()
    expect(mounts).toBe(0)
    expect(document.querySelector('p')).toBeNull()
    expect(document.body.textContent).toContain('Following')
  })

  it('cleans up portaled DOM after hydration fails and recovers on the next owner update', async (t) => {
    let fail = true
    let clicks = 0
    let disposals = 0
    let Failure = clientEntry('/failure.js#Failure', function Failure() {
      return () => {
        if (fail) throw new Error('Hydration failure')
        return <i>Recovered</i>
      }
    })
    function Child(handle: Handle) {
      handle.signal.addEventListener('abort', () => disposals++)
      return () => (
        <button
          mix={on('click', () => {
            clicks++
          })}
        >
          Portaled action
        </button>
      )
    }
    let Entry = clientEntry('/entry.js#Entry', function Entry() {
      return () => (
        <>
          <Portal>
            <Child />
            <Failure />
          </Portal>
        </>
      )
    })
    let renderPage = () =>
      renderDocument(
        <main>
          <Entry />
          <b>Following</b>
        </main>,
      )
    setDocument(await renderPage())
    t.mock.method(console, 'error', () => {})
    let app = run({ loadModule: () => Entry, resolveFrame: renderPage })
    let errors: unknown[] = []
    app.addEventListener('error', (event) => errors.push(event.error))
    t.after(() => app.dispose())
    await app.ready()
    expect(errors.length).toBe(1)
    expect(document.querySelector('button')).toBeNull()
    expect(disposals).toBe(1)
    fail = false
    await app.frames.top.reload()
    let button = document.querySelector('button')
    invariant(button)
    button.click()
    expect(clicks).toBe(1)
    expect(document.querySelectorAll('button').length).toBe(1)
    expect(document.querySelector('i')?.textContent).toBe('Recovered')
    app.dispose()
    expect(disposals).toBe(2)
    expect(button.isConnected).toBe(false)
  })

  it('revives serialised portal styles and keeps descriptor-shaped text inert', async (t) => {
    let Entry = clientEntry(
      '/entry.js#Entry',
      function Entry(handle: Handle<{ children?: RemixNode }>) {
        return () => handle.props.children
      },
    )
    let text = '</script><script>throw new Error("injected")</script>{"$rmxPortal":true}'
    document.body.innerHTML = await renderToString(
      <Entry>
        <Portal>
          <p mix={css({ color: 'rgb(12, 34, 56)' })}>{text}</p>
        </Portal>
      </Entry>,
    )
    expect(document.querySelector('p')).toBeNull()
    expect(document.querySelectorAll('script').length).toBe(1)
    let app = run({ loadModule: () => Entry })
    t.after(() => app.dispose())
    await app.ready()
    let content = document.querySelector('p')
    invariant(content)
    expect(content.textContent).toBe(text)
    expect(content.querySelector('script')).toBeNull()
    expect(getComputedStyle(content).color).toBe('rgb(12, 34, 56)')
    app.dispose()
    expect(content.isConnected).toBe(false)
  })
})

describe('Portal frame reloads', () => {
  it('hydrates serialised nested portals and preserves children across prop updates until their key changes', async (t) => {
    let version = 1
    let key = 'first'
    let Entry = clientEntry(
      '/portal.js#Entry',
      function Entry(handle: Handle<{ children?: RemixNode }>) {
        return () => <>{handle.props.children}</>
      },
    )
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <main>
              <Entry>
                <Portal key={key}>
                  <label>
                    Version {version}
                    <input aria-label="Serialised draft" defaultValue="Initial" />
                  </label>
                  <Portal>
                    <aside>Nested {version}</aside>
                  </Portal>
                </Portal>
              </Entry>
              <p>Following</p>
            </main>
          </body>
        </html>,
      )
    let app = await startApp(t, renderPage, () => Entry)
    let input = document.querySelector('input')
    invariant(input)
    input.value = 'Keep this draft'
    input.focus()
    input.setSelectionRange(1, 4)
    let label = input.parentElement
    let aside = document.querySelector('aside')
    expect(label?.parentElement).toBe(document.body)
    expect(aside?.parentElement).toBe(document.body)
    expect(document.querySelector('main')?.textContent).toBe('Following')
    version++
    await app.frames.top.reload()
    expect(document.querySelector('input')).toBe(input)
    expect(document.querySelector('aside')).toBe(aside)
    expect(label?.textContent).toBe('Version 2')
    expect(aside?.textContent).toBe('Nested 2')
    expect(input.value).toBe('Keep this draft')
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(1)
    expect(input.selectionEnd).toBe(4)
    key = 'second'
    await app.frames.top.reload()
    expect(document.querySelector('input')).not.toBe(input)
    expect(document.querySelector('input')?.value).toBe('Initial')
    expect(input.isConnected).toBe(false)
    expect(aside?.isConnected).toBe(false)
    app.dispose()
    expect(document.querySelector('input')).toBeNull()
    expect(document.querySelector('aside')).toBeNull()
  })

  it('keeps body content connected and updates owner props across document reloads', async (t) => {
    let version = 1
    let setups = 0
    let update = async () => {}
    let Entry = clientEntry(
      '/portal.js#Entry',
      function Entry(handle: Handle<{ version: number }>) {
        let count = 0
        handle.queueTask(() => {
          setups++
          update = async () => {
            count++
            await handle.update()
          }
        })
        return () => (
          <Portal>
            <label>
              Version {handle.props.version}, count {count}
              <input aria-label="Draft" defaultValue="Initial" />
            </label>
          </Portal>
        )
      },
    )
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <main>
              Server {version}
              <Entry version={version} />
            </main>
          </body>
        </html>,
      )
    let app = await startApp(t, renderPage, () => Entry)
    let input = document.querySelector('input')
    invariant(input)
    let initialSetups = setups
    input.value = 'Keep my draft'
    input.focus()
    input.setSelectionRange(2, 7)
    let removed: Node[] = []
    let observer = new MutationObserver(() => {})
    observer.observe(document.body, { childList: true, subtree: true })
    t.after(() => observer.disconnect())
    for (let i = 0; i < 3; i++) {
      version++
      await app.frames.top.reload()
      removed.push(...observer.takeRecords().flatMap((record) => Array.from(record.removedNodes)))
      expect(document.querySelector('input')).toBe(input)
      expect(document.activeElement).toBe(input)
      expect(input.value).toBe('Keep my draft')
      expect(input.selectionStart).toBe(2)
      expect(input.selectionEnd).toBe(7)
      expect(input.parentElement?.textContent).toBe(`Version ${version}, count ${i}`)
      await update()
    }
    expect(setups).toBe(initialSetups)
    expect(input.parentElement?.textContent).toBe('Version 4, count 3')
    expect(removed.some((node) => node === input || node.contains(input))).toBe(false)
    app.dispose()
    expect(input.isConnected).toBe(false)
  })

  it('preserves portal-only owners through source reordering and server sibling changes', async (t) => {
    let order = ['a', 'b']
    let version = 0
    let inline = false
    let signals = new Map<string, AbortSignal>()
    let setups = new Map<string, number>()
    let Entry = clientEntry(
      '/portal.js#Entry',
      function Entry(handle: Handle<{ name: string; version: number; inline: boolean }>) {
        let mounted = false
        let count = 0
        handle.queueTask(() => {
          let name = handle.props.name
          setups.set(name, (setups.get(name) ?? 0) + 1)
          signals.set(name, handle.signal)
          mounted = true
          count++
          return handle.update()
        })
        return () => (
          <>
            {mounted && (
              <Portal>
                <label>
                  {handle.props.name}:{handle.props.version}:{count}
                  <input aria-label={handle.props.name} />
                </label>
              </Portal>
            )}
            {handle.props.inline && <i>Inline {handle.props.name}</i>}
          </>
        )
      },
    )
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <main>
              <b>Before</b>
              {order.map((name) => (
                <section data-rmx-key={name}>
                  <Entry name={name} version={version} inline={inline} />
                </section>
              ))}
              <u>After</u>
            </main>
          </body>
        </html>,
      )
    let app = await startApp(t, renderPage, () => Entry)
    let a = document.querySelector('input[aria-label="a"]')
    let b = document.querySelector('input[aria-label="b"]')
    invariant(a instanceof HTMLInputElement && b instanceof HTMLInputElement)
    let aSignal = signals.get('a')
    let bSignal = signals.get('b')
    a.value = 'Keep my draft'
    a.focus()
    a.setSelectionRange(2, 6)
    let removed: Node[] = []
    let observer = new MutationObserver(() => {})
    observer.observe(document.body, { childList: true, subtree: true })
    t.after(() => observer.disconnect())
    for (let i = 1; i <= 6; i++) {
      version = i
      order = i % 2 ? ['b', 'a'] : ['a', 'b']
      inline = i % 3 === 0
      await app.frames.top.reload()
      removed.push(...observer.takeRecords().flatMap((record) => Array.from(record.removedNodes)))
      expect(document.querySelector('input[aria-label="a"]')).toBe(a)
      expect(document.querySelector('input[aria-label="b"]')).toBe(b)
      expect(document.activeElement).toBe(a)
      expect(a.selectionStart).toBe(2)
      expect(a.selectionEnd).toBe(6)
      expect(a.value).toBe('Keep my draft')
      expect(a.parentElement?.textContent).toBe('a:' + version + ':1')
      expect(b.parentElement?.textContent).toBe('b:' + version + ':1')
      expect(
        Array.from(document.querySelectorAll('main section')).map((node) =>
          node.getAttribute('data-rmx-key'),
        ),
      ).toEqual(order)
      expect(document.querySelector('main')?.textContent).toBe(
        inline ? 'BeforeInline ' + order[0] + 'Inline ' + order[1] + 'After' : 'BeforeAfter',
      )
      for (let section of document.querySelectorAll('main section')) {
        expect(section.childNodes.length).toBe(inline ? 3 : 2)
      }
    }
    expect(
      removed.some((node) => node === a || node === b || node.contains(a) || node.contains(b)),
    ).toBe(false)
    expect(setups.get('a')).toBe(1)
    expect(setups.get('b')).toBe(1)
    order = ['b']
    await app.frames.top.reload()
    expect(aSignal?.aborted).toBe(true)
    expect(bSignal?.aborted).toBe(false)
    expect(document.querySelector('input')).toBe(b)
    app.dispose()
    expect(bSignal?.aborted).toBe(true)
    expect(document.querySelector('input')).toBeNull()
    expect(
      Array.from(document.body.childNodes).some((node) => node.nodeValue === 'rmx:portal'),
    ).toBe(false)
  })

  it('does not match server siblings against portal children, even when keys collide', async (t) => {
    let version = 0
    let Entry = clientEntry('/portal.js#Entry', function Entry() {
      let destination =
        typeof document === 'undefined' ? null : document.getElementById('destination')
      return () =>
        destination && (
          <Portal container={destination}>
            <p data-rmx-key="shared">Portal</p>
          </Portal>
        )
    })
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <section id="destination" data-rmx-key="destination">
              {version > 0 && <p data-rmx-key="shared">Server {version}</p>}
              {version > 1 && <span>Following sibling</span>}
            </section>
            <Entry />
          </body>
        </html>,
      )
    let app = await startApp(t, renderPage, () => Entry)
    let destination = document.getElementById('destination')
    let portal = destination?.querySelector('p')
    invariant(destination && portal)
    version = 1
    await app.frames.top.reload()
    expect(portal.textContent).toBe('Portal')
    expect(destination.querySelectorAll('p').length).toBe(2)
    version = 2
    await app.frames.top.reload()
    expect(portal.textContent).toBe('Portal')
    expect(destination.textContent).toContain('Server 2')
    expect(destination.textContent).toContain('Following sibling')
    version = 0
    await app.frames.top.reload()
    expect(destination.textContent).toBe('Portal')
    expect(destination.querySelector('p')).toBe(portal)
  })

  it('disposes omitted owners without removing surviving portals from the same snapshot', async (t) => {
    let showFirst = true
    let signals: AbortSignal[] = []
    let Entry = clientEntry('/portal.js#Entry', function Entry(handle: Handle<{ name: string }>) {
      handle.queueTask(() => {
        signals.push(handle.signal)
      })
      return () => (
        <Portal>
          <input aria-label={handle.props.name} />
        </Portal>
      )
    })
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <main>
              {showFirst && (
                <section data-rmx-key="first">
                  <Entry name="First" />
                </section>
              )}
              <section data-rmx-key="second">
                <Entry name="Second" />
              </section>
            </main>
          </body>
        </html>,
      )
    let app = await startApp(t, renderPage, () => Entry)
    let first = document.querySelector('input[aria-label="First"]')
    let second = document.querySelector('input[aria-label="Second"]')
    invariant(first && second)
    let firstSignal = signals.at(-2)
    let secondSignal = signals.at(-1)
    showFirst = false
    await app.frames.top.reload()
    expect(first.isConnected).toBe(false)
    expect(firstSignal?.aborted).toBe(true)
    expect(document.querySelector('input')).toBe(second)
    expect(secondSignal?.aborted).toBe(false)
    app.dispose()
    expect(secondSignal?.aborted).toBe(true)
    expect(document.querySelector('input')).toBeNull()
  })

  it('keeps foreign portals alive in removed destinations and remounts them on retargeting', async (t) => {
    let replace = false
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            {replace ? (
              <article id="destination">New destination</article>
            ) : (
              <section id="destination">Old destination</section>
            )}
          </body>
        </html>,
      )
    let app = await startApp(t, renderPage, () => {
      throw new Error('Unexpected destination hydration')
    })
    let destination = document.getElementById('destination')
    invariant(destination)
    let ready = Promise.withResolvers<void>()
    let signal: AbortSignal | undefined
    let nestedFrame: FrameHandle | undefined
    let nestedVersion = 0
    let Nested = clientEntry('/nested.js#Nested', function Nested(handle: Handle) {
      handle.queueTask(() => {
        signal = handle.signal
        nestedFrame = handle.frame
        ready.resolve()
      })
      return () => <input aria-label="Nested draft" defaultValue="Nested" />
    })
    let source = document.createElement('div')
    let root = createRoot(source, {
      frameInit: {
        loadModule: () => Nested,
        resolveFrame: () => {
          nestedVersion++
          return renderToString(<Nested />)
        },
      },
    })
    t.after(() => root.dispose())
    let portal = (container: HTMLElement) => (
      <Portal container={container}>
        <Frame src="/nested" />
      </Portal>
    )
    root.render(portal(destination))
    await ready.promise
    let input = destination.querySelector('input')
    invariant(input && nestedFrame && signal)
    input.value = 'Keep this'
    replace = true
    await app.frames.top.reload()
    expect(destination.isConnected).toBe(false)
    expect(input.parentNode).not.toBeNull()
    expect(signal.aborted).toBe(false)
    expect(nestedVersion).toBe(1)
    let nextDestination = document.getElementById('destination')
    invariant(nextDestination)
    let previousSignal = signal
    ready = Promise.withResolvers<void>()
    root.render(portal(nextDestination))
    await ready.promise
    let nextInput = nextDestination.querySelector('input')
    invariant(nextInput && signal && nestedFrame)
    expect(nextInput).not.toBe(input)
    expect(nextInput.value).toBe('Nested')
    expect(previousSignal.aborted).toBe(true)
    expect(nestedVersion).toBe(2)
    await nestedFrame.reload()
    expect(nestedVersion).toBe(3)
    expect(signal.aborted).toBe(false)
    app.dispose()
    expect(signal.aborted).toBe(false)
    root.dispose()
    expect(signal.aborted).toBe(true)
    expect(nextDestination.textContent).toBe('New destination')
  })

  it('reloads a destination frame without reloading or disposing a portal-owned frame', async (t) => {
    let destinationVersion = 0
    let nestedVersion = 0
    let nestedReady = Promise.withResolvers<void>()
    let nestedFrame: FrameHandle | undefined
    let destinationContent = () =>
      renderToString(
        <section id="destination">
          <p>Server {++destinationVersion}</p>
        </section>,
      )
    let renderPage = () =>
      drain(
        renderToStream(
          <html>
            <head />
            <body>
              <Frame name="destination" src="/destination" />
            </body>
          </html>,
          { resolveFrame: destinationContent },
        ),
      )
    let app = await startApp(
      t,
      renderPage,
      () => {
        throw new Error('Unexpected client entry')
      },
      (src) => {
        expect(src).toBe('/destination')
        return destinationContent()
      },
    )
    let destination = document.getElementById('destination')
    invariant(destination)
    function Nested(handle: Handle) {
      nestedFrame = handle.frame
      return () => <input aria-label="Nested" mix={ref(() => nestedReady.resolve())} />
    }
    let root = createRoot(document.createElement('div'), {
      frameInit: {
        resolveFrame: () => {
          nestedVersion++
          return <Nested />
        },
      },
    })
    t.after(() => root.dispose())
    root.render(
      <Portal container={destination}>
        <Frame src="/nested" />
      </Portal>,
    )
    await nestedReady.promise
    let input = destination.querySelector('input')
    invariant(input && nestedFrame)
    input.focus()
    let destinationFrame = app.frames.get('destination')
    invariant(destinationFrame)
    for (let i = 0; i < 3; i++) {
      await destinationFrame.reload()
      expect(destination.querySelector('input')).toBe(input)
      expect(document.activeElement).toBe(input)
      expect(destination.querySelector('p')?.textContent).toBe(`Server ${i + 2}`)
      expect(nestedVersion).toBe(1)
    }
    await nestedFrame.reload()
    expect(nestedVersion).toBe(2)
    expect(destination.querySelector('input')).toBe(input)
  })

  it('still reloads portal-owned frames through a surviving owner and disposes them with it', async (t) => {
    let version = 1
    let showOwner = true
    let requests = 0
    let ready = Promise.withResolvers<void>()
    let nestedSignal: AbortSignal | undefined
    function Nested(handle: Handle) {
      handle.queueTask(() => {
        nestedSignal = handle.signal
        ready.resolve()
      })
      return () => <input aria-label="Nested draft" defaultValue="Nested" />
    }
    let Entry = clientEntry('/portal.js#Entry', function Entry() {
      return () => (
        <Portal>
          <Frame name="nested" src="/nested" />
        </Portal>
      )
    })
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <main>
              Server {version}
              {showOwner && <Entry />}
            </main>
          </body>
        </html>,
      )
    let app = await startApp(
      t,
      renderPage,
      () => Entry,
      (src) => {
        if (src === '/nested') {
          requests++
          return <Nested />
        }
        return renderPage()
      },
    )
    await ready.promise
    let input = document.querySelector('input')
    let nested = app.frames.get('nested')
    invariant(input && nested && nestedSignal)
    input.value = 'Still editing'
    input.focus()
    version++
    await app.frames.top.reload()
    expect(requests).toBe(2)
    expect(app.frames.get('nested')).toBe(nested)
    expect(document.querySelector('input')).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('Still editing')
    expect(nestedSignal.aborted).toBe(false)
    showOwner = false
    await app.frames.top.reload()
    expect(input.isConnected).toBe(false)
    expect(nestedSignal.aborted).toBe(true)
    expect(app.frames.get('nested')).toBeUndefined()
  })

  it('keeps the surviving portal when an older document reload finishes after its replacement', async (t) => {
    let version = 1
    let firstRequest = Promise.withResolvers<void>()
    let firstResponse = Promise.withResolvers<string>()
    let requests = 0
    let Entry = clientEntry(
      '/portal.js#Entry',
      function Entry(handle: Handle<{ version: number }>) {
        return () => (
          <Portal>
            <label>
              Version {handle.props.version}
              <input aria-label="Draft" />
            </label>
          </Portal>
        )
      },
    )
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <main>
              <Entry version={version} />
            </main>
          </body>
        </html>,
      )
    let app = await startApp(
      t,
      renderPage,
      () => Entry,
      () => {
        if (++requests === 1) {
          firstRequest.resolve()
          return firstResponse.promise
        }
        return renderPage()
      },
    )
    let input = document.querySelector('input')
    invariant(input)
    input.value = 'Draft through cancellation'
    input.focus()
    version = 2
    let oldHtml = await renderPage()
    let oldReload = app.frames.top.reload()
    await firstRequest.promise
    version = 3
    await app.frames.top.reload()
    firstResponse.resolve(oldHtml)
    let oldSignal = await oldReload
    expect(oldSignal.aborted).toBe(true)
    expect(document.querySelectorAll('input').length).toBe(1)
    expect(document.querySelector('input')).toBe(input)
    expect(input.parentElement?.textContent).toBe('Version 3')
    expect(input.value).toBe('Draft through cancellation')
    expect(document.activeElement).toBe(input)
  })

  it('does not resurrect portal content when its owner is removed during a child frame request', async (t) => {
    let showOwner = true
    let childRequested = Promise.withResolvers<void>()
    let childResponse = Promise.withResolvers<string>()
    let childSignal: AbortSignal | undefined
    let Entry = clientEntry('/portal.js#Entry', function Entry() {
      return () => (
        <Portal>
          <Frame src="/pending-child" fallback={<p id="pending">Pending</p>} />
        </Portal>
      )
    })
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <main>{showOwner && <Entry />}</main>
          </body>
        </html>,
      )
    let initial = new DOMParser().parseFromString(await renderPage(), 'text/html')
    document.body.innerHTML = initial.body.innerHTML
    let app = run({
      loadModule: () => Entry,
      resolveFrame(src, options) {
        if (src === '/pending-child') {
          childSignal = options?.signal
          childRequested.resolve()
          return childResponse.promise
        }
        return renderPage()
      },
    })
    t.after(() => app.dispose())
    await childRequested.promise
    expect(document.getElementById('pending')?.textContent).toBe('Pending')
    showOwner = false
    await app.frames.top.reload()
    expect(childSignal?.aborted).toBe(true)
    childResponse.resolve('<p id="late-content">Too late</p>')
    await app.ready()
    expect(document.getElementById('pending')).toBeNull()
    expect(document.getElementById('late-content')).toBeNull()
    expect(document.body.textContent).toBe('')
  })

  it('protects a portal exit animation from matching and removal during subsequent reloads', async (t) => {
    let showOwner = true
    let showServerContent = false
    let finish = Promise.withResolvers<void>()
    let removed = Promise.withResolvers<void>()
    t.after(() => finish.resolve())
    let exit = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => finish.promise))
      handle.addEventListener('remove', () => removed.resolve())
      return () => handle.element
    })
    let Entry = clientEntry('/portal.js#Entry', function Entry() {
      return () => (
        <Portal>
          <p data-rmx-key="shared" mix={exit()}>
            Leaving
          </p>
        </Portal>
      )
    })
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <main>{showOwner && <Entry />}</main>
            {showServerContent && <p data-rmx-key="shared">Server content</p>}
          </body>
        </html>,
      )
    let app = await startApp(t, renderPage, () => Entry)
    let leaving = document.querySelector('p')
    invariant(leaving)
    let start = leaving.previousSibling
    let end = leaving.nextSibling
    expect(start?.nodeType).toBe(Node.COMMENT_NODE)
    expect(end?.nodeType).toBe(Node.COMMENT_NODE)
    showOwner = false
    await app.frames.top.reload()
    expect(leaving.isConnected).toBe(true)
    expect(leaving.previousSibling).toBe(start)
    expect(leaving.nextSibling).toBe(end)
    showServerContent = true
    await app.frames.top.reload()
    expect(leaving.isConnected).toBe(true)
    expect(leaving.textContent).toBe('Leaving')
    expect(leaving.previousSibling).toBe(start)
    expect(leaving.nextSibling).toBe(end)
    expect(document.querySelectorAll('p').length).toBe(2)
    showServerContent = false
    await app.frames.top.reload()
    expect(leaving.isConnected).toBe(true)
    finish.resolve()
    await removed.promise
    expect(leaving.isConnected).toBe(false)
    expect(document.querySelector('p')).toBeNull()
    expect(start?.isConnected).toBe(false)
    expect(end?.isConnected).toBe(false)
  })

  it('cleans up an old frame snapshot after disposing the last portal in the document', async (t) => {
    let server = true
    let Entry = clientEntry('/portal.js#Entry', function Entry() {
      return () => (
        <Portal>
          <Frame src="/nested" />
        </Portal>
      )
    })
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <main>
              <Entry />
            </main>
          </body>
        </html>,
      )
    let app = await startApp(
      t,
      renderPage,
      () => Entry,
      (src) => {
        if (src === '/nested') return '<p>Nested content</p>'
        return server ? renderPage() : <main>Client content</main>
      },
    )
    let nested = document.querySelector('p')
    invariant(nested)
    server = false
    await app.frames.top.reload()
    expect(nested.isConnected).toBe(false)
    expect(document.body.innerHTML).toBe('<main>Client content</main>')
  })

  it('keeps foreign body portals when a document switches from server HTML to client nodes', async (t) => {
    let server = true
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <main>Server</main>
          </body>
        </html>,
      )
    let app = await startApp(
      t,
      renderPage,
      () => {
        throw new Error('Unexpected entry')
      },
      () => {
        if (server) return renderPage()
        return <main>Client</main>
      },
    )
    let root = createRoot(document.createElement('div'))
    t.after(() => root.dispose())
    root.render(
      <Portal>
        <main>
          <input aria-label="Foreign draft" defaultValue="Keep" />
        </main>
      </Portal>,
    )
    let input = document.querySelector('input')
    invariant(input)
    input.focus()
    server = false
    await app.frames.top.reload()
    expect(document.querySelector('input')).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(document.querySelectorAll('main').length).toBe(2)
    expect(input.parentElement?.textContent).toBe('')
    server = true
    await app.frames.top.reload()
    expect(document.querySelector('input')).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(document.querySelectorAll('main').length).toBe(2)
    expect(document.body.textContent).toBe('Server')
  })

  it('does not reclaim an exiting portal child for an unrelated client-rendered frame', async (t) => {
    let showOwner = true
    let clientContent = false
    let finish = Promise.withResolvers<void>()
    let removed = Promise.withResolvers<void>()
    t.after(() => finish.resolve())
    let exit = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => finish.promise))
      handle.addEventListener('remove', () => removed.resolve())
      return () => handle.element
    })
    let Entry = clientEntry('/portal.js#Entry', function Entry() {
      return () => (
        <Portal>
          <p key="shared" mix={exit()}>
            Leaving
          </p>
        </Portal>
      )
    })
    let renderPage = () =>
      renderToString(
        <html>
          <head />
          <body>
            <main>{showOwner && <Entry />}</main>
          </body>
        </html>,
      )
    let app = await startApp(
      t,
      renderPage,
      () => Entry,
      () => (clientContent ? <p key="shared">Client content</p> : renderPage()),
    )
    let leaving = document.querySelector('p')
    invariant(leaving)
    showOwner = false
    await app.frames.top.reload()
    clientContent = true
    await app.frames.top.reload()
    expect(leaving.textContent).toBe('Leaving')
    expect(document.querySelectorAll('p').length).toBe(2)
    finish.resolve()
    await removed.promise
    expect(document.body.textContent).toBe('Client content')
  })
})

function renderDocument(children: RemixNode): Promise<string> {
  return renderToString(
    <html>
      <head />
      <body>{children}</body>
    </html>,
  )
}

function setDocument(html: string): void {
  let initial = new DOMParser().parseFromString(html, 'text/html')
  document.head.innerHTML = initial.head.innerHTML
  document.body.innerHTML = initial.body.innerHTML
}

async function startApp(
  t: TestContext,
  renderPage: () => Promise<string>,
  loadModule: RunInit['loadModule'],
  resolveFrame: RunInit['resolveFrame'] = renderPage,
) {
  let initial = new DOMParser().parseFromString(await renderPage(), 'text/html')
  document.head.innerHTML = initial.head.innerHTML
  document.body.innerHTML = initial.body.innerHTML
  let app = run({ loadModule, resolveFrame })
  t.after(() => app.dispose())
  await app.ready()
  return app
}
