import { css } from 'remix/component'
import { theme, ui } from 'remix/ui'

export default function Example() {
  return () => (
    <div
      mix={[
        ui.popover.surface,
        // override hidden state
        css({
          opacity: 1,
          position: 'relative',
          inset: 'auto',
          padding: theme.space.xxl,
        }),
      ]}
    >
      Floating popover surfaces
    </div>
  )
}
