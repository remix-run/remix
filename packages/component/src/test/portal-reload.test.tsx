import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'
import {
  clientEntry,
  createMixin,
  createRoot,
  Frame,
  Portal,
  ref,
  run,
  type FrameHandle,
  type Handle,
  type RemixNode,
} from '../index.ts'
import type { RunInit } from '../runtime/run.ts'
import { renderToStream, renderToString } from '../server/stream.ts'
import { invariant } from '../runtime/invariant.ts'
import { drain } from './utils.ts'

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
