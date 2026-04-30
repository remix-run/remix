import { css, on, type Handle } from 'remix/ui'
import { Glyph } from '@remix-run/ui/glyph'
import * as listbox from '@remix-run/ui/listbox'
import type { ListboxValue } from '@remix-run/ui/listbox'
import { theme } from '@remix-run/ui/theme'
export default function Example(handle: Handle) {
  let value: ListboxValue = options[0].value
  let activeValue: ListboxValue = options[0].value
  let flashSelection = false

  return () => {
    return (
      <div mix={stackCss}>
        <listbox.Context
          value={value}
          activeValue={activeValue}
          flashSelection={flashSelection}
          onSelect={(nextValue) => {
            value = nextValue
            handle.update()
          }}
          onHighlight={(nextActiveValue) => {
            activeValue = nextActiveValue
            handle.update()
          }}
        >
          <div tabIndex={0} mix={[listbox.listStyle, listbox.list(), containerCss]}>
            {options.map((option) => (
              <div key={option.value} mix={[listbox.optionStyle, listbox.option(option)]}>
                <Glyph mix={listbox.glyphStyle} name="check" />
                <span mix={listbox.labelStyle}>{option.label}</span>
              </div>
            ))}
          </div>
        </listbox.Context>
        <div mix={controlsCss}>
          <label mix={checkboxLabelCss}>
            <input
              type="checkbox"
              defaultChecked={flashSelection}
              mix={on('change', (event) => {
                flashSelection = event.currentTarget.checked
                handle.update()
              })}
            />{' '}
            Flash selection
          </label>
          <p mix={valueCss}>{`value=${value ?? 'null'}`}</p>
        </div>
      </div>
    )
  }
}

let options = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
  { label: 'Date', value: 'date' },
  { label: 'Elderberry', value: 'elderberry' },
  { label: 'Fig', value: 'fig' },
  { label: 'Grape', value: 'grape' },
] as const

let containerCss = css({
  borderColor: theme.colors.border.subtle,
  padding: theme.space.xs,
  borderRadius: theme.radius.lg,
  borderStyle: 'solid',
})

let stackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  width: '100%',
})

let controlsCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let checkboxLabelCss = css({
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.secondary,
})

let valueCss = css({
  margin: 0,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
})
