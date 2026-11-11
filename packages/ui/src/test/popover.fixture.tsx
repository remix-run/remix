import { createRoot, on, type Handle } from '@remix-run/component'
import * as popover from '../popover.ts'
import { press } from '../press.ts'
import { Portal } from '../portal.tsx'

function PopoverFixture(handle: Handle) {
  let open = false
  return () => (
    <popover.Context>
      <button
        id="trigger"
        mix={[
          popover.anchor({ placement: 'bottom-start' }),
          popover.focusOnHide(),
          press(),
          on('click', () => {
            open = !open
            void handle.update()
          }),
        ]}
      >
        Open popover
      </button>
      <Portal>
        <div
          data-testid="popover"
          mix={popover.surface({
            open,
            onHide() {
              open = false
              void handle.update()
            },
          })}
        >
          <input id="field" aria-label="Field" mix={popover.focusOnShow()} />
        </div>
      </Portal>
    </popover.Context>
  )
}

const container = document.createElement('div')
container.id = 'app'
document.body.append(container)
createRoot(container).render(<PopoverFixture />)
