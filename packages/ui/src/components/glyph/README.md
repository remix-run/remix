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

Most glyphs are decorative because the surrounding control supplies the accessible name. `Glyph` sets `aria-hidden` by default in that case.

```tsx
<button aria-label="Search">
  <Glyph name="search" />
</button>
```

Give the glyph its own label only when the SVG itself is the accessible element.

```tsx
<Glyph aria-label="Search" name="search" viewBox="0 0 20 20" width="24" />
```

Use `createGlyphSheet` when a theme or app provides its own complete glyph set. The generated sheet exposes the stable symbol ids and the original values for reuse.

```tsx
import { createGlyphSheet, type GlyphValues } from 'remix/ui/glyph'

declare const glyphValues: GlyphValues

export const AppGlyphs = createGlyphSheet(glyphValues)

AppGlyphs.ids.trash
AppGlyphs.values.trash
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

The built-in glyph names are `add`, `alert`, `check`, `chevronDown`, `chevronVertical`, `chevronUp`, `chevronRight`, `close`, `copy`, `edit`, `expand`, `info`, `menu`, `open`, `search`, `spinner`, and `trash`.

## Behavior Notes

- Render the glyph sheet once before rendering glyph instances that reference it.
- `createGlyphSheet` renders a hidden zero-size SVG and clones each provided `<symbol>` with the stable package id.
- `Glyph` is `aria-hidden` by default when no accessible label or labelled-by relationship is provided.
- Labeled glyphs keep their accessible label and do not force `aria-hidden`.
- Host SVG props such as `viewBox`, `width`, `mix`, and `aria-label` are preserved.
- `createGlyphSheet` throws if a provided glyph value is not a `<symbol>` element.
