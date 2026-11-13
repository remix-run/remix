import * as assert from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'

import { navigate, updateUrl } from '../runtime/navigation.ts'
import { run } from '../runtime/run.ts'
import { Frame } from '../runtime/frame.ts'
import { jsx } from '../runtime/core/vnode.ts'
import type { FrameContent } from '../runtime/component.ts'

describe('traversal scroll restoration', () => {
  it('restores saved positions in WebKit', async (t) => {
    let page = await setup(t, 'AppleWebKit/605.1.15 Version/26.6 Safari/605.1.15')
    page.scroll(0, 800)
    await navigate('?detail#content')
    page.nativePosition = { x: 0, y: 123 }
    await window.navigation.back().finished
    assert.equal(window.scrollY, 800)
  })

  it('preserves native restoration in Chrome despite its AppleWebKit user agent token', async (t) => {
    let page = await setup(t, 'AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36')
    page.scroll(0, 800)
    await navigate('?detail')
    page.nativePosition = { x: 0, y: 123 }
    await window.navigation.back().finished
    assert.equal(window.scrollY, 123)
  })

  it('preserves native restoration in other Chromium browsers', async (t) => {
    let page = await setup(t, 'AppleWebKit/537.36 Chromium/153.0.0.0 Safari/537.36')
    page.scroll(0, 800)
    await navigate('?detail')
    page.nativePosition = { x: 0, y: 123 }
    await window.navigation.back().finished
    assert.equal(window.scrollY, 123)
  })

  it('restores the position left on each entry after a delayed traversal commits', async (t) => {
    let page = await setup(t)
    page.scroll(40, 800)
    await navigate('?detail')
    page.scroll(20, 300)

    let load = page.holdNextLoad()
    let back = window.navigation.back().finished
    await load.started
    // WebKit overwrites the destination's native position while the old page is still visible.
    page.nativePosition = { x: 20, y: 300 }
    load.finish()
    await back
    assert.equal(window.scrollX, 40)
    assert.equal(window.scrollY, 800)

    page.nativePosition = { x: 0, y: 0 }
    await window.navigation.forward().finished
    assert.equal(window.scrollX, 20)
    assert.equal(window.scrollY, 300)

    page.scroll(0, 0)
    await window.navigation.back().finished
    assert.equal(window.scrollY, 800)
  })

  it('uses native restoration after interrupted Back and resumes saving after a completed visit', async (t) => {
    let page = await setup(t)
    page.scroll(0, 800)
    await navigate('?detail')
    page.scroll(0, 300)
    let load = page.holdNextLoad()
    let traversal = window.navigation.back()
    let back = traversal.finished?.catch(() => {})
    await load.started
    await traversal.committed
    await navigate('?other')
    load.finish()
    await back
    page.nativePosition = { x: 0, y: 123 }
    await window.navigation.back().finished
    assert.equal(window.scrollY, 123)
    page.scroll(0, 450)
    await window.navigation.forward().finished
    await window.navigation.back().finished
    assert.equal(window.scrollY, 450)
  })

  it('uses native restoration after an independent reload takes over Back', async (t) => {
    let page = await setup(t)
    page.scroll(0, 800)
    await navigate('?detail')
    page.scroll(0, 300)
    let load = page.holdNextLoad()
    let traversal = window.navigation.back()
    let back = traversal.finished?.catch(() => {})
    await load.started
    await traversal.committed
    await page.app.frames.top.reload()
    load.finish()
    await back
    page.scroll(0, 400)
    await navigate('?other')
    page.nativePosition = { x: 0, y: 123 }
    await window.navigation.back().finished
    assert.equal(window.scrollY, 123)
  })

  it('uses native restoration after a failed Back followed by a successful retry', async (t) => {
    let page = await setup(t)
    page.scroll(0, 800)
    await navigate('?detail')
    page.scroll(0, 300)
    let load = page.holdNextLoad()
    let traversal = window.navigation.back()
    let back = traversal.finished?.catch(() => {})
    await load.started
    await traversal.committed
    load.fail(new Error('Failed navigation'))
    await back
    await page.app.frames.top.reload()
    page.scroll(0, 400)
    await navigate('?other')
    page.nativePosition = { x: 0, y: 123 }
    await window.navigation.back().finished
    assert.equal(window.scrollY, 123)
  })

  it('uses native restoration when an ancestor replaces a targeted traversal', async (t) => {
    let page = await setup(t)
    await page.app.frames.top.replace(jsx(Frame, { name: 'content', src: '?list' }))
    await navigate('?list', { target: 'content' })
    page.scroll(0, 800)
    await navigate('?detail', { target: 'content' })
    page.scroll(0, 300)

    let load = page.holdNextLoad()
    let traversal = window.navigation.back()
    let back = traversal.finished?.catch(() => {})
    await load.started
    await traversal.committed
    await page.app.frames.top.replace(
      jsx('section', { children: jsx(Frame, { name: 'content', src: '?replacement' }) }),
    )
    load.finish()
    await back
    page.scroll(0, 400)
    await navigate('?other', { target: 'content' })
    page.nativePosition = { x: 0, y: 123 }
    await window.navigation.back().finished
    assert.equal(window.scrollY, 123)
  })

  it('uses native restoration after leaving rendered content before its stream finishes', async (t) => {
    let page = await setup(t)
    await navigate('?stream')
    page.scroll(0, 800)
    await navigate('?detail')
    let stream = new TransformStream<Uint8Array, Uint8Array>()
    let writer = stream.writable.getWriter()
    t.after(() => writer.abort())
    page.respondNextWith(stream.readable)
    let committed = Promise.withResolvers<void>()
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        let scroll = event.scroll.bind(event)
        t.mock.method(event, 'scroll', () => {
          scroll()
          committed.resolve()
        })
      },
      { once: true, signal: t.signal },
    )

    let back = window.navigation.back().finished?.catch(() => {})
    await writer.write(
      new TextEncoder().encode(
        '<html><head></head><body><h1>Streaming</h1></body></html><!-- rmx:flush document -->',
      ),
    )
    await committed.promise
    page.scroll(0, 400)
    await navigate('?other')
    await back
    page.nativePosition = { x: 0, y: 123 }
    await window.navigation.back().finished
    assert.equal(window.scrollY, 123)
  })

  it('ignores input from before navigation even when it is delivered during loading', async (t) => {
    let page = await setup(t)
    page.scroll(0, 800)
    await navigate('?detail')
    let wheel = new WheelEvent('wheel')
    t.mock.getter(wheel, 'timeStamp', () => 100)
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        t.mock.getter(event, 'timeStamp', () => 200)
      },
      { once: true, signal: t.signal },
    )

    let load = page.holdNextLoad()
    let back = window.navigation.back().finished
    await load.started
    window.dispatchEvent(wheel)
    load.finish()
    await back
    assert.equal(window.scrollY, 800)
  })

  it('leaves scroll restoration to applications that select manual mode', async (t) => {
    let page = await setup(t)
    history.scrollRestoration = 'manual'
    page.scroll(0, 800)
    await navigate('?detail')
    page.scroll(0, 300)
    await window.navigation.back().finished
    assert.equal(window.scrollY, 300)
  })

  it('does not override visitor scrolling while the destination loads', async (t) => {
    let page = await setup(t)
    page.scroll(0, 800)
    await navigate('?detail')

    let load = page.holdNextLoad()
    let back = window.navigation.back().finished
    await load.started
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 200 }))
    page.scroll(0, 200)
    page.nativePosition = { x: 0, y: 200 }
    load.finish()
    await back
    assert.equal(window.scrollY, 200)
  })

  it('saves positions after URL-only pushes and replacements', async (t) => {
    let page = await setup(t)
    page.scroll(0, 800)
    await updateUrl('?filter', { history: 'push' })
    await updateUrl('?filter=active')
    page.scroll(0, 600)
    await navigate('?detail')
    await window.navigation.back().finished
    assert.equal(window.scrollY, 600)
    await window.navigation.back().finished
    assert.equal(window.scrollY, 800)
  })
})

async function setup(t: TestContext, userAgent = 'Firefox') {
  let originalUrl = window.location.href
  let originalRestoration = history.scrollRestoration
  let controller = new AbortController()
  let position = { x: 0, y: 0 }
  t.mock.getter(window, 'scrollX', () => position.x)
  t.mock.getter(window, 'scrollY', () => position.y)
  t.mock.getter(navigator, 'userAgent', () => userAgent)
  t.mock.method(window, 'scrollTo', (options: ScrollToOptions) => {
    position = { x: options.left ?? position.x, y: options.top ?? position.y }
  })

  let pending: { started(): void; finished: Promise<void> } | undefined
  let nextContent: FrameContent | undefined
  let page = {
    nativePosition: { x: 0, y: 0 },
    scroll(x: number, y: number) {
      position = { x, y }
    },
    respondNextWith(content: FrameContent) {
      nextContent = content
    },
    holdNextLoad() {
      let started = Promise.withResolvers<void>()
      let finished = Promise.withResolvers<void>()
      pending = { started: started.resolve, finished: finished.promise }
      return { started: started.promise, finish: finished.resolve, fail: finished.reject }
    },
  }
  window.navigation.addEventListener(
    'navigate',
    (event) => {
      // Model the browser's incorrect native restoration independently of rendering and timing.
      t.mock.method(event, 'scroll', () => {
        if (event.navigationType !== 'traverse') position = { x: 0, y: 0 }
        else if (history.scrollRestoration !== 'manual') position = { ...page.nativePosition }
      })
    },
    { signal: controller.signal },
  )
  let app = run({
    loadModule: async () => () => null,
    async resolveFrame() {
      let content = nextContent
      nextContent = undefined
      let load = pending
      pending = undefined
      if (load) {
        load.started()
        await load.finished
      }
      return content ?? '<html><head></head><body><h1>Page</h1></body></html>'
    },
  })
  t.after(() => {
    app.dispose()
    controller.abort()
    history.scrollRestoration = originalRestoration
    history.replaceState(history.state, '', originalUrl)
    document.body.textContent = ''
  })
  await app.ready()
  return Object.assign(page, { app })
}
