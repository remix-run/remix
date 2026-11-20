import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
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
import { renderToString } from '../server/stream.ts'
import { invariant } from '../runtime/invariant.ts'
import { jsx } from '../jsx-runtime.ts'

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
    ).rejects.toThrow('Portals with custom containers must be created in client-only code paths.')
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
    ).rejects.toThrow('Portals with custom containers must be created in client-only code paths.')
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
