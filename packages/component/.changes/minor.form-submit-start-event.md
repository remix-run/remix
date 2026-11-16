Follow links, form submissions, programmatic navigation, and Back/Forward with the typed `rmx:navigation` event to show pending or optimistic UI. See [following a navigation](https://github.com/remix-run/remix/tree/main/packages/component#following-a-navigation) for details.

```tsx
// Inside a hydrated component:
<button
  type="submit"
  mix={on('rmx:navigation', async (event, signal) => {
    saving = true
    handle.update()
    await event.finished.catch(console.error)
    if (signal.aborted) return
    saving = false
    handle.update()
  })}
>
  {saving ? 'Saving…' : 'Save'}
</button>
```

`NavigationEvent.frameSrc` is the originally requested frame URL, including GET submission values. `element` identifies the initiating HTML or SVG anchor, image-map area, or owning form, and is null for programmatic navigation and history traversal. `submitter` is optional, and `encType` and `formData` are only present for POST submissions.

`finished` waits through rendering, followed redirects, and navigation scroll and focus handling. It resolves with an aborted signal on cancellation or replacement and rejects on failure.

Listen on `window` in capture mode for application-wide navigation state. Events fire at navigation acceptance, before `reloadStart`, and expose request and lifecycle metadata directly on the event. `navigationType` and `from` align with `resolveFrame` options; `frameSrc` and `frameTarget` correspond to its `src` argument and `target` option. Native `event.target` remains the DOM dispatch target. Redirects notify window with an updated `to` URL and the same `finished` promise and signal; disconnected sources also notify window directly.
