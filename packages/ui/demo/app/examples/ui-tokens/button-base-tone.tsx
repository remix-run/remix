import * as button from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import { buttonScrollRowCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={buttonScrollRowCss}>
      <button type="submit" mix={[button.baseStyle, button.primaryStyle]}>
        <Glyph mix={button.iconStyle} name="add" />
        <span mix={button.labelStyle}>Publish</span>
      </button>
      <a href="/components/button" mix={[button.baseStyle, button.secondaryStyle]}>
        <span mix={button.labelStyle}>View button docs</span>
        <Glyph mix={button.iconStyle} name="chevronRight" />
      </a>
    </div>
  )
}
