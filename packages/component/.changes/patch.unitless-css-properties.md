Fix how `css()` and the `style` prop serialize property names and numeric values. Previously `css({ WebkitLineClamp: 4 })` rendered the invalid `-webkit-line-clamp: 4px`, and the `webkitLineClamp` key suggested by the DOM types rendered `webkit-line-clamp`, which browsers ignore.

- Numeric values for every property React treats as unitless now stay unitless, including vendor-prefixed forms. This changes some existing output to match React: `flex: 1` now renders `flex: 1` instead of `flex: 1px` (a `1px` flex basis), `tabSize: 4` means four spaces instead of `4px`, and `borderImageWidth` / `borderImageOutset` numbers multiply the border width instead of being pixels.
- Vendor-prefixed camelCase keys get their leading dash, so `webkitLineClamp` and `msFlex` render as `-webkit-line-clamp` and `-ms-flex`.
- Custom property names keep their casing, so `'--gapSize'` renders as `--gapSize` instead of `--gap-size`.
- `css()` drops `NaN` and `Infinity` values instead of rendering `NaNpx` or `Infinitypx`, matching the `style` prop.
