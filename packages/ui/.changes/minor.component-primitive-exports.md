Added top-level component exports for headless primitives and styled components.

Primitive-only modules import directly from their component path, while modules with styled wrappers expose lower-level behavior under `/primitives`:

```tsx
import button from '@remix-run/ui/button'
import * as select from '@remix-run/ui/select/primitives'
```

BREAKING CHANGE: Removed the `@remix-run/ui/components/*` subpath exports. Import
component modules from `@remix-run/ui/*` instead.

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
