import type { TFunction } from 'i18next'
import { createCookie } from 'remix/cookie'

import en, { type Translation } from './locales/en.ts'
import es from './locales/es.ts'
import fr from './locales/fr.ts'
import ja from './locales/ja.ts'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: Translation
    }
  }
}

export const supportedLanguages = ['en', 'es', 'fr', 'ja'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

export type DetectionSource = 'path' | 'cookie' | 'header' | 'fallback'

export interface DetectionResult {
  locale: SupportedLanguage
  source: DetectionSource
}

export interface I18nState {
  locale: SupportedLanguage
  detectionSource: DetectionSource
  t: TFunction
}

export const fallbackLanguage: SupportedLanguage = 'en'

export const languageNames = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  ja: '日本語',
} satisfies Record<SupportedLanguage, string>

export const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  ja: { translation: ja },
} satisfies Record<SupportedLanguage, { translation: Translation }>

// The locale is a non-sensitive preference, so this cookie does not need a signature.
export const localeCookie = createCookie('locale', {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 365,
  path: '/',
  sameSite: 'Lax',
  secure: process.env.NODE_ENV === 'production',
})

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && supportedLanguages.some((language) => language === value)
}
