import { clientEntry, type ComponentHandle } from '@remix-run/dom'

export let HydrationBadge = clientEntry(
  '/assets/hydration-badge.js#HydrationBadge',
  function HydrationBadge(handle: ComponentHandle) {
    let mounted = false
    handle.queueTask(() => {
      mounted = true
      handle.update()
    })
    return () => (
      <div
        style={{
          display: 'inline-block',
          border: '1px solid #2a3c60',
          borderRadius: '999px',
          padding: '4px 10px',
          fontSize: '12px',
          background: mounted ? '#0e3a24' : '#3b2e0f',
          color: '#f1f5ff',
        }}
      >
        {mounted ? 'Hydrated on client' : 'Server HTML only'}
      </div>
    )
  },
)
