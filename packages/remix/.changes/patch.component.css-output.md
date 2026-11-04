`css()` and the `style` prop in `remix/component` now serialize property names and numbers the way browsers expect, and `css()` rerenders take about half as long in our benchmarks. Some existing output changes:

- Numbers stay unitless for properties that accept bare numbers. `flex: 2` is now a grow factor instead of `2px`, and `tabSize`, `animation`, and `borderImage` numbers take their unitless meaning. Use strings such as `'4px'` or `'200ms'` when you want units.
- Custom properties keep their casing, so `'--gapSize'` no longer becomes `--gap-size`.
- Vendor-prefixed keys get their leading dash, so `webkitLineClamp` renders as `-webkit-line-clamp`.
- Styles that list the same properties in a different order no longer share a class, and generated `rmxc-*` class names change. Update tests or selectors that hard-code them.

See the [`@remix-run/component` changelog](https://github.com/remix-run/remix/blob/main/packages/component/CHANGELOG.md) for migration examples.
