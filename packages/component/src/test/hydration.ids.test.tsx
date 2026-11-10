import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import { createMixin } from '../index.ts'
import { clientEntry } from '../runtime/client-entries.ts'
import type { FrameHandle, Handle } from '../runtime/component.ts'
import { Frame } from '../runtime/frame.ts'
import { invariant } from '../runtime/invariant.ts'
import { run } from '../runtime/run.ts'
import { renderToStream } from '../server/stream.ts'
import { drain } from './utils.ts'

const idMixin = createMixin<HTMLElement>((handle) => () => (
  <handle.element data-mixin-id={handle.id} />
))
const browserOnlyMixin = createMixin<HTMLElement>(() => (props) => <span {...props} />, {
  ssr: false,
})

function Child(handle: Handle) {
  return () => <span data-id={handle.id} mix={idMixin()} />
}

function Plain(handle: Handle) {
  return () => <i data-id={handle.id} mix={idMixin()} />
}

const Entry = clientEntry('/js/entry.js#Entry', function Entry(handle: Handle) {
  return () => (
    <section data-id={handle.id}>
      <p mix={browserOnlyMixin()} />
      <Child />
      <div>
        <Child />
      </div>
    </section>
  )
})

function readIds(root: ParentNode | string): string[] {
  let html = typeof root === 'string' ? root : (root as Element).innerHTML
  return Array.from(html.matchAll(/data-(?:mixin-)?id="([^"]+)"/g), (match) => match[1]!)
}

describe('hydration ids', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('scopes descendant and mixin ids to the client entry on the server', async () => {
    let html = await drain(renderToStream(<Entry />))
    let entryId = /rmx:h:(\S+)/.exec(html)![1]!

    expect(readIds(html)).toEqual([
      entryId,
      `${entryId}-1`,
      `${entryId}-m2`,
      `${entryId}-2`,
      `${entryId}-m3`,
    ])
  })

  it('does not let ids outside an entry shift the ids inside it', async () => {
    let element = (
      <>
        <Plain />
        <Entry />
        <Plain />
      </>
    )
    let [first, second] = await Promise.all([
      drain(renderToStream(element)),
      drain(renderToStream(<Entry />)),
    ])
    let entryIds = (html: string) => {
      let entryId = /rmx:h:(\S+)/.exec(html)![1]!
      return readIds(html)
        .filter((id) => id.startsWith(entryId))
        .map((id) => id.slice(entryId.length))
    }

    expect(entryIds(first)).toEqual(entryIds(second))
    // Outside a client entry the IDs stay unique per render, without a client counterpart.
    let outside = readIds(first).filter((id) => id.startsWith('s'))
    expect(new Set(outside).size).toBe(outside.length)
  })

  it('keeps ids unchanged when an entry hydrates', async (t) => {
    document.body.innerHTML = await drain(renderToStream(<Entry />))
    let before = readIds(document.body)
    let app = run({ loadModule: () => Entry })
    t.after(() => app.dispose())
    await app.ready()

    expect(readIds(document.body)).toEqual(before)
  })

  it('hydrates sibling and nested entries independently', async (t) => {
    let Inner = clientEntry('/js/inner.js#Inner', function Inner(handle: Handle) {
      return () => <b data-id={handle.id} mix={idMixin()} />
    })
    let Outer = clientEntry('/js/outer.js#Outer', function Outer(handle: Handle) {
      return () => (
        <div data-id={handle.id}>
          <Child />
          <Inner />
          <Child />
        </div>
      )
    })
    document.body.innerHTML = await drain(
      renderToStream(
        <>
          <Entry />
          <Outer />
          <Entry />
        </>,
      ),
    )
    let before = readIds(document.body)
    let app = run({
      loadModule(moduleUrl) {
        return moduleUrl === '/js/inner.js' ? Inner : moduleUrl === '/js/outer.js' ? Outer : Entry
      },
    })
    t.after(() => app.dispose())
    await app.ready()

    expect(readIds(document.body)).toEqual(before)
    expect(new Set(before).size).toBe(before.length)
  })

  it('gives components mounted after hydration ids that stay unique', async (t) => {
    let show = () => {}
    let Toggle = clientEntry('/js/toggle.js#Toggle', function Toggle(handle: Handle) {
      let visible = false
      show = () => {
        visible = true
        void handle.update()
      }
      return () => (
        <div>
          <Child />
          {visible ? <Child /> : null}
        </div>
      )
    })
    document.body.innerHTML = await drain(renderToStream(<Toggle />))
    let before = readIds(document.body)
    let app = run({ loadModule: () => Toggle })
    t.after(() => app.dispose())
    await app.ready()
    show()
    app.flush()

    let after = readIds(document.body)
    expect(after.slice(0, before.length)).toEqual(before)
    expect(after).toHaveLength(before.length + 2)
    expect(new Set(after).size).toBe(after.length)
  })

  it('keeps ids of surviving entries and hydrates new ones with server ids on frame reload', async (t) => {
    let frame: FrameHandle | undefined
    let FrameEntry = clientEntry('/js/frame-entry.js#FrameEntry', function FrameEntry(h: Handle) {
      frame = h.frame
      return () => (
        <section data-id={h.id}>
          <Child />
        </section>
      )
    })
    let initial = await drain(renderToStream(<FrameEntry />))
    document.body.innerHTML = await drain(
      renderToStream(<Frame src="/frame" />, { resolveFrame: () => initial }),
    )
    let reloaded = await drain(
      renderToStream(
        <>
          <FrameEntry />
          <Entry />
        </>,
      ),
    )
    t.mock.method(globalThis, 'fetch', async () => new Response(reloaded))
    let app = run({ loadModule: (_url, name) => (name === 'Entry' ? Entry : FrameEntry) })
    t.after(() => app.dispose())
    await app.ready()
    invariant(frame)
    let before = readIds(document.body)
    await frame.reload()

    // The surviving entry keeps its instance, so its ids do not change. The new entry hydrates
    // the ids the server rendered for it.
    expect(readIds(document.body)).toEqual([...before, ...readIds(reloaded).slice(before.length)])
    expect(new Set(readIds(document.body)).size).toBe(readIds(document.body).length)
  })

  it('keeps ids unique when entries in a reloaded frame mount descendants after hydration', async (t) => {
    let shows: Array<() => void> = []
    let frame: FrameHandle | undefined
    let Lazy = clientEntry('/js/lazy.js#Lazy', function Lazy(h: Handle) {
      frame = h.frame
      let visible = false
      shows.push(() => {
        visible = true
        void h.update()
      })
      return () => (
        <section data-id={h.id}>
          <Child />
          {visible ? <Child /> : null}
        </section>
      )
    })
    let initial = await drain(renderToStream(<Lazy />))
    document.body.innerHTML = await drain(
      renderToStream(<Frame src="/frame" />, { resolveFrame: () => initial }),
    )
    let reloaded = await drain(
      renderToStream(
        <>
          <Lazy />
          <Lazy />
        </>,
      ),
    )
    t.mock.method(globalThis, 'fetch', async () => new Response(reloaded))
    // Server renders also run setup, so only collect the browser instances.
    shows.length = 0
    let app = run({ loadModule: () => Lazy })
    t.after(() => app.dispose())
    await app.ready()
    invariant(frame)
    await new Promise((resolve) => setTimeout(resolve, 20))
    shows[0]!()
    app.flush()
    let beforeReload = readIds(document.body)
    await frame.reload()
    await app.ready()
    await new Promise((resolve) => setTimeout(resolve, 20))
    app.flush()
    shows[1]!()
    app.flush()

    // The first entry keeps its instance, including the child it mounted after hydration.
    let afterReload = readIds(document.body)
    expect(afterReload.slice(0, beforeReload.length)).toEqual(beforeReload)
    expect(afterReload).toHaveLength(beforeReload.length + 5)
    expect(new Set(afterReload).size).toBe(afterReload.length)
  })
})
