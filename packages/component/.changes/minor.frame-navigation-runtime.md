Add imperative frame-navigation runtime APIs and a `link(href, { src, target, history })` mixin for declarative client navigations.

`run()` now initializes from `run({ loadModule, resolveFrame })`, the package exports `navigate(href, { src, target, history })` and `link(href, { src, target, history })`, and components can target mounted frames via `handle.frames.top` and `handle.frames.get(name)`. The `link()` mixin adds `href`/`rmx-*` attributes to anchors and gives buttons and other elements accessible link semantics with click and keyboard navigation behavior.
