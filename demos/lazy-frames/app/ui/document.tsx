import { css, type Handle, type RemixNode } from 'remix/ui'

import { getAssetEntry } from '../middleware/asset-entry.ts'
import type { Theme } from './public/theme.ts'

interface DocumentProps {
  title: string
  theme: Theme
  children?: RemixNode
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { title, theme, children } = handle.props
    let { scriptSrc, scriptPreloads } = getAssetEntry()

    return (
      <html lang="en" data-theme={theme}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta
            name="description"
            content="A long-page demo that mounts Remix Frames as they approach the viewport."
          />
          <title>{title}</title>
          {scriptPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script async type="module" src={scriptSrc} />
        </head>
        <body id="top" data-theme={theme} mix={bodyStyle}>
          {children}
        </body>
      </html>
    )
  }
}

const bodyStyle = css({
  '--page-bg': '#f3eee4',
  '--page-text': '#25241e',
  '--page-heading': '#282720',
  '--page-muted': '#686257',
  '--page-subtle': '#81786b',
  '--page-rule': '#c8c0b2',
  '--surface-bg': 'rgba(255, 253, 249, 0.74)',
  '--surface-border': '#d7d0c4',
  '--frame-shell-bg': 'rgba(255, 255, 255, 0.46)',
  '--placeholder-bg': 'rgba(247, 243, 235, 0.72)',
  '--placeholder-border': '#bbb1a1',
  '--placeholder-text': '#6e665b',
  '--placeholder-heading': '#3e3a32',
  '--placeholder-dot': '#aaa091',
  '--plain-bg': '#fffdf8',
  '--plain-border': '#d5cec2',
  '--plain-text': '#2d2b25',
  '--plain-list': '#555044',
  '--plain-muted': '#81786b',
  '--plain-rule': '#e2dcd2',
  '--control-bg': 'rgba(255, 253, 249, 0.92)',
  '--control-text': '#14201e',
  '--control-muted': '#68736e',
  '--control-border': '#b8c0bb',
  '--control-border-hover': '#66746d',
  '--control-button-bg': '#ffffff',
  '--control-button-hover': '#f4f7f4',
  '--control-shadow': 'rgba(20, 32, 30, 0.14)',
  '--hero-bg': '#14201e',
  '--hero-text': '#f3f0e7',
  '--hero-muted': '#c7d4ce',
  '--hero-rule': 'rgba(243, 240, 231, 0.16)',
  '--hero-copy': '#dfe7e2',
  '--focus-ring': '#f4cf71',
  '--footer-bg': '#d9e5db',
  '--footer-text': '#183029',
  '--footer-muted': '#557066',
  '--server-frame-bg': '#15201e',
  '--server-frame-text': '#eff8ee',
  '--server-frame-muted': '#a6b6b1',
  '--server-frame-copy': '#c7d4d0',
  '--server-frame-detail': '#dfe9e5',
  '--server-frame-rule': 'rgba(239, 248, 238, 0.16)',
  '--server-frame-accent': '#9ed89b',
  '--server-frame-highlight': '#f4cf71',
  '--interactive-bg': '#fffdf9',
  '--interactive-text': '#1f1930',
  '--interactive-muted': '#655f78',
  '--interactive-subtle': '#756d85',
  '--interactive-accent': '#7557c8',
  '--interactive-pending': '#b8afc9',
  '--interactive-border': '#d9d0e4',
  '--interactive-button-border': '#cbc3d9',
  '--interactive-button-text': '#453d59',
  '--interactive-button-hover': '#f6f2fa',
  '--theme-motion-coral': '#ff785a',
  '--theme-motion-cream': '#fff7e8',
  '--theme-motion-lime': '#c9f27b',
  '--theme-motion-bg-start': '#1c3942',
  '--theme-motion-bg-end': '#182c35',
  '--theme-motion-glow': 'rgba(201, 242, 123, 0.2)',
  '--theme-motion-border': 'rgba(255, 247, 232, 0.22)',
  '--theme-motion-ring': 'rgba(255, 247, 232, 0.34)',
  '--theme-motion-ring-soft': 'rgba(255, 247, 232, 0.2)',
  '--theme-motion-caption': 'rgba(255, 247, 232, 0.7)',
  margin: 0,
  backgroundColor: 'var(--page-bg)',
  color: 'var(--page-text)',
  colorScheme: 'light',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  textRendering: 'optimizeLegibility',
  '&[data-theme="dark"]': {
    '--page-bg': '#0d1614',
    '--page-text': '#e9eee8',
    '--page-heading': '#f2f5ef',
    '--page-muted': '#adb8b1',
    '--page-subtle': '#929f97',
    '--page-rule': '#394740',
    '--surface-bg': 'rgba(24, 35, 32, 0.82)',
    '--surface-border': '#36443f',
    '--frame-shell-bg': 'rgba(28, 42, 38, 0.78)',
    '--placeholder-bg': 'rgba(19, 30, 27, 0.78)',
    '--placeholder-border': '#506059',
    '--placeholder-text': '#a8b5ae',
    '--placeholder-heading': '#edf2ec',
    '--placeholder-dot': '#718078',
    '--plain-bg': '#17221f',
    '--plain-border': '#3a4943',
    '--plain-text': '#edf2ec',
    '--plain-list': '#bdc8c1',
    '--plain-muted': '#96a49c',
    '--plain-rule': '#34423d',
    '--control-bg': 'rgba(18, 29, 26, 0.94)',
    '--control-text': '#f0f4ef',
    '--control-muted': '#a9b6af',
    '--control-border': '#52615b',
    '--control-border-hover': '#8b9b93',
    '--control-button-bg': '#24332f',
    '--control-button-hover': '#30423c',
    '--control-shadow': 'rgba(0, 0, 0, 0.34)',
    '--hero-bg': '#080f0e',
    '--hero-muted': '#b9c9c2',
    '--hero-rule': 'rgba(243, 240, 231, 0.13)',
    '--footer-bg': '#13241f',
    '--footer-text': '#e5efe7',
    '--footer-muted': '#96b1a6',
    '--server-frame-bg': '#20342e',
    '--server-frame-muted': '#b3c5bd',
    '--server-frame-copy': '#d1ddd7',
    '--server-frame-detail': '#edf4ef',
    '--server-frame-rule': 'rgba(239, 248, 238, 0.2)',
    '--server-frame-accent': '#a7e1a3',
    '--server-frame-highlight': '#f4d581',
    '--interactive-bg': '#211d2a',
    '--interactive-text': '#f4effa',
    '--interactive-muted': '#c7badd',
    '--interactive-subtle': '#b7abc8',
    '--interactive-accent': '#bda7ff',
    '--interactive-pending': '#766d85',
    '--interactive-border': '#554a63',
    '--interactive-button-border': '#6d607d',
    '--interactive-button-text': '#e4dcef',
    '--interactive-button-hover': '#31293d',
    '--theme-motion-coral': '#c94f3b',
    '--theme-motion-cream': '#17302e',
    '--theme-motion-lime': '#4f6f31',
    '--theme-motion-bg-start': '#edf1df',
    '--theme-motion-bg-end': '#cbded6',
    '--theme-motion-glow': 'rgba(102, 144, 65, 0.24)',
    '--theme-motion-border': 'rgba(23, 48, 46, 0.2)',
    '--theme-motion-ring': 'rgba(23, 48, 46, 0.3)',
    '--theme-motion-ring-soft': 'rgba(23, 48, 46, 0.17)',
    '--theme-motion-caption': 'rgba(23, 48, 46, 0.72)',
    colorScheme: 'dark',
  },
  '& *': {
    boxSizing: 'border-box',
  },
  '& ::selection': {
    backgroundColor: 'var(--focus-ring)',
    color: '#14201e',
  },
})
