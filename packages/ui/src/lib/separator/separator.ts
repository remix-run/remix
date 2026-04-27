import { css, type CSSMixinDescriptor } from '@remix-run/component'

import { theme } from '../theme/theme.ts'

const itemInset = `var(--rmx-ui-item-inset, ${theme.space.sm})`
const itemIndicatorHalfInset =
  'calc((var(--rmx-ui-item-indicator-width, 0px) + var(--rmx-ui-item-indicator-gap, 0px)) / 2)'

const separatorCss: CSSMixinDescriptor = css({
  flexShrink: 0,
  margin: 0,
  marginBlock: theme.space.xs,
  marginInlineStart: `calc(${itemInset} + ${itemIndicatorHalfInset})`,
  marginInlineEnd: itemInset,
  border: 0,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
})

export const separatorStyle = separatorCss
