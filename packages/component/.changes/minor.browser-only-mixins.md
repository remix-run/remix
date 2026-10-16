Mixins that only add browser behavior can skip server rendering with `createMixin(setup, { ssr: false })`. The server skips their setup and render functions, including when another mixin returns them. The browser still initializes them during hydration and later renders. Server rendering remains enabled by default.

```tsx
import { createMixin } from 'remix/component'

const focusOnInsert = createMixin<HTMLElement>(
  (handle) => {
    handle.addEventListener('insert', ({ node }) => node.focus())
  },
  { ssr: false },
)
```

Use this option only when the mixin does not contribute to the server HTML. The built-in `on` and `ref` mixins now use it. `MixinOptions` is exported for typed options.
