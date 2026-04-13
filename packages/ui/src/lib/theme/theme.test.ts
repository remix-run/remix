import { describe, expect, it } from 'vitest'

import { createElement } from '@remix-run/component'
import { renderToString } from '@remix-run/component/server'

import { createTheme, theme, ui } from './theme.ts'

const sampleTheme = {
  space: {
    none: '0px',
    px: '1px',
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    xxl: '24px',
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
    xxxs: '10px',
    xxs: '11px',
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    xxl: '28px',
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
  surface: {
    lvl0: '#ffffff',
    lvl1: '#f8fafc',
    lvl2: '#f5f5f5',
    lvl3: '#f1f5f9',
    lvl4: '#e9eef6',
  },
  shadow: {
    xs: '0 1px 2px rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px rgb(0 0 0 / 0.10)',
    md: '0 4px 10px rgb(0 0 0 / 0.12)',
    lg: '0 10px 30px rgb(0 0 0 / 0.16)',
    xl: '0 20px 50px rgb(0 0 0 / 0.20)',
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
      link: '#2563eb',
    },
    border: {
      subtle: '#e5e7eb',
      default: '#d1d5db',
      strong: '#9ca3af',
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
    expect(theme.space.none).toBe('var(--rmx-space-none)')
    expect(theme.space.md).toBe('var(--rmx-space-md)')
    expect(theme.space.xxl).toBe('var(--rmx-space-xxl)')
    expect(theme.fontFamily.sans).toBe('var(--rmx-font-family-sans)')
    expect(theme.fontSize.xxxs).toBe('var(--rmx-font-size-xxxs)')
    expect(theme.surface.lvl0).toBe('var(--rmx-surface-lvl0)')
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
    expect(Theme.cssText).toMatch(/--rmx-surface-lvl3: #f1f5f9;/)
    expect(Theme.cssText).toMatch(/--rmx-color-text-primary: #111827;/)
    expect(Theme.cssText).toMatch(/html, body \{/)
    expect(Theme.cssText).toMatch(/font-family: var\(--rmx-font-family-sans\);/)
    expect(Theme.cssText).toMatch(/background-color: var\(--rmx-surface-lvl0\);/)
    expect(Theme.cssText).toMatch(
      /:where\(h1, h2, h3, h4, h5, h6, p, ul, ol, dl, figure, blockquote\) \{/,
    )
    expect(Theme.cssText).not.toMatch(/:where\(button, input, textarea, select\) \{/)
    expect(Theme.vars['--rmx-surface-lvl1']).toBe('#f8fafc')
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
  it('serializes component-scoped popup mixins using shared theme values', async () => {
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
              ui.bg.lvl2,
              ui.sidebar.heading,
              ui.nav.itemActive,
              ui.item.base,
              ui.fieldText.help,
              ui.text.code,
              ui.px.md,
              ui.rounded.md,
              ui.icon.sm,
              ui.icon.md,
              ui.icon.lg,
              ui.animation.spin(),
            ],
          },
          'Hello',
        ),
        createElement('div', {}, [
          createElement('button', { 'aria-expanded': 'true', mix: ui.menu.button }, [
            createElement('span', { mix: ui.button.label }, 'File'),
            createElement('span', { mix: ui.button.icon }, 'v'),
          ]),
          createElement('div', { 'data-close-animation': 'none', mix: ui.menu.popover }, [
            createElement('div', { mix: ui.menu.list }, [
              createElement('div', { mix: ui.menu.trigger }, [
                createElement('span', { mix: ui.menu.itemLabel }, 'Share'),
                createElement('span', { mix: ui.menu.triggerGlyph }, '>'),
              ]),
              createElement('div', { mix: ui.menu.item }, [
                createElement('span', { mix: ui.menu.itemGlyph }, '*'),
                createElement('span', { mix: ui.menu.itemLabel }, 'New File'),
              ]),
            ]),
          ]),
          createElement('div', { mix: ui.popover.surface }, 'Popover'),
          createElement('button', { mix: ui.popover.button }, [
            createElement('span', { mix: ui.button.label }, 'Backlog'),
            createElement('span', { mix: ui.button.icon }, 'v'),
          ]),
          createElement('button', { 'aria-expanded': 'false', mix: ui.button.select }, [
            createElement('span', { mix: ui.button.label }, 'Select a type'),
            createElement('span', { mix: ui.button.icon }, 'v'),
          ]),
          createElement('div', { mix: ui.popover.surface }, [
            createElement('div', { mix: [ui.popover.content, ui.listbox.surface] }, [
              createElement('div', { mix: ui.listbox.option, 'aria-selected': 'true' }, [
                createElement('span', { mix: ui.listbox.glyph }, 'v'),
                createElement('span', { mix: ui.listbox.label }, 'Backlog'),
              ]),
            ]),
          ]),
        ]),
      ]),
    )

    expect(html).toMatch(/background-color: var\(--rmx-surface-lvl2\)/)
    expect(html).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto/)
    expect(html).toMatch(/flex-direction: row/)
    expect(html).toMatch(/justify-content: space-between/)
    expect(html).toMatch(/flex-wrap: wrap/)
    expect(html).toMatch(/flex-direction: column/)
    expect(html).toMatch(/font-family: var\(--rmx-font-family-mono\)/)
    expect(html).toMatch(/width: var\(--rmx-font-size-xs\)/)
    expect(html).toMatch(/animation: rmx-spin 850ms linear infinite/)
    expect(html).toMatch(/@keyframes rmx-spin/)
    expect(html).toMatch(/padding-inline: var\(--rmx-space-md\)/)
    expect(html).toMatch(/grid-template-columns: max-content minmax\(0, 1fr\)/)
    expect(html).toMatch(/scroll-margin-block: var\(--rmx-space-xs\)/)
    expect(html).toMatch(/justify-self: end/)
    expect(html).toMatch(/-webkit-user-select: none/)
    expect(html).toMatch(/user-select: none/)
    expect(html).toMatch(/width: 100%/)
    expect(html).toMatch(/background-color: var\(--rmx-surface-lvl4\)/)
    expect(html).toMatch(/--rmx-listbox-option-indicator-opacity: 1/)
    expect(html).toMatch(/aria-expanded="true"/)
    expect(html).toMatch(/transition: none/)
    expect(html).toMatch(/transition-behavior: normal/)
    expect(html).toMatch(/z-index: var\(--rmx-z-index-popover\)/)
    expect(html).toMatch(/aria-expanded="true".*background-color: var\(--rmx-surface-lvl3\)/s)
    expect(html).toMatch(/overflow: hidden/)
    expect(html).toMatch(/overflow: auto/)
    expect(html).toMatch(/overscroll-behavior: contain/)
    expect(html).toMatch(/:popover-open \{\s*opacity: 1;/)
    expect(html).toMatch(/:not\(:popover-open\) \{[^}]*pointer-events: none;/)
    expect(html).toMatch(/:not\(:popover-open\) \{[^}]*transition:/)
  })

  it('provides a combobox popover token with reason-based close behavior', async () => {
    let html = await renderToString(
      createElement('div', {}, [
        createElement('div', { 'data-show-reason': 'nav', mix: ui.combobox.popover }, [
          createElement('div', { mix: ui.popover.content }, 'Nav combobox'),
        ]),
        createElement('div', { 'data-show-reason': 'hint', mix: ui.combobox.popover }, [
          createElement('div', { mix: ui.popover.content }, 'Hint combobox'),
        ]),
      ]),
    )

    expect(html).toMatch(/background-color: var\(--rmx-surface-lvl0\)/)
    expect(html).toMatch(/box-shadow: var\(--rmx-shadow-xs\), var\(--rmx-shadow-md\)/)
    expect(html).toMatch(/overflow: hidden/)
    expect(html).toMatch(/overflow: auto/)
    expect(html).toMatch(/overscroll-behavior: contain/)
    expect(html).toMatch(/:popover-open \{\s*opacity: 1;/)
    expect(html).toMatch(/:not\(:popover-open\) \{[^}]*pointer-events: none;/)
    expect(html).toMatch(/\[data-show-reason="nav"\]:not\(:popover-open\) \{[^}]*transition:/)
    expect(html).toMatch(
      /\[data-show-reason="hint"\]:not\(:popover-open\) \{[^}]*transition: none;/,
    )
  })

  it('provides a field token with a tight focus ring', async () => {
    let html = await renderToString(createElement('input', { mix: ui.field.base }))

    expect(html).toMatch(/min-height: var\(--rmx-control-height-lg\)/)
    expect(html).toMatch(/outline: 2px solid var\(--rmx-color-focus-ring\)/)
    expect(html).toMatch(/outline-offset: var\(--rmx-space-none\)/)
  })

  it('provides a combobox input token that composes field styles and suppresses the active-descendant focus ring', async () => {
    let html = await renderToString(
      createElement('input', {
        'aria-activedescendant': 'option-1',
        'data-surface-visible': 'true',
        mix: ui.combobox.input,
      }),
    )

    expect(html).toMatch(/min-height: var\(--rmx-control-height-lg\)/)
    expect(html).toMatch(/outline: 2px solid var\(--rmx-color-focus-ring\)/)
    expect(html).toMatch(
      /\[data-surface-visible="true"\]\[aria-activedescendant\]:focus-visible \{\s*outline: none;/,
    )
  })

  it('provides card structure mixins for layout and typography', async () => {
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
    expect(html).toMatch(/font-size: var\(--rmx-font-size-xxxs\)/)
    expect(html).toMatch(/background-color: var\(--rmx-surface-lvl1\)/)
  })

  it('lets button mixins provide default button attrs while preserving explicit overrides', async () => {
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
