Build custom dialogs with `@remix-run/ui/dialog`. Compose a `Context` with trigger, surface, backdrop, title, description, close, and focus mixins. Wrap the surface in `dialog.SurfaceContext`, inside `dialog.Portal` when portaled, for declarative focus guards that preserve browser Tab navigation and wrap focus when it reaches a boundary. Dialogs support controlled or uncontrolled state, cancelable changes, modal and non-modal behavior, focus trapping and restoration, nested dismissal, and exit transitions with nesting support.

Global `toast.root()` regions remain interactive while a modal dialog is open. Toast actions keep the modal open while dismissing transient popups, and Escape handled by a notification does not dismiss underlying layers. By default, closing a dialog preserves notification focus and updates the remembered return target, including when a notification action closes both its originating popup and dialog. Explicit dialog focus return targets take precedence when closing completes.

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

Use `dialog.Portal` to render outside clipping ancestors and coordinate non-modal keyboard and accessibility navigation with its declaration position. Its `container` prop selects a destination in the same document's light DOM. `dialog.Portal` must be declared outside a shadow root and use a container outside shadow roots. Keep `dialog.SurfaceContext` inside it, or omit the Portal for inline rendering.
