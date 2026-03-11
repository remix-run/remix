Allow the `mix` prop to accept either a single mixin descriptor or an array of mixin descriptors.

This lets one-off mixins use `mix={...}` while preserving array support for composed mixins, and component render props now normalize `mix` to an array or `undefined` so wrapper components can compose `mix` values without special casing single descriptors.
