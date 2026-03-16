import { css } from 'remix/component'
import { Glyph, Popover, theme, ui } from 'remix/ui'

let popoverExampleCss = css({
  display: 'inline-flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let popoverPanelCss = css({
  display: 'flex',
  flexDirection: 'column',
  width: '18rem',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '8rem',
})

export default function example() {
  return () => (
    <div mix={popoverExampleCss}>
      <button id="popover-overview-trigger" mix={ui.button.secondary} popovertarget="popover-overview">
        <span mix={ui.button.label}>Deployment actions</span>
        <Glyph mix={ui.button.icon} name="chevronDown" />
      </button>

      <Popover id="popover-overview" mix={ui.popover.surface}>
        <div mix={popoverPanelCss}>
          <p mix={ui.text.bodySm}>Popover content</p>
        </div>
      </Popover>
    </div>
  )
}
