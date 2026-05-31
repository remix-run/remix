import { css } from '@remix-run/ui'
import * as button from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import { theme } from '@remix-run/ui/theme'

/**
 * @name Basic Button
 * @description The default button contract supports both ordinary actions and link-shaped navigation.
 * @layout center
 * @order 1
 */
export default function Example() {
  return () => (
    <div mix={buttonRowCss}>
      <button type="submit" mix={[button.baseStyle, button.primaryStyle]}>
        <Glyph mix={button.iconStyle} name="add" />
        <span mix={button.labelStyle}>Publish</span>
      </button>
      <a href="/api/remix/ui/button/overview/" mix={[button.baseStyle, button.secondaryStyle]}>
        <span mix={button.labelStyle}>View button docs</span>
        <Glyph mix={button.iconStyle} name="chevronRight" />
      </a>
    </div>
  )
}

const buttonRowCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
})
