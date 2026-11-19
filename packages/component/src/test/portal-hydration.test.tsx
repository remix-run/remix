import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import {
  clientEntry,
  css,
  Frame,
  on,
  Portal,
  ref,
  run,
  type Handle,
  type RemixNode,
} from '../index.ts'
import { renderToString } from '../server/stream.ts'
import { invariant } from '../runtime/invariant.ts'

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

  it('only mounts portals and runs queued tasks inside a client entry', async (t) => {
    let version = 1
    let tasks: string[] = []
    function Notice(handle: Handle<{ label: string; version: number }>) {
      handle.queueTask(() => {
        tasks.push(handle.props.label)
      })
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
    expect(tasks).toEqual([])
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
    expect(tasks).toEqual(['Client'])
    version++
    await app.frames.top.reload()
    expect(document.querySelector('p')).toBe(content)
    expect(content.textContent).toBe('Client 2')
    expect(document.querySelectorAll('p').length).toBe(1)
    expect(document.querySelector('i')).toBe(following)
    expect(tasks).toEqual(['Client'])
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
