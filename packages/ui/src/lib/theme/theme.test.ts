import { describe, expect, it } from 'vitest'

import { createElement } from '@remix-run/component'
import { renderToString } from '@remix-run/component/server'

import * as accordion from '../accordion/accordion.tsx'
import * as button from '../button/button.tsx'
import * as combobox from '../combobox/combobox.tsx'
import * as listbox from '../listbox/listbox.ts'
import * as menu from '../menu/menu.tsx'
import * as popover from '../popover/popover.ts'
import * as select from '../select/select.tsx'
import * as separator from '../separator/separator.ts'
import * as tabs from '../tabs/tabs.tsx'
import { createTheme, theme } from './theme.ts'

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

describe('modules', () => {
  it('exposes the supported component style namespaces', () => {
    expect(Object.keys(button).sort()).toEqual([
      'Button',
      'baseStyle',
      'dangerStyle',
      'ghostStyle',
      'iconStyle',
      'labelStyle',
      'primaryStyle',
      'secondaryStyle',
    ])
    expect(Object.keys(popover).sort()).toEqual([
      'Context',
      'anchor',
      'contentStyle',
      'focusOnHide',
      'focusOnShow',
      'surface',
      'surfaceStyle',
    ])
    expect(Object.keys(combobox).sort()).toEqual([
      'Combobox',
      'ComboboxChangeEvent',
      'ComboboxOption',
      'Context',
      'hiddenInput',
      'input',
      'inputStyle',
      'list',
      'onComboboxChange',
      'option',
      'popover',
      'popoverStyle',
    ])
    expect(Object.keys(accordion).sort()).toEqual([
      'Accordion',
      'AccordionChangeEvent',
      'AccordionContent',
      'AccordionItem',
      'AccordionTrigger',
      'bodyStyle',
      'indicatorStyle',
      'itemStyle',
      'onAccordionChange',
      'panelStyle',
      'rootStyle',
      'triggerStyle',
    ])
    expect(Object.keys(tabs).sort()).toEqual([
      'Context',
      'Tab',
      'Tabs',
      'TabsChangeEvent',
      'TabsList',
      'TabsPanel',
      'list',
      'listStyle',
      'onTabsChange',
      'panel',
      'trigger',
      'triggerStyle',
    ])
    expect(Object.keys(listbox).sort()).toEqual([
      'Context',
      'glyphStyle',
      'labelStyle',
      'list',
      'listStyle',
      'option',
      'optionStyle',
    ])
    expect(Object.keys(menu).sort()).toEqual([
      'Context',
      'Menu',
      'MenuItem',
      'MenuList',
      'MenuSelectEvent',
      'Submenu',
      'buttonStyle',
      'item',
      'itemGlyphStyle',
      'itemLabelStyle',
      'itemSlotStyle',
      'itemStyle',
      'list',
      'listStyle',
      'onMenuSelect',
      'popover',
      'popoverStyle',
      'submenuTrigger',
      'trigger',
      'triggerGlyphStyle',
    ])
    expect(Object.keys(select).sort()).toEqual([
      'Context',
      'Option',
      'Select',
      'SelectChangeEvent',
      'hiddenInput',
      'list',
      'onSelectChange',
      'option',
      'popover',
      'trigger',
      'triggerStyle',
    ])
    expect(Object.keys(separator).sort()).toEqual(['separatorStyle'])
  })

  it('serializes menu, select, listbox, and popover mixins using shared theme values', async () => {
    let html = await renderToString(
      createElement('div', {}, [
        createElement('div', {}, [
          createElement(
            'button',
            {
              'aria-expanded': 'true',
              mix: [button.baseStyle, button.ghostStyle, menu.buttonStyle],
            },
            [
              createElement('span', { mix: button.labelStyle }, 'File'),
              createElement('span', { mix: button.iconStyle }, 'v'),
            ],
          ),
          createElement(
            'div',
            {
              'data-anchor-placement': 'right-start',
              'data-close-animation': 'none',
              'data-menu-submenu': 'true',
              mix: [popover.surfaceStyle, menu.popoverStyle],
            },
            [
              createElement('div', { mix: menu.listStyle }, [
                createElement('div', { mix: menu.itemStyle }, [
                  createElement('span', { mix: menu.itemSlotStyle }, [
                    createElement('span', { mix: menu.itemGlyphStyle }, '*'),
                  ]),
                  createElement('span', { mix: menu.itemLabelStyle }, 'Share'),
                  createElement('span', { mix: menu.triggerGlyphStyle }, '>'),
                ]),
                createElement('hr', { mix: separator.separatorStyle }),
                createElement('div', { mix: menu.itemStyle }, [
                  createElement('span', { mix: menu.itemSlotStyle }, [
                    createElement('span', { mix: menu.itemGlyphStyle }, '*'),
                  ]),
                  createElement('span', { mix: menu.itemLabelStyle }, 'New File'),
                ]),
              ]),
            ],
          ),
          createElement(
            'div',
            {
              'data-anchor-placement': 'left-start',
              'data-menu-submenu': 'true',
              mix: [popover.surfaceStyle, menu.popoverStyle],
            },
            'Popover',
          ),
          createElement(
            'button',
            { 'aria-expanded': 'false', mix: [button.baseStyle, select.triggerStyle] },
            [
              createElement('span', { mix: button.labelStyle }, 'Select a type'),
              createElement('span', { mix: button.iconStyle }, 'v'),
            ],
          ),
          createElement('div', { mix: popover.surfaceStyle }, [
            createElement('div', { mix: [popover.contentStyle, listbox.listStyle] }, [
              createElement('div', { mix: listbox.optionStyle, 'aria-selected': 'true' }, [
                createElement('span', { mix: listbox.glyphStyle }, 'v'),
                createElement('span', { mix: listbox.labelStyle }, 'Backlog'),
              ]),
              createElement('hr', { mix: separator.separatorStyle }),
            ]),
          ]),
        ]),
      ]),
    )

    expect(html).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto/)
    expect(html).toMatch(/padding-inline: var\(--rmx-space-md\)/)
    expect(html).toMatch(/grid-template-columns: max-content minmax\(0, 1fr\)/)
    expect(html).toMatch(/scroll-margin-block: var\(--rmx-space-xs\)/)
    expect(html).toMatch(/padding-block: var\(--rmx-space-xs\)/)
    expect(html).toMatch(/position: relative/)
    expect(html).toMatch(/isolation: isolate/)
    expect(html).toMatch(/padding-inline: calc\(var\(--rmx-space-sm\) \+ var\(--rmx-space-xs\)\)/)
    expect(html).toMatch(/inset-inline: var\(--rmx-space-xs\)/)
    expect(html).toMatch(/margin-inline-start: auto/)
    expect(html).toMatch(
      /--rmx-ui-item-inset: calc\(var\(--rmx-space-sm\) \+ var\(--rmx-space-xs\)\)/,
    )
    expect(html).toMatch(/--rmx-ui-item-indicator-width: var\(--rmx-menu-item-slot-width\)/)
    expect(html).toMatch(/--rmx-ui-item-indicator-width: var\(--rmx-font-size-sm\)/)
    expect(html).toMatch(/margin-block: var\(--rmx-space-xs\)/)
    expect(html).toMatch(/border-top: 1px solid var\(--rmx-color-border-subtle\)/)
    expect(html).toMatch(/-webkit-user-select: none/)
    expect(html).toMatch(/user-select: none/)
    expect(html).toMatch(/width: 100%/)
    expect(html).toMatch(/background-color: var\(--rmx-surface-lvl4\)/)
    expect(html).toMatch(/--rmx-listbox-option-indicator-opacity: 1/)
    expect(html).toMatch(/aria-expanded="true"/)
    expect(html).toMatch(/transition: none/)
    expect(html).toMatch(/transition-behavior: normal/)
    expect(html).toMatch(
      /\[data-menu-submenu="true"\]\[data-anchor-placement\^="right"\][^{]*\{[^}]*margin-left: calc\(var\(--rmx-space-xs\) \* -1\)/,
    )
    expect(html).toMatch(
      /\[data-menu-submenu="true"\]\[data-anchor-placement\^="left"\][^{]*\{[^}]*margin-left: var\(--rmx-space-xs\)/,
    )
    expect(html).toMatch(/aria-expanded="true".*background-color: var\(--rmx-surface-lvl3\)/s)
    expect(html).toMatch(/overflow: hidden/)
    expect(html).toMatch(/overflow: auto/)
    expect(html).toMatch(/overscroll-behavior: contain/)
    expect(html).toMatch(/:popover-open \{\s*opacity: 1;/)
    expect(html).toMatch(/:not\(:popover-open\) \{[^}]*pointer-events: none;/)
    expect(html).toMatch(/:not\(:popover-open\) \{[^}]*transition:/)
    expect(html).toMatch(
      /\[aria-haspopup="menu"\]\[aria-expanded="true"\]:not\(:focus\)[^{]*\{[^}]*background-color: var\(--rmx-surface-lvl2\)/,
    )
    expect(html).toMatch(/\[data-menu-flash="true"\][^}]*background-color: transparent/s)
    expect(html).not.toMatch(/\[data-menu-flash="true"\][^}]*--rmx-menu-item-slot-width/s)
    expect(html).not.toMatch(/\[data-menu-flash="true"\][^}]*--rmx-menu-item-indicator-opacity/s)
    expect(html).not.toMatch(/data-menu-selected/)
  })

  it('provides combobox css with reason-based close behavior', async () => {
    let html = await renderToString(
      createElement('div', {}, [
        createElement(
          'div',
          { 'data-show-reason': 'nav', mix: [popover.surfaceStyle, combobox.popoverStyle] },
          [createElement('div', { mix: popover.contentStyle }, 'Nav combobox')],
        ),
        createElement(
          'div',
          { 'data-show-reason': 'hint', mix: [popover.surfaceStyle, combobox.popoverStyle] },
          [createElement('div', { mix: popover.contentStyle }, 'Hint combobox')],
        ),
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

  it('provides tabs css for the list and selected trigger while leaving panels app-owned', async () => {
    let html = await renderToString(
      createElement('div', { mix: tabs.listStyle }, [
        createElement(
          'button',
          { 'aria-selected': 'true', mix: [button.baseStyle, tabs.triggerStyle] },
          'Overview',
        ),
        createElement(
          'button',
          { 'aria-selected': 'false', mix: [button.baseStyle, tabs.triggerStyle] },
          'Analytics',
        ),
      ]),
    )

    expect(html).toMatch(/display: inline-flex/)
    expect(html).toMatch(/background-color: var\(--rmx-surface-lvl2\)/)
    expect(html).toMatch(/border-radius: var\(--rmx-radius-xl\)/)
    expect(html).toMatch(/font-size: var\(--rmx-font-size-md\)/)
    expect(html).toMatch(/aria-selected="true".*background-color: var\(--rmx-surface-lvl0\)/s)
    expect(html).toMatch(/aria-selected="true".*box-shadow: var\(--rmx-shadow-xs\)/s)
  })

  it('provides a combobox input token that composes field styles and suppresses the active-descendant focus ring', async () => {
    let html = await renderToString(
      createElement('input', {
        'aria-activedescendant': 'option-1',
        'data-surface-visible': 'true',
        mix: combobox.inputStyle,
      }),
    )

    expect(html).toMatch(/min-height: var\(--rmx-control-height-sm\)/)
    expect(html).toMatch(/outline: 2px solid var\(--rmx-color-focus-ring\)/)
    expect(html).toMatch(
      /\[data-surface-visible="true"\]\[aria-activedescendant\]:focus-visible \{\s*outline: none;/,
    )
  })
})
