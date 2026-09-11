import type { i18n } from 'i18next'
import { createCookie } from 'remix/cookie'

import ar from './locales/ar.ts'
import en, { type Translation } from './locales/en.ts'
import es from './locales/es.ts'
import fr from './locales/fr.ts'
import ja from './locales/ja.ts'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: typeof en
    }
  }
}

export const supportedLanguages = ['en', 'es', 'fr', 'ja', 'ar'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

export type DetectionSource = 'path' | 'cookie' | 'header' | 'fallback'

export interface DetectionResult {
  locale: SupportedLanguage
  source: DetectionSource
}

export const fallbackLanguage: SupportedLanguage = 'en'

export const languageNames = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  ja: '日本語',
  ar: 'العربية',
} satisfies Record<SupportedLanguage, string>

export const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  ja: { translation: ja },
  ar: { translation: ar },
} satisfies Record<SupportedLanguage, { translation: Translation<'other'> }>

export type TranslationTable = (typeof resources)[SupportedLanguage]['translation']

type StringKey<value> = Extract<keyof value, string>

export interface TranslationGetter {
  <section extends StringKey<TranslationTable>>(path: section): TranslationTable[section]
  <section extends StringKey<TranslationTable>, key extends StringKey<TranslationTable[section]>>(
    path: `${section}.${key}`,
  ): TranslationTable[section][key]
  <
    section extends StringKey<TranslationTable>,
    key extends StringKey<TranslationTable[section]>,
    nestedKey extends StringKey<TranslationTable[section][key]>,
  >(
    path: `${section}.${key}.${nestedKey}`,
  ): TranslationTable[section][key][nestedKey]
}

export type Translator = ReturnType<i18n['getFixedT']> & {
  get: TranslationGetter
}

export interface I18nState {
  locale: SupportedLanguage
  direction: 'ltr' | 'rtl'
  detectionSource: DetectionSource
  t: Translator
}

export function createTranslator(instance: i18n, locale: SupportedLanguage): Translator {
  let translation = resources[locale].translation

  function get<section extends StringKey<TranslationTable>>(
    path: section,
  ): TranslationTable[section]
  function get<
    section extends StringKey<TranslationTable>,
    key extends StringKey<TranslationTable[section]>,
  >(path: `${section}.${key}`): TranslationTable[section][key]
  function get<
    section extends StringKey<TranslationTable>,
    key extends StringKey<TranslationTable[section]>,
    nestedKey extends StringKey<TranslationTable[section][key]>,
  >(path: `${section}.${key}.${nestedKey}`): TranslationTable[section][key][nestedKey]
  function get(path: string): unknown {
    let value: unknown = translation

    for (let segment of path.split('.')) {
      if (value === null || typeof value !== 'object' || !(segment in value)) return undefined
      value = Reflect.get(value, segment)
    }

    return value
  }

  return Object.assign(instance.getFixedT(locale), { get })
}

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
