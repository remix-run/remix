import { css } from 'remix/component'
import * as popover from '@remix-run/ui/popover'
import { theme } from '@remix-run/ui/theme'
export default function Example() {
  return () => (
    <div
      mix={[
        popover.surfaceStyle,
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
