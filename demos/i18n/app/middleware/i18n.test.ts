import type { TFunction } from 'i18next'
import * as assert from 'remix/assert'
import { createRouter } from 'remix/router'
import { describe, it } from 'remix/test'

import { localeCookie } from '../i18n/config.ts'
import { detectLanguage, i18nMiddleware } from './i18n.ts'

const origin = 'http://localhost:44100'

describe('i18n middleware', () => {
  it('detects language in priority order', async () => {
    let cookie = (await localeCookie.serialize('es')).split(';', 1)[0]
    let request = new Request(origin, {
      headers: {
        Cookie: cookie,
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    })

    assert.deepEqual(await detectLanguage(request, 'ja'), { locale: 'ja', source: 'path' })
    assert.deepEqual(await detectLanguage(request), { locale: 'es', source: 'cookie' })
    assert.deepEqual(
      await detectLanguage(
        new Request(origin, { headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' } }),
      ),
      { locale: 'fr', source: 'header' },
    )
    assert.deepEqual(await detectLanguage(new Request(origin)), {
      locale: 'en',
      source: 'fallback',
    })
  })

  it('creates a translator for each request', async () => {
    let translators = new Set<TFunction>()
    let router = createRouter()

    router.get('/:locale', {
      middleware: [i18nMiddleware()],
      handler({ i18n }) {
        translators.add(i18n.t)
        return new Response()
      },
    })

    await Promise.all([
      router.fetch(new Request(`${origin}/es`)),
      router.fetch(new Request(`${origin}/ja`)),
    ])

    assert.equal(translators.size, 2)
  })
})
