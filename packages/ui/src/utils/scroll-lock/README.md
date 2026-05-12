# scroll-lock

`scroll-lock` locks document scrolling while a floating or modal surface is open. Use `lockScroll` directly for imperative flows or `lockScrollOnToggle` for popover-style elements that emit `beforetoggle`.

## Usage

```tsx
import { lockScroll, lockScrollOnToggle } from 'remix/ui/scroll-lock'

function DialogSurface() {
  return <div popover="auto" mix={lockScrollOnToggle()} />
}

function openModal() {
  let unlock = lockScroll()

  // Later, when the modal closes:
  unlock()
}
```

## API

- `lockScroll(document?)`: locks the target document and returns an idempotent unlock function.
- `lockScrollOnToggle()`: mixin that locks on `beforetoggle` open, unlocks on close, and releases the lock when the host unmounts.

## Behavior Notes

- The lock stores and restores the document element's inline `overflow` and `scrollbarGutter`.
- Scroll position is restored when the last active lock is released.
- Multiple locks are reference-counted, so the document stays locked until every unlock function has run.
- When a scrollbar is present and computed `scrollbar-gutter` is `auto`, the document reserves a stable gutter while locked.
- `lockScrollOnToggle` uses the host element's owner document.
