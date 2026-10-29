# Handle API

## `handle.frames.top`

This is useful when nested components need to reload the entire page/frame tree instead of only their nearest frame.

```tsx
function RefreshAllButton(handle: Handle) {
  return () => (
    <button
      mix={[
        on('click', async () => {
          await handle.frames.top.reload()
        }),
      ]}
    >
      Refresh everything
    </button>
  )
}
```

## `handle.frames.get(name)`

If multiple mounted frames share the same name, the most recently mounted frame is returned.
