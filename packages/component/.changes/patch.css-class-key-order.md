Fix `css()` applying the wrong styles when two style objects contain the same properties in a different order. Generated classes ignored key order, so `css({ marginTop: '5px', margin: 0 })` could reuse the class generated for `css({ margin: 0, marginTop: '5px' })` and render a 5px top margin instead of 0. Each order now gets its own class with its declarations in the order written.

Generated classes also no longer depend on the default locale. Style keys were sorted with locale-aware comparison, so a browser using a locale like Estonian, which sorts `z` before `t`, could generate a different class than the server for styles like `{ top: 0, zIndex: 1 }` and insert a duplicate rule at a different position in the cascade during hydration.

Generated `rmxc-*` class names change with this release, so update any tests or selectors that hard-code them.
