import type { Handle } from 'remix/ui'

import { languageNames, supportedLanguages, type I18nState } from '../i18n/config.ts'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import * as styles from '../ui/styles.ts'

const demoDate = new Date(Date.UTC(2026, 3, 15, 14, 30))
const demoCurrency = 'USD'

interface HomePageProps {
  i18n: I18nState
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { locale, t, detectionSource } = handle.props.i18n
    let formattedDate = new Intl.DateTimeFormat(locale, {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(demoDate)
    let formattedNumber = new Intl.NumberFormat(locale).format(1250000)
    let formattedCurrency = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: demoCurrency,
    }).format(49.99)
    let formattedRelativeTime = new Intl.RelativeTimeFormat(locale, {
      numeric: 'auto',
    }).format(-3, 'day')

    return (
      <Document lang={locale} title={t('common.title')}>
        <div mix={styles.pageWrapper}>
          <header mix={styles.header}>
            <a href={routes.home.href()} mix={styles.brandGroup}>
              <span mix={styles.logo} aria-hidden="true">
                🌐
              </span>
              <span mix={styles.brandTitle}>{t('common.brand')}</span>
            </a>

            <form method="POST" action={routes.language.href()} mix={styles.switcherForm}>
              <label htmlFor="locale-select" mix={styles.srOnly}>
                {t('switcher.label')}
              </label>
              {/* Reset the live form control when frame navigation changes the locale. */}
              <select
                id="locale-select"
                name="locale"
                data-rmx-key={`locale-select-${locale}`}
                mix={styles.select}
              >
                {supportedLanguages.map((code) => (
                  <option key={code} value={code} selected={code === locale} lang={code}>
                    {languageNames[code]}
                  </option>
                ))}
              </select>
              <button type="submit" mix={styles.button}>
                {t('switcher.button')}
              </button>
              <button type="submit" name="intent" value="clear" mix={styles.clearPreferenceButton}>
                {t('switcher.clear_preference')}
              </button>
            </form>
          </header>

          <main>
            <section mix={styles.hero}>
              <div mix={styles.eyebrowBadge}>{t('hero.tagline')}</div>
              <h1 mix={styles.heroHeading}>{t('hero.heading')}</h1>
              <p mix={styles.heroDescription}>{t('hero.description')}</p>
              <div mix={styles.heroWelcome}>
                <span aria-hidden="true">👋</span>
                <span>{t('hero.welcome_user', { name: 'Ada Lovelace' })}</span>
              </div>
            </section>

            <nav aria-label={t('switcher.quick_switch')} mix={styles.quickSwitchContainer}>
              <span mix={styles.quickSwitchLabel}>{t('switcher.quick_switch')}:</span>
              {supportedLanguages.map((code) => (
                <a
                  key={code}
                  href={routes.home.href({ locale: code })}
                  hrefLang={code}
                  lang={code}
                  mix={styles.quickSwitchPill}
                  aria-current={code === locale ? 'true' : undefined}
                >
                  {languageNames[code]}
                </a>
              ))}
            </nav>

            <div mix={styles.grid}>
              <section mix={styles.card}>
                <div mix={styles.cardHeader}>
                  <span mix={styles.cardIcon} aria-hidden="true">
                    🔍
                  </span>
                  <h2 mix={styles.cardTitle}>{t('detection.title')}</h2>
                </div>
                <p mix={styles.cardDescription}>{t('detection.description')}</p>

                <ol mix={styles.stepList}>
                  <li
                    mix={styles.stepItem}
                    data-active={detectionSource === 'path' ? 'true' : undefined}
                  >
                    <span>{t('detection.step_path')}</span>
                    {detectionSource === 'path' && (
                      <span mix={styles.activeBadge}>{t('detection.active_badge')}</span>
                    )}
                  </li>
                  <li
                    mix={styles.stepItem}
                    data-active={detectionSource === 'cookie' ? 'true' : undefined}
                  >
                    <span>{t('detection.step_cookie')}</span>
                    {detectionSource === 'cookie' && (
                      <span mix={styles.activeBadge}>{t('detection.active_badge')}</span>
                    )}
                  </li>
                  <li
                    mix={styles.stepItem}
                    data-active={detectionSource === 'header' ? 'true' : undefined}
                  >
                    <span>{t('detection.step_header')}</span>
                    {detectionSource === 'header' && (
                      <span mix={styles.activeBadge}>{t('detection.active_badge')}</span>
                    )}
                  </li>
                </ol>

                <div mix={styles.demoRow}>
                  <span mix={styles.demoLabel}>{t('detection.active_source')}:</span>
                  <span mix={styles.demoValue}>{t(`detection.source_${detectionSource}`)}</span>
                </div>
              </section>

              <section mix={styles.card}>
                <div mix={styles.cardHeader}>
                  <span mix={styles.cardIcon} aria-hidden="true">
                    🔢
                  </span>
                  <h2 mix={styles.cardTitle}>{t('pluralization.title')}</h2>
                </div>
                <p mix={styles.cardDescription}>{t('pluralization.description')}</p>

                <div mix={styles.demoRows}>
                  <div mix={styles.demoRow}>
                    <span mix={styles.demoLabel}>count = 0</span>
                    <span mix={styles.demoValue}>{t('pluralization.tasks', { count: 0 })}</span>
                  </div>
                  <div mix={styles.demoRow}>
                    <span mix={styles.demoLabel}>count = 1</span>
                    <span mix={styles.demoValue}>{t('pluralization.tasks', { count: 1 })}</span>
                  </div>
                  <div mix={styles.demoRow}>
                    <span mix={styles.demoLabel}>count = 5</span>
                    <span mix={styles.demoValue}>{t('pluralization.tasks', { count: 5 })}</span>
                  </div>
                  <div mix={styles.demoRow}>
                    <span mix={styles.demoLabel}>cart = 0</span>
                    <span mix={styles.demoValue}>{t('pluralization.cart', { count: 0 })}</span>
                  </div>
                  <div mix={styles.demoRow}>
                    <span mix={styles.demoLabel}>cart = 3</span>
                    <span mix={styles.demoValue}>{t('pluralization.cart', { count: 3 })}</span>
                  </div>
                </div>
              </section>

              <section mix={styles.card}>
                <div mix={styles.cardHeader}>
                  <span mix={styles.cardIcon} aria-hidden="true">
                    📅
                  </span>
                  <h2 mix={styles.cardTitle}>{t('formatting.title')}</h2>
                </div>
                <p mix={styles.cardDescription}>
                  {t('formatting.description', { language: languageNames[locale] })}
                </p>

                <div mix={styles.demoRows}>
                  <div mix={styles.demoRow}>
                    <span mix={styles.demoLabel}>{t('formatting.date_label')}</span>
                    <span mix={styles.demoValue}>{formattedDate}</span>
                  </div>
                  <div mix={styles.demoRow}>
                    <span mix={styles.demoLabel}>{t('formatting.number_label')}</span>
                    <span mix={styles.demoValue}>{formattedNumber}</span>
                  </div>
                  <div mix={styles.demoRow}>
                    <span mix={styles.demoLabel}>{t('formatting.currency_label')}</span>
                    <span mix={styles.demoValue}>{formattedCurrency}</span>
                  </div>
                  <div mix={styles.demoRow}>
                    <span mix={styles.demoLabel}>{t('formatting.relative_time_label')}</span>
                    <span mix={styles.demoValue}>{formattedRelativeTime}</span>
                  </div>
                </div>
              </section>
            </div>
          </main>

          <footer mix={styles.footer}>
            <p>{t('footer.note')}</p>
          </footer>
        </div>
      </Document>
    )
  }
}
