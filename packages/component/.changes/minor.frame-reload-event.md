Follow a frame reload from its `reloadStart` event, which is now a `FrameReloadEvent` that says what started the reload and how it ended, like the Navigation API's `NavigateEvent`. `sourceElement` is the link, form, or submit button whose navigation started the reload, `formData` holds the entries that a non-GET form submission or a POST `frame.reload()` sends, and `finished` resolves once the reload's content renders. Frames inside the reloading frame get the same `sourceElement` and `formData`, so pending and optimistic UI can follow its own form wherever it renders.

```tsx
let button: HTMLButtonElement | undefined
let saving: FrameReloadEvent | undefined

handle.frame.addEventListener(
  'reloadStart',
  async (event) => {
    // Other forms and links in the frame reload it too. The form's own submissions start from
    // the button, or from the form itself with `requestSubmit()`.
    let form = button?.form
    if (!form || (event.sourceElement !== button && event.sourceElement !== form)) return
    saving = event
    handle.update()
    await event.finished.catch(() => {})
    if (saving !== event) return
    saving = undefined
    handle.update()
  },
  { signal: handle.signal },
)
```

`finished` rejects with the failure when the reload fails, and with an `AbortError` `DOMException` when the reload is cancelled, a newer reload replaces it, or its frame is removed. A replaced reload gets no `reloadComplete`, so `finished` is how a listener learns how its own reload ended.
