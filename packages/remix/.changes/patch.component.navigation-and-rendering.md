Fixes for client navigation and rendering in `remix/component`:

- Navigations no longer flash unstyled content when page-specific `<head>` links are added or removed, because keyed stylesheets stay in place instead of being moved and reloaded.
- Safari restores the full scroll position on back and forward navigation.
- Boolean `aria-*` and `data-*` values render as `"true"` and `"false"` on the server, matching the browser. Previously `aria-current={true}` rendered as a bare attribute, which assistive technology reads as `"false"`. `data-rmx-document={false}` and `data-rmx-preserve-dom={false}` now omit the attribute in the browser instead of turning those features on.
- Doctype-looking text inside scripts, styles, textareas, attributes, and comments is preserved when the browser parses frame HTML.
