import { clientEntry, css, on, type Handle } from 'remix/ui'

import { themeCookieMaxAge, themeCookieName, type Theme } from './theme.ts'

type ThemeToggleProps = {
  theme: Theme
}

export const ThemeToggle = clientEntry(
  import.meta.url,
  function ThemeToggle(handle: Handle<ThemeToggleProps>) {
    let theme = handle.props.theme

    return () => {
      let nextTheme: Theme = theme === 'light' ? 'dark' : 'light'

      return (
        <button
          type="button"
          aria-label={`Switch to ${nextTheme} mode`}
          mix={[
            themeToggleStyle,
            on('click', () => {
              theme = nextTheme
              document.documentElement.dataset.theme = theme
              document.body.dataset.theme = theme
              document.cookie = `${themeCookieName}=${theme}; Max-Age=${themeCookieMaxAge}; Path=/; SameSite=Lax`
              handle.update()
            }),
          ]}
        >
          <span aria-hidden="true" mix={themeIconStyle}>
            {theme === 'light' ? '☾' : '☀'}
          </span>
          <span>{nextTheme} mode</span>
        </button>
      )
    }
  },
)

const themeToggleStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  minHeight: '36px',
  border: '1px solid var(--control-border)',
  borderRadius: '6px',
  padding: '7px 12px',
  backgroundColor: 'var(--control-button-bg)',
  color: 'var(--control-text)',
  font: 'inherit',
  fontSize: '11px',
  fontWeight: 750,
  textTransform: 'capitalize',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease',
  '&:hover': {
    borderColor: 'var(--control-border-hover)',
    backgroundColor: 'var(--control-button-hover)',
  },
  '&:focus-visible': {
    outline: '3px solid var(--focus-ring)',
    outlineOffset: '2px',
  },
})

const themeIconStyle = css({
  fontSize: '16px',
  lineHeight: 1,
})
