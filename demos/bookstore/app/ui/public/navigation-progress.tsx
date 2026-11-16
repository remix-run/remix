import { clientEntry, css, type Handle } from 'remix/component'

import { navigation } from './navigation.ts'

export const NavigationProgress = clientEntry(
  import.meta.url,
  function NavigationProgress(handle: Handle) {
    if (navigation.supported) {
      navigation.addEventListener('change', () => handle.update(), { signal: handle.signal })
    }

    return () => (
      <div
        role="status"
        aria-live="polite"
        hidden={!navigation.current || navigation.current.target !== undefined}
        mix={css({
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 1000,
          padding: '0.75rem 1rem',
          backgroundColor: '#fff',
          color: '#2c3e50',
          borderRadius: '0.5rem',
          boxShadow: '0 2px 12px #0003',
          pointerEvents: 'none',
        })}
      >
        <span class="navigation-spinner" aria-hidden="true" /> Loading page…
      </div>
    )
  },
)
