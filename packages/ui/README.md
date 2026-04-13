# ui

A theme contract for Remix apps and first-party Remix components built on CSS custom properties.

## Features

- Fixed typed `theme` contract whose leaves resolve to `var(--rmx-...)`
- `createTheme()` utility for rendering theme variables into a `<style>` tag
- `createGlyphSheet()` utility for rendering a hidden SVG sprite sheet in the body
- `<Glyph />` component for shared icon usage through sprite references
- Typed `ui` utility mixins for common spacing, color, typography, and button styles
- Works with Remix component `mix` composition and server rendering

## Installation

```sh
npm i remix
```

## Usage

Define your app theme once:

```tsx
import { createTheme } from 'remix/ui'

let Theme = createTheme({
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
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
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
  surface: {
    lvl0: '#ffffff',
    lvl1: '#f8fafc',
    lvl2: '#f1f5f9',
    lvl3: '#e5edf7',
    lvl4: '#dbe6f4',
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
})
```

Render the theme once near the top of your document:

```tsx
function Layout(props: { children: RemixNode }) {
  return (
    <html>
      <head>
        <Theme />
      </head>
      <body>{props.children}</body>
    </html>
  )
}
```

Consume the shared token contract from app code and first-party components:

```tsx
import { css } from 'remix/component'
import { theme, ui } from 'remix/ui'

let card = css({
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  border: `1px solid ${theme.colors.border.subtle}`,
})

<div mix={[card, ui.px.md, ui.py.sm, ui.rounded.md]} />
```

Render shared glyphs separately from the theme styles:

```tsx
import type { RemixNode } from 'remix/component'
import { createGlyphSheet, Glyph, RMX_01_GLYPHS, ui } from 'remix/ui'

let Glyphs = createGlyphSheet(RMX_01_GLYPHS)

function Layout(props: { children: RemixNode }) {
  return (
    <html>
      <head>
        <Theme />
      </head>
      <body>
        <Glyphs />
        <button mix={ui.button.primary}>
          <Glyph mix={ui.button.icon} name="add" />
          <span mix={ui.button.label}>New project</span>
        </button>
        {props.children}
      </body>
    </html>
  )
}
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
