# Glyph

`Glyph` renders references into a shared SVG sprite sheet. Use `createGlyphSheet` to install a glyph set once, then render individual `Glyph` instances by name.

## Usage

```tsx
import { Glyph, createGlyphSheet } from 'remix/ui/glyph'
import { RMX_01_GLYPHS } from 'remix/ui/theme'

let Glyphs = createGlyphSheet(RMX_01_GLYPHS.values)

function Layout() {
  return (
    <html>
      <body>
        <Glyphs />
        <button aria-label="Delete">
          <Glyph name="trash" />
        </button>
      </body>
    </html>
  )
}
```

## `glyph.*`

- `Glyph`: renders an `<svg>` with a `<use>` element that points at the package-owned symbol id for `name`.
- `createGlyphSheet(values)`: creates a hidden SVG sprite sheet component from a complete glyph value set.
- `GlyphName`: typed union of supported glyph names.
- `GlyphValues`: object shape expected by `createGlyphSheet`.
- `GlyphSheetComponent`: generated sprite sheet component with `ids` and `values` attached.

## Behavior Notes

- `createGlyphSheet` renders a hidden zero-size SVG and clones each provided `<symbol>` with the stable package id.
- `Glyph` is `aria-hidden` by default when no accessible label or labelled-by relationship is provided.
- Labeled glyphs keep their accessible label and do not force `aria-hidden`.
- Host SVG props such as `viewBox`, `width`, `mix`, and `aria-label` are preserved.
- `createGlyphSheet` throws if a provided glyph value is not a `<symbol>` element.
