import { clientEntry, type Handle, type RemixNode } from 'remix/component'
import { routes } from '../server/routes'

export const LightDarkToggle = clientEntry(
  `${routes.assets.href({ asset: 'light-dark-toggle.js' })}#LightDarkToggle`,
  (handle: Handle) => {
    let el: HTMLButtonElement | null = null
    let isDark = false
    return () => {
      return (
        <button
          css={{ height: '100%', width: '44px', cursor: 'pointer' }}
          connect={(node) => {
            el = node
            isDark = document.body.classList.contains('dark')
            handle.update()
          }}
          on={{
            click: () => {
              document.body.classList.toggle('dark')
              isDark = document.body.classList.contains('dark')
              handle.update()
            },
          }}
        >
          {isDark ? '💡' : '🌙'}
        </button>
      )
    }
  },
)
