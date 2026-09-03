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
  it('renders the fallback language with localization response headers', async () => {
    let router = createAppRouter()
    let response = await router.fetch(new Request(origin + routes.home.href()))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Language'), 'en')

    let vary = Vary.from(response.headers.get('Vary'))
    assert.equal(vary.has('Accept-Language'), true)
    assert.equal(vary.has('Cookie'), true)

    let html = await response.text()
    assert.match(html, /<html lang="en">/)
    assert.match(html, /Internationalize your Remix app with i18next/)
    assert.match(html, /Welcome back, Ada Lovelace!/)
    assert.ok(html.includes('href="/en" hreflang="en"'))
    assert.ok(html.includes(`<script type="module" src="${scriptSrc}"></script>`))
  })

  it('serves the Remix browser runtime entry', async () => {
    let router = createAppRouter()
    let response = await router.fetch(new Request(origin + scriptSrc))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/javascript; charset=utf-8')
    assert.ok((await response.text()).length > 0)
  })

  it('renders a locale-prefixed URL independently of request preferences', async () => {
    let router = createAppRouter()
    let cookie = await getCookieHeader('ja')
    let href = routes.home.href({ locale: 'es' })
    let response = await router.fetch(
      new Request(origin + href, {
        headers: {
          Cookie: cookie,
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
      }),
    )

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Language'), 'es')
    assert.equal(response.headers.get('Vary'), null)

    let html = await response.text()
    assert.match(html, /<html lang="es">/)
    assert.match(html, /Internacionaliza tu aplicación Remix con i18next/)
    assert.match(html, /¡Bienvenido de nuevo, Ada Lovelace!/)
  })

  it('renders the language stored in the preference cookie at the locale-less URL', async () => {
    let router = createAppRouter()
    let cookie = await getCookieHeader('ja')
    let response = await router.fetch(
      new Request(origin + routes.home.href(), {
        headers: { Cookie: cookie },
      }),
    )

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Language'), 'ja')

    let html = await response.text()
    assert.match(html, /<html lang="ja">/)
    assert.match(html, /i18next で Remix アプリを多言語対応/)
    assert.match(html, /お帰りなさい、Ada Lovelace さん！/)
  })

  it('renders the explicit English URL independently of request preferences', async () => {
    let router = createAppRouter()
    let cookie = await getCookieHeader('ja')
    let response = await router.fetch(
      new Request(origin + routes.home.href({ locale: 'en' }), {
        headers: {
          Cookie: cookie,
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
      }),
    )

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Language'), 'en')
    assert.equal(response.headers.get('Vary'), null)

    let html = await response.text()
    assert.match(html, /<html lang="en">/)
    assert.match(html, /Internationalize your Remix app with i18next/)
  })

  it('stores a language preference and redirects to its localized URL', async () => {
    let router = createAppRouter()
    let formData = new FormData()
    formData.set('locale', 'fr')

    let response = await router.fetch(
      new Request(origin + routes.language.href(), {
        method: 'POST',
        body: formData,
      }),
    )

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.home.href({ locale: 'fr' }))

    let setCookie = response.headers.get('Set-Cookie')
    assert.ok(setCookie)
    assert.equal(await localeCookie.parse(setCookie.split(';', 1)[0]), 'fr')
    assert.match(setCookie, /HttpOnly/)
    assert.match(setCookie, /SameSite=Lax/)
  })

  it('redirects the English language preference to its localized URL', async () => {
    let router = createAppRouter()
    let formData = new FormData()
    formData.set('locale', 'en')

    let response = await router.fetch(
      new Request(origin + routes.language.href(), {
        method: 'POST',
        body: formData,
      }),
    )

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.home.href({ locale: 'en' }))
  })

  it('clears the saved language preference and redirects to the locale-less URL', async () => {
    let router = createAppRouter()
    let formData = new FormData()
    formData.set('locale', 'fr')
    formData.set('intent', 'clear')

    let response = await router.fetch(
      new Request(origin + routes.language.href(), {
        method: 'POST',
        headers: { Cookie: await getCookieHeader('fr') },
        body: formData,
      }),
    )

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.home.href())

    let setCookie = response.headers.get('Set-Cookie')
    assert.ok(setCookie)
    assert.equal(await localeCookie.parse(setCookie.split(';', 1)[0]), '')
    assert.match(setCookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/)
    assert.match(setCookie, /Max-Age=0/)
  })

  it('rejects an unsupported locale prefix', async () => {
    let router = createAppRouter()
    let response = await router.fetch(new Request(`${origin}/de`))

    assert.equal(response.status, 404)
  })

  it('rejects an unsupported language preference', async () => {
    let router = createAppRouter()
    let formData = new FormData()
    formData.set('locale', 'invalid-lang')

    let response = await router.fetch(
      new Request(origin + routes.language.href(), {
        method: 'POST',
        body: formData,
      }),
    )

    assert.equal(response.status, 400)
  })
})
