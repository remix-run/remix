Follow a frame reload from its `reloadStart` event, which is now a `FrameReloadStartEvent` describing the effective request and how it ends. Its `src`, lowercase `method`, and `encType` align with `frame.reload()` options, with `body` exposed as `formData`. GET entries are included in `src`, while `formData` and `encType` are `null`. `element` identifies the initiating anchor, area, or owning form, and `submitter` identifies the actual submit button or is `null`. Programmatic reloads, programmatic navigations, and history traversal have no initiating element. Frames inside the reloading frame inherit these details while tracking their own reload completion.

```tsx
import type { FrameReloadOutcome } from 'remix/component'

let pending: Promise<FrameReloadOutcome> | undefined

handle.frame.addEventListener(
  'reloadStart',
  async (event) => {
    pending = event.finished
    handle.update()
    await event.finished
    if (pending !== event.finished) return
    pending = undefined
    handle.update()
  },
  { signal: handle.signal },
)
```

`finished` always resolves with a `FrameReloadOutcome`: `{ error: undefined, aborted: false }` after rendering, `{ error, aborted: false }` on failure, or `{ error: undefined, aborted: true }` on cancellation, replacement, or frame removal. Failures carry an `Error`, wrapping other thrown values with the original as `cause`. The promise returned by `frame.reload()` retains its rejection behavior. A replaced reload gets no `reloadComplete`, so `finished` is how a listener learns how its own reload ended.
