Build custom dialogs with `@remix-run/ui/dialog`. Compose a `Context` with trigger, surface, backdrop, title, description, close, and focus mixins. Wrap the surface in `dialog.SurfaceContext`, inside `dialog.Portal` when portaled, for declarative focus guards that preserve browser tab navigation and wrap focus when it reaches a boundary. Dialogs support controlled or uncontrolled state, cancelable changes, modal and non-modal behavior, focus trapping and restoration, nested dismissal, and exit transitions with nesting support.

```tsx
<dialog.Context>
  <button mix={dialog.trigger()}>Open dialog</button>
  <dialog.Portal>
    <dialog.SurfaceContext>
      <section aria-label="Dialog" mix={dialog.surface()}>
        <button mix={dialog.close()}>Close</button>
      </section>
    </dialog.SurfaceContext>
  </dialog.Portal>
</dialog.Context>
```

Use `dialog.Portal` to render outside clipping ancestors. Keep `dialog.SurfaceContext` inside it, or omit the Portal for inline rendering.
