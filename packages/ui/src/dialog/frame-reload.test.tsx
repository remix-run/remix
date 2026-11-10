import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'
import {
  clientEntry,
  Frame,
  navigate,
  run,
  type Handle,
  type RemixNode,
} from '@remix-run/component'
import { renderToStream } from '@remix-run/component/server'
import * as dialog from '../dialog.ts'
import { Portal } from '../portal.tsx'

const App = clientEntry('/js/app.js#App', function App(handle: Handle<{ label: string }>) {
  return () => (
    <dialog.Context>
      <button id="trigger" mix={dialog.trigger()}>
        {handle.props.label}
      </button>
      <Portal>
        <div mix={dialog.backdrop()} />
        <section aria-label="Dialog" mix={dialog.surface()}>
          <input id="field" aria-label="Field" />
          <button id="close" mix={dialog.close()}>
            Close
          </button>
        </section>
      </Portal>
    </dialog.Context>
  )
})

function Document(handle: Handle<{ label: string; framed?: boolean }>) {
  return () => (
    <html>
      <head />
      <body>
        <header id="header">{handle.props.label}</header>
        {handle.props.framed ? (
          <Frame name="content" src="/frame" />
        ) : (
          <main id="main">
            <App label={handle.props.label} />
          </main>
        )}
        <footer id="footer">{handle.props.label}</footer>
      </body>
    </html>
  )
}

async function toHtml(node: RemixNode) {
  let reader = renderToStream(node, {
    resolveFrame: async () =>
      await toHtml(
        <>
          <section id="frame-sibling">Frame sibling</section>
          <App label="Frame" />
        </>,
      ),
  }).getReader()
  let decoder = new TextDecoder()
  let html = ''
  for (;;) {
    let { done, value } = await reader.read()
    if (done) return html
    html += decoder.decode(value)
  }
}

function nextFrame() {
  return new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

function get(selector: string) {
  let node = document.querySelector<HTMLElement>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

// Hydrates a server-rendered document, then opens the modal dialog with focus in its field.
async function openModal(t: TestContext, { framed = false } = {}) {
  let original = document.documentElement.innerHTML
  let parsed = new DOMParser().parseFromString(
    await toHtml(<Document label="Initial" framed={framed} />),
    'text/html',
  )
  document.documentElement.innerHTML = parsed.documentElement.innerHTML

  let app = run({
    loadModule: () => App,
    async resolveFrame(src: string) {
      let pathname = new URL(src, location.href).pathname
      if (pathname === '/frame') {
        return await toHtml(
          <>
            <section id="frame-sibling">Frame sibling</section>
            <App label="Reloaded frame" />
          </>,
        )
      }
      if (pathname === '/next') return await toHtml(<Document label="Reloaded" />)
      throw new Error(`Unexpected frame source ${src}`)
    },
  })
  t.after(() => {
    app.dispose()
    document.documentElement.innerHTML = original
  })
  await app.ready()

  get('#trigger').click()
  app.flush()
  await nextFrame()
  get('#field').focus()
  return app
}

function expectModalIntact(shielded: string[]) {
  expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
  for (let selector of shielded) {
    expect(get(selector).hasAttribute('inert')).toBe(true)
    expect(get(selector).getAttribute('aria-hidden')).toBe('true')
  }
  expect(document.activeElement).toBe(get('#field'))
  expect(get('[role="dialog"]').hasAttribute('data-open')).toBe(true)
}

async function expectCloseReleases(app: Awaited<ReturnType<typeof openModal>>, shielded: string[]) {
  get('#close').click()
  app.flush()
  await nextFrame()
  expect(getComputedStyle(document.documentElement).overflow).toBe('visible')
  for (let selector of shielded) {
    expect(get(selector).hasAttribute('inert')).toBe(false)
    expect(get(selector).hasAttribute('aria-hidden')).toBe(false)
  }
  expect(document.activeElement).toBe(get('#trigger'))
}

describe('modal dialog across frame reloads', () => {
  it('keeps content inside a reloaded named frame inert', async (t) => {
    let app = await openModal(t, { framed: true })
    let shielded = ['#header', '#footer', '#frame-sibling']
    expectModalIntact(shielded)

    await app.frames.get('content')!.reload()

    expectModalIntact(shielded)
    await expectCloseReleases(app, shielded)
  })

  it('keeps the scroll lock, shielding, and focus through a top-frame reload', async (t) => {
    let app = await openModal(t)
    let shielded = ['#header', '#main', '#footer']
    expectModalIntact(shielded)

    app.frames.top.src = '/next'
    await app.frames.top.reload()
    await nextFrame()

    expect(get('#header').textContent).toBe('Reloaded')
    expectModalIntact(shielded)
    await expectCloseReleases(app, shielded)
  })

  it('keeps the scroll lock, shielding, and focus through client navigation', async (t) => {
    if (!('navigation' in window)) return
    let url = location.href
    history.replaceState(null, '', '/')
    t.after(() => history.replaceState(null, '', url))
    let app = await openModal(t)
    let shielded = ['#header', '#main', '#footer']

    await navigate('/next')
    await nextFrame()

    expect(get('#header').textContent).toBe('Reloaded')
    expectModalIntact(shielded)
    await expectCloseReleases(app, shielded)
  })
})
