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
    xxs: '11px',
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
    spin: '850ms',
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
    expect(Theme.cssText).toMatch(/html, body \{/)
    expect(Theme.cssText).toMatch(/font-family: var\(--rmx-font-family-sans\);/)
    expect(Theme.cssText).toMatch(/:where\(h1, h2, h3, h4, h5, h6, p, ul, ol, dl, figure, blockquote\) \{/)
    expect(Theme.cssText).not.toMatch(/:where\(button, input, textarea, select\) \{/)
    expect(Theme.vars['--rmx-color-action-primary-background']).toBe('#2563eb')
  })

  it('supports scoped themes', () => {
    let Theme = createTheme(sampleTheme, {
      selector: '[data-theme="dark"]',
    })

    expect(Theme.cssText).toMatch(/\[data-theme="dark"\] \{/)
    expect(Theme.cssText).toMatch(
      /\[data-theme="dark"\], \[data-theme="dark"\] \*, \[data-theme="dark"\] \*::before, \[data-theme="dark"\] \*::after \{/,
    )
    expect(Theme.cssText).not.toMatch(/\[data-theme="dark"\] :where\(a\) \{/)
  })

  it('allows opting out of the base reset', () => {
    let Theme = createTheme(sampleTheme, {
      reset: false,
    })

    expect(Theme.cssText).toMatch(/:root \{/)
    expect(Theme.cssText).not.toMatch(/html, body \{/)
    expect(Theme.cssText).not.toMatch(/box-sizing: border-box;/)
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
      createElement('div', {}, [
        createElement(
          'div',
          {
            mix: [
              ui.row,
              ui.row.between,
              ui.row.wrap,
              ui.stack,
              ui.stack.center,
              ui.card.base,
              ui.card.header,
              ui.card.headerWithAction,
              ui.card.description,
              ui.button.base,
              ui.button.label,
              ui.button.sm,
              ui.button.md,
              ui.button.lg,
              ui.button.icon,
              ui.button.iconOnly,
              ui.button.tone.primary,
              ui.button.tone.secondary,
              ui.button.tone.ghost,
              ui.button.tone.danger,
              ui.button.primary,
              ui.button.ghost,
              ui.sidebar.heading,
              ui.nav.itemActive,
              ui.surfaceText.eyebrow,
              ui.item.base,
              ui.popover.base,
              ui.popover.surface,
              ui.fieldText.help,
              ui.text.code,
              ui.px.md,
              ui.rounded.md,
              ui.icon.sm,
              ui.icon.md,
              ui.icon.lg,
              ui.animation.spin,
            ],
          },
          'Hello',
        ),
        createElement('div', { mix: ui.listbox.root }, [
          createElement('button', { mix: ui.listbox.trigger }, [
            createElement('span', { mix: ui.listbox.value }, 'Backlog'),
            createElement('span', { mix: ui.listbox.indicator }, 'v'),
          ]),
          createElement('div', { mix: ui.listbox.popup }, [
            createElement('div', { mix: ui.listbox.list }, [
              createElement(
                'div',
                { mix: ui.listbox.item('backlog', { textValue: 'Backlog' }) },
                'Backlog',
              ),
            ]),
          ]),
        ]),
      ]),
    )

    expect(html).toMatch(/min-height: calc\(var\(--rmx-control-height-sm\) - 4px\)/)
    expect(html).toMatch(/min-height: var\(--rmx-control-height-sm\)/)
    expect(html).toMatch(/min-height: var\(--rmx-control-height-md\)/)
    expect(html).toMatch(/inline-size: var\(--rmx-control-height-sm\)/)
    expect(html).toMatch(/padding: var\(--rmx-space-lg\)/)
    expect(html).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto/)
    expect(html).toMatch(/flex-direction: row/)
    expect(html).toMatch(/justify-content: space-between/)
    expect(html).toMatch(/flex-wrap: wrap/)
    expect(html).toMatch(/flex-direction: column/)
    expect(html).toMatch(/margin: var\(--rmx-space-sm\) 0 0/)
    expect(html).toMatch(/font-size: var\(--rmx-font-size-3xs\)/)
    expect(html).toMatch(/font-family: var\(--rmx-font-family-mono\)/)
    expect(html).toMatch(/width: var\(--rmx-font-size-xs\)/)
    expect(html).toMatch(/width: var\(--rmx-font-size-sm\)/)
    expect(html).toMatch(/width: var\(--rmx-font-size-lg\)/)
    expect(html).toMatch(/animation: rmx-spin var\(--rmx-duration-spin\) linear infinite/)
    expect(html).toMatch(/@keyframes rmx-spin/)
    expect(html).toMatch(/padding-inline: var\(--rmx-space-md\)/)
    expect(html).toMatch(/--rmx-button-label-padding-inline: var\(--rmx-space-sm\)/)
    expect(html).toMatch(/padding-inline: var\(--rmx-button-label-padding-inline\)/)
    expect(html).toMatch(/all: unset/)
    expect(html).toMatch(/box-sizing: border-box/)
    expect(html).toMatch(/cursor: revert/)
    expect(html).toMatch(/width: 1em/)
    expect(html).toMatch(/border-radius: var\(--rmx-radius-md\)/)
    expect(html).toMatch(/background-color: var\(--rmx-color-action-primary-background\)/)
    expect(html).toMatch(/background-color: transparent/)
    expect(html).toMatch(/text-transform: uppercase/)
    expect(html).toMatch(/box-shadow: var\(--rmx-shadow-xs\)/)
    expect(html).toMatch(/data-rmx-listbox-part="popup"/)
    expect(html).toMatch(/popover="auto"/)
    expect(html).toMatch(/z-index: var\(--rmx-z-index-popover\)/)
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
        createElement(
          'div',
          { mix: ui.card.footer },
          createElement(
            'button',
            { type: 'button', mix: [ui.button.secondary, ui.card.action] },
            'Edit',
          ),
        ),
      ),
    )

    expect(html).toMatch(/box-shadow: var\(--rmx-shadow-md\)/)
    expect(html).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto/)
    expect(html).toMatch(/justify-self: end/)
    expect(html).toMatch(/text-transform: uppercase/)
    expect(html).toMatch(/letter-spacing: -0.022em/)
    expect(html).toMatch(/margin-right: calc\(var\(--rmx-space-lg\) \* -1\)/)
    expect(html).toMatch(/background-color: var\(--rmx-color-background-surface-secondary\)/)
  })

  it('lets button recipes provide default button attrs while preserving explicit overrides', async () => {
    let defaultHtml = await renderToString(
      createElement('button', { mix: ui.button.primary }, 'Save'),
    )
    let explicitHtml = await renderToString(
      createElement('button', { type: 'submit', mix: ui.button.primary }, 'Save'),
    )
    let anchorHtml = await renderToString(
      createElement('a', { href: '/settings', mix: ui.button.primary }, 'Settings'),
    )
    let composedHtml = await renderToString(
      createElement(
        'button',
        {
          mix: [ui.button.base, ui.button.lg, ui.button.tone.secondary],
        },
        createElement('span', { mix: ui.button.icon }, 'i'),
        createElement('span', { mix: ui.button.label }, 'Publish'),
      ),
    )

    expect(defaultHtml).toMatch(/type="button"/)
    expect(explicitHtml).toMatch(/type="submit"/)
    expect(anchorHtml).not.toMatch(/type="button"/)
    expect(composedHtml).toMatch(/type="button"/)
    expect(composedHtml).toMatch(/width: 1em/)
    expect(composedHtml).toMatch(/padding-inline: var\(--rmx-button-label-padding-inline\)/)
    expect(composedHtml).toMatch(/min-height: var\(--rmx-control-height-md\)/)
    expect(composedHtml).toMatch(/padding-inline: var\(--rmx-space-sm\)/)
    expect(composedHtml).toMatch(/aria-hidden\b/)
  })
})
