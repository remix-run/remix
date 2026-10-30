Fix how `css()` and the `style` prop serialize property names and numeric values. Previously `css({ WebkitLineClamp: 4 })` rendered the invalid `-webkit-line-clamp: 4px`, and the `webkitLineClamp` key suggested by the DOM types rendered `webkit-line-clamp`, which browsers ignore.

- Numeric values for every property React treats as unitless now stay unitless, including vendor-prefixed forms.
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
- To match React, `tabSize: 4` now means four spaces instead of `4px`, and `borderImageWidth` / `borderImageOutset` numbers multiply the border width instead of being pixels.
- Use a string such as `'1px'` to keep any old value.
