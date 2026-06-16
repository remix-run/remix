BREAKING CHANGE: Replaced the styled button component API with a default `button()` mixin exported from `@remix-run/ui/button`.

Use the mixin directly on button-like hosts instead of importing `Button` or composing the previous slot style exports from `@remix-run/ui/components/button`:

```tsx
import button from '@remix-run/ui/button'

<button mix={button()}>Edit order</button>
<button mix={button({ size: 'lg', tone: 'primary' })}>Add product</button>
<button mix={button({ tone: 'ghost' })}>Cancel</button>
```
