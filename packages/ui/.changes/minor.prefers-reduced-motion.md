Check the user's current motion preference with `prefersReducedMotion()` from `@remix-run/ui/animation` (see #11993). It returns `false` during server rendering or when `matchMedia` is unavailable, so it can be called safely from component render functions as well as browser event handlers.

```tsx
import { animateLayout, prefersReducedMotion, spring } from '@remix-run/ui/animation'

function Card() {
  return () => (
    <div mix={animateLayout(prefersReducedMotion() ? false : { ...spring('snappy') })}>Details</div>
  )
}
```
