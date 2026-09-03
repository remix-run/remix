import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { motionArtifact } from './data/exhibits.ts'
import { router } from './router.ts'
import { routes } from './routes.ts'
import { themeCookieName } from './ui/public/theme.ts'

describe('lazy frame routes', () => {
  it('server-renders the eager artifact once', async () => {
    let response = await router.fetch(new Request(`http://localhost${routes.home.href()}`))
    let document = await response.text()

    assert.equal(response.status, 200)
    assert.equal(document.split(`data-motion-artifact="${motionArtifact.id}"`).length - 1, 1)
  })

  it('server-renders the saved theme', async () => {
    let response = await router.fetch(
      new Request(`http://localhost${routes.home.href()}`, {
        headers: { Cookie: `${themeCookieName}=dark` },
      }),
    )

    assert.match(await response.text(), /<html[^>]+data-theme="dark"/)
  })

  it('applies the latency cookie to subsequent requests', async () => {
    let toggleResponse = await router.fetch(
      new Request(`http://localhost${routes.latency.href()}`, {
        method: 'POST',
        body: new URLSearchParams({ enabled: 'true' }),
      }),
    )
    let setCookie = toggleResponse.headers.get('Set-Cookie')

    assert.ok(setCookie)

    let headers = { Cookie: setCookie.slice(0, setCookie.indexOf(';')) }
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
  })

  it('serves each Frame response type as HTML', async () => {
    let htmlResponse = await router.fetch(
      new Request(`http://localhost${routes.frames.html.href({ id: 'field-notes' })}`),
    )
    let uiResponse = await router.fetch(
      new Request(`http://localhost${routes.frames.ui.href({ id: 'signal-board' })}`),
    )
    let interactiveResponse = await router.fetch(
      new Request(`http://localhost${routes.frames.interactive.href({ id: 'retained-counter' })}`),
    )

    assertHtmlResponse(htmlResponse)
    assertHtmlResponse(uiResponse)
    assertHtmlResponse(interactiveResponse)
  })
})

function assertHtmlResponse(response: Response) {
  assert.equal(response.status, 200)
  assert.match(response.headers.get('Content-Type') ?? '', /^text\/html/)
}
