import { css } from 'remix/component'
import { Glyph, theme, ui } from 'remix/ui'

export default function Example() {
  return () => (
    <div mix={frameCss}>
      <button mix={ui.menu.button}>
        <span mix={ui.button.label}>Project actions</span>
        <Glyph mix={ui.button.icon} name="chevronDown" />
      </button>
      <div mix={[ui.menu.popover, staticPopoverCss]}>
        <div role="menu" aria-label="Project actions" mix={ui.menu.list}>
          <button type="button" role="menuitem" mix={ui.menu.item}>
            <Glyph mix={ui.menu.itemGlyph} name="search" />
            <span mix={ui.menu.itemLabel}>Rename project</span>
          </button>
          <button type="button" role="menuitem" mix={ui.menu.trigger}>
            <span mix={ui.menu.itemLabel}>Open submenu</span>
            <Glyph mix={ui.menu.triggerGlyph} name="chevronRight" />
          </button>
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
