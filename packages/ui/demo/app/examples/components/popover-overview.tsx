// TODO: update this example to use the new popover API
import { css, on, type Handle } from 'remix/component'
import { Glyph, ui } from 'remix/ui'

import { popover } from '../../../../src/lib/popover/popover.ts'

export default function Example(handle: Handle) {
  let open = false

  return () => (
    <popover.context>
      <div mix={buttonRow}>
        <button
          mix={[
            popover.anchor({ placement: 'bottom' }),
            popover.focusOnHide(),
            ui.popover.button,
            on('click', () => {
              open = true
              handle.update()
            }),
          ]}
        >
          <span mix={ui.button.label}>View options</span>
          <Glyph mix={ui.button.icon} name="chevronDown" />
        </button>
      </div>

      <div
        mix={[
          popover.surface({
            open,
            onHide: () => {
              open = false
              handle.update()
            },
          }),
          ui.popover.surface,
        ]}
      >
        <div mix={panel}>
          <div mix={field}>
            <label mix={ui.text.label} htmlFor="grouping">
              Grouping
            </label>
            <select id="grouping" mix={[control]}>
              <option>No grouping</option>
              <option>Status</option>
              <option>Priority</option>
            </select>
          </div>

          <div mix={field}>
            <label mix={ui.text.label} htmlFor="ordering">
              Ordering
            </label>
            <select id="ordering" mix={[control, popover.focusOnShow()]}>
              <option>Manual</option>
              <option>Newest first</option>
              <option>Oldest first</option>
            </select>
          </div>

          <div mix={field}>
            <label mix={ui.text.label} htmlFor="closed-projects">
              Show closed projects
            </label>
            <select id="closed-projects" mix={control}>
              <option>All</option>
              <option>Open only</option>
              <option>Closed only</option>
            </select>
          </div>

          <div mix={actions}>
            <button
              mix={[
                ui.button.ghost,
                on('click', () => {
                  open = false
                  handle.update()
                }),
              ]}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </popover.context>
  )
}

let buttonRow = css({
  display: 'flex',
  gap: '12px',
})

let panel = css({
  display: 'grid',
  gridTemplateColumns: 'max-content minmax(0, 1fr)',
  columnGap: '12px',
  rowGap: '12px',
  alignItems: 'center',
  width: '24rem',
  padding: '12px',
})

let field = css({
  display: 'contents',
})

let control = css({
  width: '100%',
})

let actions = css({
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
  gridColumn: '1 / -1',
})
