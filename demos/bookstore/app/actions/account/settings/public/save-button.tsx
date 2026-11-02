import { type FrameReloadStartEvent, type Handle, clientEntry, css, ref } from 'remix/component'

export const SaveButton = clientEntry(
  import.meta.url,
  function SaveButton(handle: Handle<{ children: string }>) {
    let button: HTMLButtonElement | undefined
    let save: FrameReloadStartEvent | undefined
    let failed = false

    handle.frame.addEventListener(
      'reloadStart',
      async (event) => {
        // Other forms and links in this frame reload it too, even links inside the form. Its own
        // submissions start from the form or one of its submit buttons.
        let form = button?.form
        let source = event.sourceElement
        let submitted =
          source === form || (source != null && 'form' in source && source.form === form)
        if (!form || !submitted) return
        save = event
        failed = false
        handle.update()
        try {
          await event.finished
        } catch (error) {
          // An `AbortError` means a newer navigation replaced this one, which shows its own state.
          failed = !(error instanceof DOMException && error.name === 'AbortError')
        }
        if (save !== event) return
        save = undefined
        handle.update()
      },
      { signal: handle.signal },
    )

    return () => (
      <>
        <button type="submit" class="btn" mix={ref((node) => (button = node))}>
          {save ? 'Saving…' : handle.props.children}
        </button>
        {/* Announced without moving focus. */}
        <span
          role="status"
          mix={css({ color: '#e74c3c', '&:not(:empty)': { marginLeft: '0.5rem' } })}
        >
          {failed ? 'Couldn’t save your settings. Try again.' : ''}
        </span>
      </>
    )
  },
)
