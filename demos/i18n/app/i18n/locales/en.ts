const en = {
  common: {
    title: 'Remix i18n Demo',
    brand: 'Remix i18n',
  },
  hero: {
    tagline: 'Request-Scoped Internationalization',
    heading: 'Internationalize your Remix app with i18next',
    description:
      'Use i18next directly with request-scoped translation instances, explicit language preferences, and the standard Intl API.',
    welcome_user: 'Welcome back, {{name}}!',
  },
  switcher: {
    label: 'Preferred language',
    button: 'Save preference',
    clear_preference: 'Clear saved preference',
    quick_switch: 'View this page in',
  },
  detection: {
    title: 'Language detection order',
    description: 'This request resolved its language using the following priority order:',
    step_path: '1. Localized URL path (/:locale)',
    step_cookie: '2. Preference cookie (locale=...)',
    step_header: '3. Browser language preference (Accept-Language)',
    step_fallback: '4. Default language (en)',
    active_source: 'Active detection source',
    active_badge: 'Active',
    source_path: 'Localized URL path (/:locale)',
    source_cookie: 'Preference cookie (locale=...)',
    source_header: 'Browser language preference (Accept-Language)',
    source_fallback: 'Default fallback language',
  },
  pluralization: {
    title: 'Pluralization & counts',
    description: 'i18next handles plural rules based on the active language:',
    tasks_zero: 'You have no pending tasks',
    tasks_one: 'You have 1 pending task',
    tasks_other: 'You have {{count}} pending tasks',
    cart_zero: 'Your cart is empty',
    cart_one: 'You have 1 item in your cart',
    cart_other: 'You have {{count}} items in your cart',
  },
  formatting: {
    title: 'Localized dates & numbers',
    description:
      'Translations supply copy; standard JavaScript Intl APIs format values for {{language}}.',
    date_label: 'Date (Intl.DateTimeFormat)',
    number_label: 'Number (Intl.NumberFormat)',
    currency_label: 'USD value (Intl.NumberFormat)',
    relative_time_label: 'Relative time (Intl.RelativeTimeFormat)',
    preview_description:
      'This browser widget receives translated labels and a locale, not a translator. Its value survives language links; its labels and number format update.',
    preview_button: 'Increase value',
    preview_value: 'Browser-formatted value',
  },
  footer: {
    note: 'Remix v3 • Built with Web Standards & i18next',
  },
}

// Plural categories belong to each language; _zero is also an i18next override for zero counts.
export type Translation<category extends Intl.LDMLPluralRule> = Omit<typeof en, 'pluralization'> & {
  pluralization: Pick<typeof en.pluralization, 'title' | 'description'> &
    Record<`${'tasks' | 'cart'}_${category | 'zero'}`, string>
}

export default en
