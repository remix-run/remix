import type { Handle } from 'remix/ui'
import { css, on } from 'remix/ui'

export function ThemeToggle(handle: Handle) {
  return () => (
    <button
      type="button"
      aria-label="Toggle color scheme"
      mix={[themeToggleCss, on('click', toggle)]}
    >
      {/* Sun icon — shown in dark mode to switch to light */}
      <svg
        mix={sunIconCss}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      {/* Moon icon — shown in light mode to switch to dark */}
      <svg
        mix={moonIconCss}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  )
}

function toggle() {
  let html = document.documentElement
  let current = html.style.colorScheme
  if (!current || current === 'light dark') {
    current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  let next = current === 'dark' ? 'light' : 'dark'
  html.style.colorScheme = next
  html.dataset.colorScheme = next
  try {
    localStorage.setItem('docs-color-scheme', next)
  } catch {
    // ignore storage errors (e.g. private browsing with storage blocked)
  }
}

const themeToggleCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  padding: 0,
  border: 'none',
  borderRadius: '8px',
  background: 'none',
  color: 'var(--rmx-color-text-muted)',
  cursor: 'pointer',
  flexShrink: 0,
  '&:hover': {
    backgroundColor: 'var(--rmx-surface-lvl4)',
    color: 'var(--rmx-color-text-primary)',
  },
})

const sunIconCss = css({
  display: 'none',
  '@media (prefers-color-scheme: dark)': {
    display: 'block',
  },
  '[data-color-scheme="dark"] &': {
    display: 'block',
  },
  '[data-color-scheme="light"] &': {
    display: 'none',
  },
})

const moonIconCss = css({
  display: 'block',
  '@media (prefers-color-scheme: dark)': {
    display: 'none',
  },
  '[data-color-scheme="dark"] &': {
    display: 'none',
  },
  '[data-color-scheme="light"] &': {
    display: 'block',
  },
})
