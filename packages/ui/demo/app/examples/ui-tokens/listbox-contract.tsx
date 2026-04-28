import { css } from 'remix/ui'
import * as button from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import * as listbox from '@remix-run/ui/listbox'
import * as popover from '@remix-run/ui/popover'
import * as select from '@remix-run/ui/select'
import { theme } from '@remix-run/ui/theme'
export default function Example() {
  return () => (
    <div mix={frameCss}>
      <button type="button" mix={[button.baseStyle, select.triggerStyle, triggerCss]}>
        <span mix={button.labelStyle}>Backlog</span>
        <Glyph mix={button.iconStyle} name="chevronVertical" />
      </button>
      <div mix={[popover.surfaceStyle, staticPopoverCss]}>
        <div role="listbox" aria-label="Status" mix={[popover.contentStyle, listbox.listStyle]}>
          {options.map((option) => (
            <div
              key={option.value}
              aria-selected={option.value === 'backlog' ? 'true' : 'false'}
              mix={listbox.optionStyle}
              role="option"
            >
              <Glyph mix={listbox.glyphStyle} name="check" />
              <span mix={listbox.labelStyle}>{option.label}</span>
            </div>
          ))}
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

let triggerCss = css({
  width: '100%',
})

let staticPopoverCss = css({
  position: 'relative',
  inset: 'auto',
  opacity: 1,
})

let options = [
  { label: 'Backlog', value: 'backlog' },
  { label: 'In progress', value: 'in-progress' },
  { label: 'Review', value: 'review' },
  { label: 'Done', value: 'done' },
] as const
