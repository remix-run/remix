import * as assert from 'remix/assert'
import { Vary } from 'remix/headers'
import { describe, it } from 'remix/test'

import { scriptEntry } from './assets.ts'
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

  it('renders concurrent requests with localized metadata and plural forms', async () => {
    let router = createAppRouter()
    let locales = ['ja', 'ar', 'fr', 'es'] as const
    let [japanese, arabic, french, spanish] = await Promise.all(
      locales.map(async (locale) => {
        let response = await router.fetch(new Request(origin + routes.home.href({ locale })))
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('Content-Language'), locale)
        return response.text()
      }),
    )

    assert.match(japanese, /<html lang="ja" dir="ltr">/)
    assert.match(japanese, /<title>Remix i18n デモ<\/title>/)
    assert.match(japanese, /1 件の保留中タスクがあります/)
    assert.match(arabic, /<html lang="ar" dir="rtl">/)
    assert.match(arabic, /<title>مثال التدويل في Remix<\/title>/)
    assert.match(arabic, /سلة تسوق تفاعلية/)
    assert.match(arabic, /سلة التسوق فارغة/)
    assert.match(arabic, /ليس لديك مهام معلقة/)
    assert.match(arabic, /لديك مهمة واحدة معلقة/)
    assert.match(arabic, /لديك مهمتان معلقتان/)
    assert.match(arabic, /لديك 5 مهام معلقة/)
    assert.match(arabic, /لديك 11 مهمة معلقة/)
    assert.match(arabic, /لديك 100 مهمة معلقة/)
    assert.match(french, /Vous avez 1000000 tâches en attente/)
    assert.match(spanish, /Tienes 1000000 tareas pendientes/)
  })

  it('serves the browser entry', async () => {
    let response = await createAppRouter().fetch(new Request(origin + scriptEntry.href))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/javascript; charset=utf-8')
  })

  it('saves a language preference', async () => {
    let formData = new FormData()
    formData.set('intent', 'save')
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
    formData.set('intent', 'save')
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
