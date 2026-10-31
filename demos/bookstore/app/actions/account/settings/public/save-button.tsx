import { type FrameReloadEvent, type Handle, clientEntry, css, ref } from 'remix/component'

export const SaveButton = clientEntry(
  import.meta.url,
  function SaveButton(handle: Handle<{ children: string }>) {
    let button: HTMLButtonElement | undefined
    let save: FrameReloadEvent | undefined
    let failed = false

    handle.frame.addEventListener(
      'reloadStart',
      async (event) => {
        // Links reload the page too, even ones inside the form, such as Cancel. The form's own
        // submissions start from this button, or from the form itself with `requestSubmit()`.
        let form = button?.form
        if (!form || (event.sourceElement !== button && event.sourceElement !== form)) return
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
