import { type Handle, clientEntry, css, onSubmission } from 'remix/component'

export const SaveButton = clientEntry(
  import.meta.url,
  function SaveButton(handle: Handle<{ children: string }>) {
    let saving = false
    let failed = false

    return () => (
      <>
        <button
          type="submit"
          class="btn"
          mix={onSubmission(async (event, signal) => {
            saving = true
            failed = false
            handle.update()
            try {
              await event.finished
            } catch {
              if (!signal.aborted) failed = true
            }
            // The button's next submission, or its removal, aborts the signal.
            if (signal.aborted) return
            saving = false
            handle.update()
          })}
        >
          {saving ? 'Saving…' : handle.props.children}
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
