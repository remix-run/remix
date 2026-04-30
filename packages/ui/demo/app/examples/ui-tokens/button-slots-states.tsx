import { css } from 'remix/ui'
import * as button from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import { buttonScrollRowCss, buttonSpinnerGlyphCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={buttonScrollRowCss}>
      <button mix={[button.baseStyle, button.primaryStyle]}>
        <Glyph mix={button.iconStyle} name="add" />
        <span mix={button.labelStyle}>New issue</span>
      </button>

      <button mix={[button.baseStyle, button.ghostStyle]}>
        <span mix={button.labelStyle}>Open</span>
        <Glyph mix={button.iconStyle} name="chevronRight" />
      </button>

      <button disabled mix={[button.baseStyle, button.secondaryStyle]}>
        <span mix={button.labelStyle}>Disabled</span>
      </button>

      <button aria-busy="true" mix={[button.baseStyle, button.secondaryStyle]}>
        <Glyph mix={[button.iconStyle, buttonSpinnerGlyphCss, spinCss]} name="spinner" />
        <span mix={button.labelStyle}>Saving</span>
      </button>
    </div>
  )
}

let spinCss = css({
  '@keyframes demo-button-spin': {
    from: {
      transform: 'rotate(0deg)',
    },
    to: {
      transform: 'rotate(360deg)',
    },
  },
  animation: 'demo-button-spin 1s linear infinite',
})
