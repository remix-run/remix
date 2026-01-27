import type { Handle } from '@remix-run/component'

export function Header(handle: Handle) {
  let title = 'Test App'

  return () => (
    <header data-testid="header">
      <h1 data-testid="header-title">{title}</h1>
    </header>
  )
}

export function Footer(handle: Handle) {
  let year = 2024

  return () => (
    <footer data-testid="footer">
      <p data-testid="footer-year">© {year}</p>
    </footer>
  )
}
