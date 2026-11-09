Wrap the swap of a top-frame navigation in `document.startViewTransition()` with the new `frameTransition` option of `run()`. Remix calls it once the response is in and before the current page is replaced, so an app can animate between pages in the same document, including Back and Forward, without replacing `resolveFrame`:

```ts
import { run } from 'remix/component'

run({
  async frameTransition({ signal, commit }) {
    if (!document.startViewTransition || signal.aborted) return commit()
    let transition = document.startViewTransition(() => commit())
    signal.addEventListener('abort', () => transition.skipTransition(), { once: true })
    await transition.finished.catch(() => {})
  },
})
```

`commit()` swaps the new page in and resolves once the navigation has finished, scroll restoration included, so the browser captures the finished page. The function also receives the browser's `NavigationTransition`, the destination URL after redirects, and a signal that aborts when the navigation is cancelled or superseded. The new `FrameTransition` and `FrameTransitionOptions` types describe it.
