import * as assert from 'remix/assert'
import { createRouter } from 'remix/router'
import { describe, it } from 'remix/test'

import { localeCookie, type SupportedLanguage } from '../i18n/config.ts'
import { detectLanguage, i18nMiddleware } from './i18n.ts'

const origin = 'http://localhost:44100'

async function getCookieHeader(locale: SupportedLanguage): Promise<string> {
  return (await localeCookie.serialize(locale)).split(';', 1)[0]
}

describe('detectLanguage()', () => {
  it('detects language from the URL path', async () => {
    let result = await detectLanguage(new Request(origin), 'es')

    assert.deepEqual(result, { locale: 'es', source: 'path' })
  })

  it('detects language from the preference cookie', async () => {
    let cookie = await getCookieHeader('fr')
    let request = new Request(origin, { headers: { Cookie: cookie } })

    assert.deepEqual(await detectLanguage(request), { locale: 'fr', source: 'cookie' })
  })

  it('matches a regional Accept-Language value to a supported base language', async () => {
    let request = new Request(origin, {
      headers: { 'Accept-Language': 'ja-JP,en;q=0.8' },
    })

    assert.deepEqual(await detectLanguage(request), { locale: 'ja', source: 'header' })
  })

  it('falls back when no supported language is requested', async () => {
    let request = new Request(origin, {
      headers: { 'Accept-Language': 'de-DE,de;q=0.9' },
    })

    assert.deepEqual(await detectLanguage(request), { locale: 'en', source: 'fallback' })
  })

  it('prefers the URL path over the cookie and header', async () => {
    let cookie = await getCookieHeader('es')
    let request = new Request(origin, {
      headers: {
        Cookie: cookie,
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    })

    assert.deepEqual(await detectLanguage(request, 'ja'), { locale: 'ja', source: 'path' })
  })

  it('prefers the cookie over the header', async () => {
    let cookie = await getCookieHeader('es')
    let request = new Request(origin, {
      headers: {
        Cookie: cookie,
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    })

    assert.deepEqual(await detectLanguage(request), { locale: 'es', source: 'cookie' })
  })
})

describe('i18nMiddleware()', () => {
  it('provides the route locale and a fixed translator in request context', async () => {
    let router = createRouter()

    router.get('/(:locale)', {
      middleware: [i18nMiddleware()],
      handler({ i18n }) {
        return new Response(
          [
            i18n.locale,
            i18n.t('hero.welcome_user', { name: 'Ada' }),
            i18n.t('pluralization.tasks', { count: 3 }),
          ].join('|'),
        )
      },
    })

    let response = await router.fetch(new Request(`${origin}/es`))

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'es|¡Bienvenido de nuevo, Ada!|Tienes 3 tareas pendientes')
  })

  it('isolates translators across concurrent requests', async () => {
    let router = createRouter()

    router.get('/:locale/test', {
      middleware: [i18nMiddleware()],
      handler({ i18n }) {
        return new Response([i18n.locale, i18n.t('pluralization.tasks', { count: 1 })].join('|'))
      },
    })

    let [esResponse, jaResponse, frResponse] = await Promise.all([
      router.fetch(new Request(`${origin}/es/test`)),
      router.fetch(new Request(`${origin}/ja/test`)),
      router.fetch(new Request(`${origin}/fr/test`)),
    ])

    assert.equal(await esResponse.text(), 'es|Tienes 1 tarea pendiente')
    assert.equal(await jaResponse.text(), 'ja|1 件の保留中タスクがあります')
    assert.equal(await frResponse.text(), 'fr|Vous avez 1 tâche en attente')
  })

  it('rejects an unsupported route locale', async () => {
    let router = createRouter()

    router.get('/(:locale)', {
      middleware: [i18nMiddleware()],
      handler() {
        return new Response('OK')
      },
    })

    let response = await router.fetch(new Request(`${origin}/de`))

    assert.equal(response.status, 404)
  })
})
