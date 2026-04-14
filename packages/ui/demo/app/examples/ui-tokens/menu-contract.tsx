import { css } from 'remix/component'
import * as button from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import * as menu from '@remix-run/ui/menu'
import * as popover from '@remix-run/ui/popover'
import { theme } from '@remix-run/ui/theme'
export default function Example() {
  return () => (
    <div mix={frameCss}>
      <button mix={[button.baseStyle, button.ghostStyle, menu.buttonStyle]}>
        <span mix={button.labelStyle}>Project actions</span>
        <Glyph mix={button.iconStyle} name="chevronDown" />
      </button>
      <div mix={[popover.surfaceStyle, menu.popoverStyle, staticPopoverCss]}>
        <div role="menu" aria-label="Project actions" mix={menu.listStyle}>
          <div role="menuitem" mix={menu.itemStyle}>
            <span mix={menu.itemSlotStyle}>
              <Glyph mix={menu.itemGlyphStyle} name="check" />
            </span>
            <span mix={menu.itemLabelStyle}>Rename project</span>
          </div>
          <div role="menuitemcheckbox" aria-checked="true" mix={menu.itemStyle}>
            <span mix={menu.itemSlotStyle}>
              <Glyph mix={menu.itemGlyphStyle} name="check" />
            </span>
            <span mix={menu.itemLabelStyle}>Notify on deploy</span>
          </div>
          <div role="menuitem" mix={menu.itemStyle}>
            <span mix={menu.itemSlotStyle}>
              <Glyph mix={menu.itemGlyphStyle} name="check" />
            </span>
            <span mix={menu.itemLabelStyle}>Open submenu</span>
            <Glyph mix={menu.triggerGlyphStyle} name="chevronRight" />
          </div>
        </div>
      </div>
    </div>
  )
}

let frameCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  width: '100%',
})

let staticPopoverCss = css({
  position: 'relative',
  inset: 'auto',
  opacity: 1,
})
