BREAKING CHANGE: `handle.update()` now returns `Promise<AbortSignal>` instead of accepting an optional task callback.

- The promise is resolved when the update is complete (DOM is updated, tasks have run)
- The signal is aborted when the component updates again or is removed.

```tsx
let signal = await handle.update()
// dom is updated
// focus/scroll elements
// do fetches, etc.
```

Note that `await handle.update()` resumes on a microtask after the flush completes, so the browser may paint before your code runs. For work that must happen synchronously during the flush (e.g. measuring elements and triggering another update without flicker), continue to use `handle.queueTask()` instead.

```tsx
handle.update()
handle.queueTask(() => {
  let rect = widthReferenceNode.getBoundingClientRect()
  if (rect.width !== width) {
    width = rect.width
    handle.update()
  }
})
```
