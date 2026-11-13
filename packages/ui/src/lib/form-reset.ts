// Runs `reset` after the control's owning form finishes a non-canceled reset. The `reset` event
// fires before the browser restores native control values, so the callback is deferred a task.
// Otherwise the browser's reset would overwrite anything the callback synced. A microtask is not
// enough: for a user-initiated reset it runs before the browser restores values.
export function onFormReset(
  control: { form: HTMLFormElement | null },
  signal: AbortSignal,
  reset: () => void,
) {
  control.form?.addEventListener(
    'reset',
    (event) => {
      setTimeout(() => {
        if (!event.defaultPrevented && !signal.aborted) {
          reset()
        }
      })
    },
    { signal },
  )
}
