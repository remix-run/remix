# theme

`theme` provides Remix UI design tokens, theme creation, glyph contracts, and the built-in `RMX_01` preset. Use it to install CSS custom properties once and consume typed token references in component styles.

## Usage

```tsx
import { createTheme, theme } from 'remix/ui/theme'
import { css } from 'remix/ui'

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
  radius: { none: '0px', sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
  fontFamily: { sans: 'Inter, sans-serif', mono: 'monospace' },
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
  lineHeight: { tight: '1.2', normal: '1.5', relaxed: '1.7' },
  letterSpacing: { tight: '-0.02em', normal: '0', meta: '0.06em', wide: '0.08em' },
  fontWeight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  control: { height: { sm: '28px', md: '32px', lg: '36px' } },
  surface: { lvl0: '#fff', lvl1: '#f8fafc', lvl2: '#f5f5f5', lvl3: '#f1f5f9', lvl4: '#e9eef6' },
  shadow: { xs: 'none', sm: 'none', md: 'none', lg: 'none', xl: 'none' },
  colors: {
    text: { primary: '#111827', secondary: '#374151', muted: '#6b7280', link: '#2563eb' },
    border: { subtle: '#e5e7eb', default: '#d1d5db', strong: '#9ca3af' },
    focus: { ring: '#3b82f6' },
    overlay: { scrim: 'rgb(0 0 0 / 0.45)' },
    action: {
      primary: {
        background: '#2563eb',
        backgroundHover: '#1d4ed8',
        backgroundActive: '#1e40af',
        foreground: '#fff',
        border: '#2563eb',
      },
      secondary: {
        background: '#fff',
        backgroundHover: '#f8fafc',
        backgroundActive: '#f1f5f9',
        foreground: '#111827',
        border: '#d1d5db',
      },
      danger: {
        background: '#dc2626',
        backgroundHover: '#b91c1c',
        backgroundActive: '#991b1b',
        foreground: '#fff',
        border: '#dc2626',
      },
    },
  },
})

let card = css({
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
})

function Layout() {
  return (
    <body>
      <Theme />
      <article mix={card}>Project status</article>
    </body>
  )
}
```

## `theme.*`

- `theme`: typed CSS variable reference contract, such as `theme.space.md` and `theme.colors.text.primary`.
- `createTheme(values, options?)`: creates a style component with `cssText`, `selector`, `values`, `vars`, and `Style`.
- `RMX_01`: built-in theme component.
- `RMX_01_GLYPHS`: built-in glyph sheet component.
- `glyphContract` and `glyphNames`: stable glyph ids and supported glyph names.
- `ThemeValues`, `ThemeVars`, `ThemeComponent`, `ThemeStyleProps`, `CreateThemeOptions`, and `ThemeMix`: public TypeScript types for custom themes.
- `GlyphName`, `GlyphSymbol`, and `GlyphValues`: public TypeScript types for glyph contracts.

## Behavior Notes

- `theme` values are CSS variable references, not raw token values.
- `createTheme` serializes token values into CSS custom properties and renders a `<style data-rmx-theme>` tag.
- The default selector is `:root`; pass `selector` for scoped themes.
- The base reset is included by default and can be disabled with `reset: false`.
- The built-in components consume this token contract through their style mixins.
- Render `<RMX_01 />` and `<RMX_01_GLYPHS />` once when using the built-in theme and glyph preset.
