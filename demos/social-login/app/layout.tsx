import { css } from 'remix/component'
import type { RemixNode } from 'remix/component'

export function Document() {
  return ({ title = 'Social Login Demo', children }: { title?: string; children?: RemixNode }) => (
    <html lang="en" mix={documentStyle}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
      </head>
      <body mix={bodyStyle}>{children}</body>
    </html>
  )
}

export function Layout() {
  return ({ children }: { children?: RemixNode }) => (
    <Document>
      <main mix={pageShellStyle}>{children}</main>
    </Document>
  )
}

let documentStyle = css({
  minHeight: '100%',
})

let bodyStyle = css({
  '--bg': '#07a86d',
  '--bg-deep': '#04925d',
  '--panel': 'rgba(255, 255, 255, 0.92)',
  '--panel-strong': '#ffffff',
  '--text': '#0f172a',
  '--muted': '#5b6474',
  '--border': 'rgba(15, 23, 42, 0.08)',
  '--google': '#2563eb',
  '--github': '#cbd5e1',
  '--x': '#111111',
  '--primary': '#078f5c',
  '--primary-accent': '#056d47',
  '--error-bg': '#fff1f2',
  '--error-border': 'rgba(190, 24, 93, 0.14)',
  '--error-text': '#a11d48',
  '--success': '#0f9f6e',
  '--radius-sm': '3px',
  '--radius-md': '4px',
  '--radius-lg': '6px',
  '--radius-xl': '8px',
  margin: 0,
  minHeight: '100vh',
  padding: '28px 18px 36px',
  fontFamily: "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  color: 'var(--text)',
  background:
    'radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 34%), radial-gradient(circle at bottom right, rgba(255, 255, 255, 0.06), transparent 26%), linear-gradient(180deg, var(--bg) 0%, var(--bg-deep) 100%)',
  '& *': {
    boxSizing: 'border-box',
  },
  '& code': {
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    fontSize: '0.92em',
    background: 'rgba(15, 23, 42, 0.05)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.14rem 0.4rem',
  },
  '& strong': {
    fontWeight: 700,
  },
  '@media (max-width: 640px)': {
    padding: '16px',
  },
})

let pageShellStyle = css({
  width: 'min(1120px, 100%)',
  margin: '0 auto',
})
