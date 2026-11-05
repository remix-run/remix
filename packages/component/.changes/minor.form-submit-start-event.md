Add `onSubmission()` to follow a form's submissions with a typed `rmx:submission` event and show pending or optimistic UI. See [following a form submission](https://github.com/remix-run/remix/tree/main/packages/component#following-a-form-submission) for details.

```tsx
// Inside a hydrated component:
<button
  type="submit"
  mix={onSubmission(async (event, signal) => {
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
