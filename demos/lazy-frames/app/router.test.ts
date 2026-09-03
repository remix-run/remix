import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { exhibits, motionArtifact } from './data/exhibits.ts'
import { router } from './router.ts'
import { routes } from './routes.ts'
import { themeCookieName } from './ui/public/theme.ts'

describe('lazy frame routes', () => {
  it('server-renders the eager artifact while leaving lazy frames unresolved', async () => {
    let response = await router.fetch(new Request(`http://localhost${routes.home.href()}`))
    let document = await response.text()

    assert.equal(response.status, 200)
    assert.equal(count(document, '>Not requested<'), exhibits.length + 1)
    assert.equal(count(document, `data-motion-artifact="${motionArtifact.id}"`), 1)
    assert.equal(count(document, '@keyframes lazy-frames-motion-orbit'), 1)
    assert.equal(document.includes('class="plain-frame"'), false)
    assert.match(document, /The browser will request this Frame inside the preload margin/)
  })

  it('server-renders the saved color theme', async () => {
    let response = await router.fetch(
      new Request(`http://localhost${routes.home.href()}`, {
        headers: { Cookie: `${themeCookieName}=dark` },
      }),
    )
    let document = await response.text()

    assert.equal(response.status, 200)
    assert.match(document, /<html[^>]+data-theme="dark"/)
    assert.match(document, /<body[^>]+data-theme="dark"/)
  })

  it('stores the global latency toggle in a cookie and delays subsequent routes', async () => {
    let toggleResponse = await router.fetch(
      new Request(`http://localhost${routes.latency.href()}`, {
        method: 'POST',
        body: new URLSearchParams({ enabled: 'true' }),
      }),
    )

    assert.equal(toggleResponse.status, 303)
    assert.equal(toggleResponse.headers.get('Location'), routes.home.href())

    let setCookie = toggleResponse.headers.get('Set-Cookie')
    assert.ok(setCookie)
    let cookie = toCookieHeader(setCookie)
    let headers = { Cookie: cookie }

    let homeResponse = await router.fetch(
      new Request(`http://localhost${routes.home.href()}`, { headers }),
    )
    let frameResponse = await router.fetch(
      new Request(`http://localhost${routes.frames.html.href({ id: 'field-notes' })}`, {
        headers,
      }),
    )

    assert.equal(homeResponse.headers.get('Server-Timing'), 'demo-latency;dur=20')
    assert.equal(frameResponse.headers.get('Server-Timing'), 'demo-latency;dur=20')
    assert.match(await homeResponse.text(), /Global latency on/)
  })

  it('serves plain HTML, Remix UI, and interactive Remix UI frame bodies', async () => {
    let htmlResponse = await router.fetch(
      new Request(`http://localhost${routes.frames.html.href({ id: 'field-notes' })}`),
    )
    let uiResponse = await router.fetch(
      new Request(`http://localhost${routes.frames.ui.href({ id: 'signal-board' })}`),
    )
    let interactiveResponse = await router.fetch(
      new Request(`http://localhost${routes.frames.interactive.href({ id: 'retained-counter' })}`),
    )

    assert.match(htmlResponse.headers.get('Content-Type') ?? '', /^text\/html/)
    let htmlFragment = await htmlResponse.text()
    assert.match(htmlFragment, /class="plain-frame"/)
    assert.match(htmlFragment, /field-notes\.html/)
    assert.match(htmlFragment, /openLazyFile\(\)/)
    assert.match(await uiResponse.text(), /Response types in this demo/)

    let interactiveHtml = await interactiveResponse.text()
    assert.match(interactiveHtml, /Leaving the viewport does not unmount/)
    assert.match(interactiveHtml, /Hydrating client component/)
  })
})

function toCookieHeader(setCookie: string): string {
  let separator = setCookie.indexOf(';')
  return separator === -1 ? setCookie : setCookie.slice(0, separator)
}

function count(value: string, match: string): number {
  return value.split(match).length - 1
}
