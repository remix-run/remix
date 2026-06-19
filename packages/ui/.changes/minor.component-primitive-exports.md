Added component-local exports for headless primitives and styled components.

Primitive-only modules now import directly from their component path, while modules with styled wrappers expose lower-level behavior under `/primitives`:

```tsx
import button from '@remix-run/ui/components/button'
import * as select from '@remix-run/ui/components/select/primitives'
```

BREAKING CHANGE: Removed root helper exports that were only intended for first-party
component internals:

- `flashAttribute`
- `hiddenTypeahead`
- `matchNextItemBySearchText`
- `onKeyDown`
- `SearchValue`
- `wait`
- `waitForCssTransition`

Removed the `@remix-run/ui/scroll-lock` subpath export. Scroll locking is now an
internal popover implementation detail.
