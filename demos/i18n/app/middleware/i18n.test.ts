import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { localeCookie } from '../i18n/config.ts'
import { detectLanguage } from './i18n.ts'

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
      { locale: 'fr', source: 'browser' },
    )
    assert.deepEqual(await detectLanguage(new Request(origin)), {
      locale: 'en',
      source: 'browser',
    })
  })

  it('ignores invalid cookies and negotiates supported languages by quality', async () => {
    let request = new Request(origin, {
      headers: {
        Cookie: 'locale=not-base64!',
        'Accept-Language': 'de,fr;q=0,es-MX;q=0.8,en;q=0.5',
      },
    })

    assert.deepEqual(await detectLanguage(request), { locale: 'es', source: 'browser' })
  })
})
