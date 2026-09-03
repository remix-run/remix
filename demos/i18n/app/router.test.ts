import * as assert from 'remix/assert'
import { Vary } from 'remix/headers'
import { describe, it } from 'remix/test'

import { scriptSrc } from './assets.ts'
import { localeCookie, type SupportedLanguage } from './i18n/config.ts'
import { createAppRouter } from './router.ts'
import { routes } from './routes.ts'

const origin = 'http://localhost:44100'

async function getCookieHeader(locale: SupportedLanguage): Promise<string> {
  return (await localeCookie.serialize(locale)).split(';', 1)[0]
}

describe('i18n app', () => {
  it('sets localization headers for negotiated and explicit locales', async () => {
    let router = createAppRouter()
    let negotiatedResponse = await router.fetch(new Request(origin + routes.home.href()))
    let explicitResponse = await router.fetch(
      new Request(origin + routes.home.href({ locale: 'es' }), {
        headers: {
          Cookie: await getCookieHeader('ja'),
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
      }),
    )

    assert.equal(negotiatedResponse.status, 200)
    assert.equal(negotiatedResponse.headers.get('Content-Language'), 'en')
    let vary = Vary.from(negotiatedResponse.headers.get('Vary'))
    assert.equal(vary.has('Accept-Language'), true)
    assert.equal(vary.has('Cookie'), true)

    assert.equal(explicitResponse.status, 200)
    assert.equal(explicitResponse.headers.get('Content-Language'), 'es')
    assert.equal(explicitResponse.headers.get('Vary'), null)
  })

  it('serves the browser entry', async () => {
    let response = await createAppRouter().fetch(new Request(origin + scriptSrc))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/javascript; charset=utf-8')
  })

  it('saves a language preference', async () => {
    let formData = new FormData()
    formData.set('locale', 'fr')
    let response = await createAppRouter().fetch(
      new Request(origin + routes.language.href(), {
        method: 'POST',
        body: formData,
      }),
    )

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.home.href({ locale: 'fr' }))
    assert.equal(await localeCookie.parse(response.headers.get('Set-Cookie')), 'fr')
  })

  it('clears a language preference', async () => {
    let formData = new FormData()
    formData.set('intent', 'clear')
    let response = await createAppRouter().fetch(
      new Request(origin + routes.language.href(), {
        method: 'POST',
        headers: { Cookie: await getCookieHeader('fr') },
        body: formData,
      }),
    )

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.home.href())
    assert.match(response.headers.get('Set-Cookie') ?? '', /Max-Age=0/)
  })

  it('rejects unsupported locales', async () => {
    let formData = new FormData()
    formData.set('locale', 'de')
    let router = createAppRouter()
    let [pathResponse, preferenceResponse] = await Promise.all([
      router.fetch(new Request(`${origin}/de`)),
      router.fetch(
        new Request(origin + routes.language.href(), {
          method: 'POST',
          body: formData,
        }),
      ),
    ])

    assert.equal(pathResponse.status, 404)
    assert.equal(preferenceResponse.status, 400)
  })
})
