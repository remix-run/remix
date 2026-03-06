Allow the `mix` prop to accept either a single mixin descriptor or an array of mixin descriptors.

This lets one-off mixins use `mix={...}` while preserving array support for composed mixins.

Simplify the `resolveFrame` callback API to receive an optional `target` string for named frame reloads.

This makes it easier to distinguish targeted frame navigations when forwarding frame requests through app-specific fetch logic.
