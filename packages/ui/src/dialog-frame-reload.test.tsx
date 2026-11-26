import { expect } from '@remix-run/assert'
import { describe, it, type TestContext } from '@remix-run/test'
import { clientEntry, Frame, Portal, navigate, on, run } from '@remix-run/component'
import type { Handle, RemixNode } from '@remix-run/component'
import { renderToStream } from '@remix-run/component/server'
import * as dialog from './dialog.ts'
import * as popover from './popover.ts'
import * as toast from './toast.tsx'

const App = clientEntry('/js/app.js#App', function App(handle: Handle<{ label: string }>) {
  let manager = toast.createToastManager()
  return () => (
    <>
      <dialog.Context>
        <button id="trigger" mix={dialog.trigger()}>
          {handle.props.label}
        </button>
        <dialog.Portal>
          <dialog.SurfaceContext>
            <div mix={dialog.backdrop()} />
            <section aria-label="Dialog" mix={dialog.surface()}>
              <input id="field" aria-label="Field" />
              <Popup />
              <button
                id="publish"
                mix={on('click', () => {
                  manager.add({ title: 'Saved' })
                })}
              >
                Publish notification
              </button>
              <dialog.Context>
                <button id="child-trigger" mix={dialog.trigger()}>
                  Open child
                </button>
                <dialog.Portal>
                  <dialog.SurfaceContext>
                    <section id="child" aria-label="Child" mix={dialog.surface()}>
                      <input id="child-field" aria-label="Child field" />
                      <button id="child-close" mix={dialog.close()}>
                        Close child
                      </button>
                    </section>
                  </dialog.SurfaceContext>
                </dialog.Portal>
              </dialog.Context>
              <button id="close" mix={dialog.close()}>
                Close
              </button>
            </section>
          </dialog.SurfaceContext>
        </dialog.Portal>
      </dialog.Context>
      <Portal>
        <toast.Context manager={manager}>
          {(items) => (
            <section id="notifications" mix={toast.root({ label: 'Notifications' })}>
              {items.map((item) => (
                <toast.ItemContext key={item.id} value={item.id}>
                  <article mix={toast.item()}>
                    <h2 mix={toast.title()}>{item.title}</h2>
                    <button id="dismiss" mix={toast.close()}>
                      Dismiss notification
                    </button>
                  </article>
                </toast.ItemContext>
              ))}
            </section>
          )}
        </toast.Context>
      </Portal>
    </>
  )
})

function get(selector: string) {
  let node = document.querySelector<HTMLElement>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

// Hydrates a server-rendered document, then opens the modal dialog with focus in its field.
async function openModal(t: TestContext, { framed = false } = {}) {
  let original = document.documentElement.innerHTML
  let url = location.href
  let historyState = history.state
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
    history.replaceState(historyState, '', url)
    document.documentElement.innerHTML = original
  })
  await app.ready()

  get('#trigger').click()
  app.flush()
  await t.waitFor(() => expect(get('[role="dialog"]').hasAttribute('data-open')).toBe(true))
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

async function expectCloseReleases(
  t: TestContext,
  app: Awaited<ReturnType<typeof openModal>>,
  shielded: string[],
) {
  get('#close').click()
  app.flush()
  await t.waitFor(() => expect(get('[role="dialog"]').hasAttribute('data-open')).toBe(false))
  expect(getComputedStyle(document.documentElement).overflow).toBe('visible')
  for (let selector of shielded) {
    expect(get(selector).hasAttribute('inert')).toBe(false)
    expect(get(selector).hasAttribute('aria-hidden')).toBe(false)
  }
  expect(document.activeElement).toBe(get('#trigger'))
}

describe('modal dialog across frame reloads', () => {
  it('leaves the navigation focus reset alone after interaction with Toast', async (t) => {
    let app = await openModal(t)
    get('#publish').click()
    app.flush()
    get('#dismiss').focus()
    expect(document.activeElement).toBe(get('#dismiss'))

    await navigate('/next?toast-reset')

    expect(document.activeElement).toBe(document.body)
    expect(get('[role="dialog"]').hasAttribute('data-open')).toBe(true)
    expect(get('#notifications').closest('[inert], [aria-hidden="true"]')).toBe(null)

    get('#field').focus()
    await navigate('/next?modal-again')
    expect(document.activeElement).toBe(get('#field'))
  })

  it('keeps a portaled popup usable through reload and navigation', async (t) => {
    let app = await openModal(t)
    get('#popup-trigger').click()
    app.flush()
    await t.waitFor(() => expect(document.activeElement).toBe(get('#popup-field')))
    let field = get('#popup-field')
    app.frames.top.src = '/next'
    await app.frames.top.reload()
    expect(get('#popup-field')).toBe(field)
    expect(document.activeElement).toBe(field)
    await navigate('/next?popup')
    expect(document.activeElement).toBe(field)
    expect(field.closest('[inert], [aria-hidden="true"]')).toBe(null)
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    app.flush()
    await t.waitFor(() => expect(get('#popup').hasAttribute('data-open')).toBe(false))
    expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
    await expectCloseReleases(t, app, ['#header', '#main', '#footer'])
  })

  it('preserves interactive Toast focus through reload and navigation with manual focus reset', async (t) => {
    let app = await openModal(t)
    get('#publish').click()
    app.flush()
    await t.waitFor(() => expect(get('#notifications').closest('[inert]')).toBe(null))
    get('#dismiss').focus()
    app.frames.top.src = '/next'
    await app.frames.top.reload()
    expect(document.activeElement).toBe(get('#dismiss'))
    await navigate('/next?toast', { resetFocus: false })
    expect(document.activeElement).toBe(get('#dismiss'))
    expect(get('#notifications').closest('[inert], [aria-hidden="true"]')).toBe(null)
    expect(get('#main').inert).toBe(true)
    get('#dismiss').click()
    app.flush()
    await t.waitFor(() => expect(document.querySelector('#dismiss')).toBe(null))
    expect(get('[role="dialog"]').hasAttribute('data-open')).toBe(true)
    get('#field').focus()
    await expectCloseReleases(t, app, ['#header', '#main', '#footer'])
  })

  it('keeps the innermost modal focused and releases nested locks in order after navigation', async (t) => {
    let app = await openModal(t)
    get('#child-trigger').click()
    app.flush()
    await t.waitFor(() => expect(document.activeElement).toBe(get('#child-field')))
    app.frames.top.src = '/next'
    await app.frames.top.reload()
    await navigate('/next?nested')
    expect(document.activeElement).toBe(get('#child-field'))
    expect(get('#field').closest('[inert]')).not.toBe(null)
    get('#child-close').click()
    app.flush()
    await t.waitFor(() => expect(get('#child').hasAttribute('data-open')).toBe(false))
    expect(document.activeElement).toBe(get('#child-trigger'))
    expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
    get('#field').focus()
    await expectCloseReleases(t, app, ['#header', '#main', '#footer'])
  })

  it('keeps content inside a reloaded named frame inert', async (t) => {
    let app = await openModal(t, { framed: true })
    let shielded = ['#header', '#footer', '#frame-sibling']
    expectModalIntact(shielded)

    let frame = app.frames.get('content')
    if (!frame) throw new Error('Missing content frame')
    let field = get('#field')
    await frame.reload()
    expect(get('#field')).toBe(field)

    await t.waitFor(() => expectModalIntact(shielded))
    await expectCloseReleases(t, app, shielded)
  })

  it('keeps the scroll lock, shielding, and focus through a top-frame reload', async (t) => {
    let app = await openModal(t)
    let shielded = ['#header', '#main', '#footer']
    expectModalIntact(shielded)

    let field = get('#field')
    app.frames.top.src = '/next'
    await app.frames.top.reload()

    expect(get('#field')).toBe(field)
    expect(document.activeElement).toBe(get('#field'))
    expect(get('#header').textContent).toBe('Reloaded')
    await t.waitFor(() => expectModalIntact(shielded))
    await expectCloseReleases(t, app, shielded)
  })

  it('keeps the scroll lock, shielding, and focus through client navigation', async (t) => {
    if (!('navigation' in window)) return
    let app = await openModal(t)
    let shielded = ['#header', '#main', '#footer']

    let field = get('#field')
    await navigate('/next')

    expect(get('#field')).toBe(field)
    expect(document.activeElement).toBe(get('#field'))
    expect(get('#header').textContent).toBe('Reloaded')
    await t.waitFor(() => expectModalIntact(shielded))
    await expectCloseReleases(t, app, shielded)
  })
})

function Popup(handle: Handle) {
  let open = false
  return () => (
    <popover.Context>
      <button
        id="popup-trigger"
        mix={[
          popover.anchor({}),
          popover.focusOnHide(),
          on('click', () => {
            open = true
            void handle.update()
          }),
        ]}
      >
        Open popup
      </button>
      <popover.Portal>
        <popover.SurfaceContext>
          <div
            id="popup"
            mix={popover.surface({
              open,
              onHide() {
                open = false
                void handle.update()
              },
            })}
          >
            <input id="popup-field" aria-label="Popup field" mix={popover.focusOnShow()} />
          </div>
        </popover.SurfaceContext>
      </popover.Portal>
    </popover.Context>
  )
}

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
