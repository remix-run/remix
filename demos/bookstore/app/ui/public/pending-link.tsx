import { clientEntry, on, type Handle } from 'remix/component'

export const PendingLink = clientEntry(
  import.meta.url,
  function PendingLink(
    handle: Handle<{
      href: string
      children: string
      class?: string
      prefetch?: 'intent' | 'viewport'
    }>,
  ) {
    let pending = false

    return () => (
      <a
        href={handle.props.href}
        class={handle.props.class}
        data-rmx-prefetch={handle.props.prefetch}
        aria-busy={pending}
        mix={on('rmx:navigation', async (event, signal) => {
          pending = true
          handle.update()
          try {
            await event.finished
          } catch {
            // The application runtime reports the failure.
          }
          if (signal.aborted) return
          pending = false
          handle.update()
        })}
      >
        {handle.props.children}
        {pending && <span class="navigation-spinner" aria-hidden="true" />}
      </a>
    )
  },
)
