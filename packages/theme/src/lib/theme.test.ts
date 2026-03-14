import { describe, expect, it } from 'vitest'

import { createElement } from '@remix-run/component'
import { renderToString } from '@remix-run/component/server'

import { createTheme, theme, ui } from './theme.ts'

const sampleTheme = {
  space: {
    0: '0px',
    px: '1px',
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '24px',
  },
  radius: {
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  fontFamily: {
    sans: 'Inter, sans-serif',
    mono: 'monospace',
  },
  fontSize: {
    '3xs': '10px',
    '2xs': '11px',
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '28px',
  },
  lineHeight: {
    tight: '1.2',
    normal: '1.5',
    relaxed: '1.7',
  },
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    meta: '0.06em',
    wide: '0.08em',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  control: {
    height: {
      sm: '28px',
      md: '32px',
      lg: '36px',
    },
    paddingInline: {
      sm: '8px',
      md: '12px',
      lg: '16px',
    },
  },
  shadow: {
    xs: '0 1px 2px rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px rgb(0 0 0 / 0.10)',
    md: '0 4px 10px rgb(0 0 0 / 0.12)',
    lg: '0 10px 30px rgb(0 0 0 / 0.16)',
    xl: '0 20px 50px rgb(0 0 0 / 0.20)',
  },
  duration: {
    fast: '120ms',
    normal: '180ms',
    slow: '280ms',
  },
  easing: {
    standard: 'ease',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  zIndex: {
    dropdown: '1000',
    popover: '1100',
    sticky: '1200',
    overlay: '1300',
    modal: '1400',
    toast: '1500',
    tooltip: '1600',
  },
  colors: {
    text: {
      primary: '#111827',
      secondary: '#374151',
      muted: '#6b7280',
      inverse: '#ffffff',
      link: '#2563eb',
    },
    background: {
      canvas: '#ffffff',
      surface: '#ffffff',
      surfaceSecondary: '#f8fafc',
      surfaceElevated: '#ffffff',
      inset: '#f1f5f9',
      inverse: '#111827',
    },
    border: {
      subtle: '#e5e7eb',
      default: '#d1d5db',
      strong: '#9ca3af',
      inverse: '#374151',
    },
    focus: {
      ring: '#3b82f6',
    },
    overlay: {
      scrim: 'rgb(0 0 0 / 0.45)',
    },
    action: {
      primary: {
        background: '#2563eb',
        backgroundHover: '#1d4ed8',
        backgroundActive: '#1e40af',
        foreground: '#ffffff',
        border: '#2563eb',
      },
      secondary: {
        background: '#ffffff',
        backgroundHover: '#f8fafc',
        backgroundActive: '#f1f5f9',
        foreground: '#111827',
        border: '#d1d5db',
      },
      danger: {
        background: '#dc2626',
        backgroundHover: '#b91c1c',
        backgroundActive: '#991b1b',
        foreground: '#ffffff',
        border: '#dc2626',
      },
    },
    status: {
      info: {
        background: '#eff6ff',
        foreground: '#1d4ed8',
        border: '#bfdbfe',
      },
      success: {
        background: '#ecfdf5',
        foreground: '#047857',
        border: '#a7f3d0',
      },
      warning: {
        background: '#fffbeb',
        foreground: '#b45309',
        border: '#fde68a',
      },
      danger: {
        background: '#fef2f2',
        foreground: '#b91c1c',
        border: '#fecaca',
      },
    },
  },
} as const

describe('theme contract', () => {
  it('exposes CSS variable references', () => {
    expect(theme.space.md).toBe('var(--rmx-space-md)')
    expect(theme.fontFamily.sans).toBe('var(--rmx-font-family-sans)')
    expect(theme.fontSize['3xs']).toBe('var(--rmx-font-size-3xs)')
    expect(theme.colors.text.primary).toBe('var(--rmx-color-text-primary)')
    expect(theme.colors.action.primary.background).toBe(
      'var(--rmx-color-action-primary-background)',
    )
  })
})

describe('createTheme', () => {
  it('serializes theme values into CSS custom properties', () => {
    let Theme = createTheme(sampleTheme)

    expect(Theme.selector).toBe(':root')
    expect(Theme.cssText).toMatch(/:root \{/)
    expect(Theme.cssText).toMatch(/--rmx-space-md: 8px;/)
    expect(Theme.cssText).toMatch(/--rmx-control-height-sm: 28px;/)
    expect(Theme.cssText).toMatch(/--rmx-color-text-primary: #111827;/)
    expect(Theme.vars['--rmx-color-action-primary-background']).toBe('#2563eb')
  })

  it('supports scoped themes', () => {
    let Theme = createTheme(sampleTheme, {
      selector: '[data-theme="dark"]',
    })

    expect(Theme.cssText).toMatch(/\[data-theme="dark"\] \{/)
  })

  it('renders a style tag component', async () => {
    let Theme = createTheme(sampleTheme)
    let html = await renderToString(Theme()())

    expect(html).toContain('<style')
    expect(html).toContain('data-rmx-theme')
    expect(html).toContain('--rmx-space-md: 8px;')
  })
})

describe('ui', () => {
  it('serializes utility mixins using theme variables', async () => {
    let html = await renderToString(
      createElement(
        'div',
        {
          mix: [
            ui.card.base,
            ui.card.header,
            ui.card.headerWithAction,
            ui.card.description,
            ui.control.base,
            ui.button.primary,
            ui.surfaceText.eyebrow,
            ui.item.base,
            ui.fieldText.help,
            ui.text.code,
            ui.px.md,
            ui.rounded.md,
          ],
        },
        'Hello',
      ),
    )

    expect(html).toMatch(/min-height: var\(--rmx-control-height-sm\)/)
    expect(html).toMatch(/padding: var\(--rmx-space-lg\)/)
    expect(html).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto/)
    expect(html).toMatch(/margin: var\(--rmx-space-sm\) 0 0/)
    expect(html).toMatch(/font-size: var\(--rmx-font-size-3xs\)/)
    expect(html).toMatch(/font-family: var\(--rmx-font-family-mono\)/)
    expect(html).toMatch(/padding-inline: var\(--rmx-space-md\)/)
    expect(html).toMatch(/border-radius: var\(--rmx-radius-md\)/)
    expect(html).toMatch(/background-color: var\(--rmx-color-action-primary-background\)/)
  })

  it('provides card structure recipes for layout and typography', async () => {
    let html = await renderToString(
      createElement(
        'article',
        {
          mix: [ui.card.elevated, ui.card.headerWithAction],
        },
        createElement('div', { mix: ui.card.header }, [
          createElement('p', { mix: ui.card.eyebrow }, 'Surface'),
          createElement('h2', { mix: ui.card.title }, 'Share workspace'),
          createElement('p', { mix: ui.card.description }, 'Invite teammates and manage access'),
        ]),
        createElement('button', { type: 'button', mix: [ui.control.base, ui.button.secondary, ui.card.action] }, 'Edit'),
      ),
    )

    expect(html).toMatch(/box-shadow: var\(--rmx-shadow-md\)/)
    expect(html).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto/)
    expect(html).toMatch(/justify-self: end/)
    expect(html).toMatch(/text-transform: uppercase/)
    expect(html).toMatch(/letter-spacing: -0.022em/)
  })
})
