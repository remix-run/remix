import { type FormSubmitStartEvent, type Handle, clientEntry, css, on } from 'remix/component'

export const SaveButton = clientEntry(
  import.meta.url,
  function SaveButton(handle: Handle<{ children: string }>) {
    let save: FormSubmitStartEvent | undefined
    let failed = false

    return () => (
      <>
        <button
          type="submit"
          class="btn"
          mix={on('rmx:form-submit-start', async (event, signal) => {
            save = event
            failed = false
            handle.update()
            try {
              await event.finished
            } catch (error) {
              // An `AbortError` means a newer navigation replaced this one, which shows its own state.
              failed = !(error instanceof DOMException && error.name === 'AbortError')
            }
            // The button's next submission, or its removal, aborts the signal.
            if (signal.aborted) return
            save = undefined
            handle.update()
          })}
        >
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
