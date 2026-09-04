import { createInstance } from 'i18next'
import { Vary } from 'remix/headers'
import { AcceptLanguage } from 'remix/headers/accept-language'
import { createContextKey, type Middleware } from 'remix/router'

import {
  fallbackLanguage,
  isSupportedLanguage,
  localeCookie,
  resources,
  supportedLanguages,
  type DetectionResult,
  type I18nState,
} from '../i18n/config.ts'

const requestI18n = createContextKey<I18nState>()

/**
 * Resolves a locale in this order: URL path, preference cookie,
 * Accept-Language header, then the configured fallback.
 */
export async function detectLanguage(
  request: Request,
  pathLocale?: unknown,
): Promise<DetectionResult> {
  if (isSupportedLanguage(pathLocale)) {
    return { locale: pathLocale, source: 'path' }
  }

  let cookieLocale = await localeCookie.parse(request.headers.get('Cookie'))
  if (isSupportedLanguage(cookieLocale)) {
    return { locale: cookieLocale, source: 'cookie' }
  }

  let preferredLocale = AcceptLanguage.from(request.headers.get('Accept-Language')).getPreferred(
    supportedLanguages,
  )
  if (preferredLocale) {
    return { locale: preferredLocale, source: 'header' }
  }

  return { locale: fallbackLanguage, source: 'fallback' }
}

/**
 * Creates a request-local i18next instance so concurrent requests cannot
 * change each other's active language.
 */
export function i18nMiddleware(): Middleware<{
  key: typeof requestI18n
  value: I18nState
  property: 'i18n'
}> {
  return async (context, next) => {
    let pathLocale = context.params.locale
    if (pathLocale !== undefined && !isSupportedLanguage(pathLocale)) {
      return new Response('Not Found', { status: 404 })
    }

    let { locale, source } = await detectLanguage(context.request, pathLocale)
    let instance = createInstance()

    await instance.init({
      lng: locale,
      fallbackLng: fallbackLanguage,
      supportedLngs: supportedLanguages,
      resources,
      interpolation: {
        // Remix UI escapes rendered text, so i18next must not escape it first.
        escapeValue: false,
      },
    })

    context.set(
      requestI18n,
      {
        locale,
        detectionSource: source,
        t: instance.getFixedT(locale),
      },
      { property: 'i18n' },
    )

    let response = await next()
    if (response.headers.get('Content-Type')?.startsWith('text/html')) {
      response.headers.set('Content-Language', locale)

      if (source !== 'path') {
        let vary = Vary.from(response.headers.get('Vary'))
        vary.add('Accept-Language')
        vary.add('Cookie')
        response.headers.set('Vary', vary.toString())
      }
    }

    return response
  }
}
