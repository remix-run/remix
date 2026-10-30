Fix how `css()` and the `style` prop serialize property names and numeric values. Previously `css({ WebkitLineClamp: 4 })` rendered the invalid `-webkit-line-clamp: 4px`, and the `webkitLineClamp` key suggested by the DOM types rendered `webkit-line-clamp`, which browsers ignore.

- Numeric values stay unitless wherever the supported CSS grammar accepts a bare number, including vendor-prefixed forms, mask borders, hyphenation limits, `shapeImageThreshold`, `readingOrder`, and numeric shorthands such as `animation` and `borderImage`. The list covers current and draft grammars as well as legacy properties; browser support still depends on the property.
- Vendor-prefixed camelCase keys get their leading dash, so `webkitLineClamp` and `msFlex` render as `-webkit-line-clamp` and `-ms-flex`.
- Custom property names keep their casing, so `'--gapSize'` renders as `--gapSize` instead of `--gap-size`.
- `css()` drops `NaN` and `Infinity` values instead of rendering `NaNpx` or `Infinitypx`, matching the `style` prop.

**Behavior change:** these fixes change some existing output. Apps that relied on the old output need to update:

- Custom property names written in camelCase are no longer converted to kebab case. If a stylesheet or `var()` reads the kebab-case name, write the property the way you reference it:

  ```diff
  -css({ '--gapSize': '8px', gap: 'var(--gap-size)' })
  +css({ '--gap-size': '8px', gap: 'var(--gap-size)' })
  ```

- `css()` adds `px` to plain numbers, but it also added it to `flex`, where a number means a grow factor. `flex: 2` rendered as `flex: 2px`, which grows like `flex: 1` with a `2px` basis, so numbers other than `1` had no effect on growth. `flex` numbers are now grow factors, and `flex: 1` renders `1 1 0%` instead of `1 1 1px`.
- `tabSize: 4` now means four spaces instead of `4px`. Numbers for `borderImageWidth`, `borderImageOutset`, `maskBorderWidth`, and `maskBorderOutset` multiply the border width instead of being pixels; the WebKit mask-box-image aliases follow the same convention.
- Numeric shorthands select their unitless meaning: `animation: 2` sets two iterations, and `borderImage: 2` / `maskBorder: 2` set the slice. Use strings with units for durations and angles, such as `'200ms'` and `'45deg'`.
- To request pixels explicitly, use a string:

  ```diff
  -css({ tabSize: 4, borderImageWidth: 2 })
  +css({ tabSize: '4px', borderImageWidth: '2px' })
  ```
