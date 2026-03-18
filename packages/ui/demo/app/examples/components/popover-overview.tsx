import { css, on, type Handle } from 'remix/component'
import { Glyph, popover, ui } from 'remix/ui'

export default function Example(handle: Handle) {
  let popoverId = handle.id + '-popover'
  let open = false

  return () => (
    <div>
      <button
        id={handle.id}
        popovertarget={popoverId}
        mix={[
          ui.button.ghost,
          on('click', (event) => {
            event.preventDefault()
            open = !open
            handle.update()
          }),
        ]}
      >
        <span mix={ui.button.label}>Open Popover</span>
        <Glyph mix={ui.button.icon} name="chevronDown" />
      </button>

      {open ? (
        <div id={popoverId} key={popoverId} mix={popover({ placement: 'bottom-start' })}>
          <div mix={panel}>
            <p mix={ui.text.bodySm}>Popover content</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

let panel = css({
  display: 'flex',
  flexDirection: 'column',
  width: '18rem',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '8rem',
})
