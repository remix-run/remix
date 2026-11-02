Follow a form's own submissions with `rmx:form-submit-start`. When a form submission reloads a frame, Remix dispatches a `FormSubmitStartEvent` on the submit button, or on the form when no button submitted it, after the frame's `reloadStart`. It bubbles, and carries the submission's `formData`, its `sourceElement`, and the reload's `finished` promise, so a button or form can show pending or optimistic UI for its own submissions without checking where a reload came from. `formData` is `null` for GET submissions. Links, `frame.reload()`, and document navigations don't dispatch it.

```tsx
<button
  type="submit"
  mix={on('rmx:form-submit-start', async (event, signal) => {
    saving = event
    handle.update()
    await event.finished.catch(() => {})
    // The button's next submission, or its removal, aborts the signal.
    if (signal.aborted) return
    saving = undefined
    handle.update()
  })}
>
  {saving ? `Saving ${saving.formData?.get('title')}…` : 'Save'}
</button>
```
