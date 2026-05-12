# glyph

`Glyph` renders references into a shared SVG sprite sheet. Render a glyph sheet once, then render individual `Glyph` instances by name.

## Usage

```tsx
import { Glyph } from 'remix/ui/glyph'
import { RMX_01_GLYPHS } from 'remix/ui/theme'

function Layout() {
  return (
    <html>
      <body>
        <RMX_01_GLYPHS />
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
- `GlyphProps`: props accepted by `Glyph`.
- `GlyphSheetProps`: props accepted by generated glyph sheet components.
- `GlyphSymbol`: SVG symbol value accepted by glyph value maps.
- `GlyphValues`: object shape expected by `createGlyphSheet`.
- `GlyphSheetComponent`: generated sprite sheet component with `ids` and `values` attached.

## Behavior Notes

- `createGlyphSheet` renders a hidden zero-size SVG and clones each provided `<symbol>` with the stable package id.
- `Glyph` is `aria-hidden` by default when no accessible label or labelled-by relationship is provided.
- Labeled glyphs keep their accessible label and do not force `aria-hidden`.
- Host SVG props such as `viewBox`, `width`, `mix`, and `aria-label` are preserved.
- `createGlyphSheet` throws if a provided glyph value is not a `<symbol>` element.
