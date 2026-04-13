import { css } from 'remix/component'
import { theme } from 'remix/ui'

export default function Example() {
  return () => <div mix={frameCss} />
}

let frameCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  width: '100%',
})
