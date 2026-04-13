import { css, on, type Handle } from 'remix/component'
import { listbox, type ListboxValue } from '../../../../src/lib/listbox/listbox.ts'
import { Glyph, ui, theme } from 'remix/ui'

export default function Example(handle: Handle) {
  let value: ListboxValue = options[0].value
  let activeValue: ListboxValue = options[0].value
  let flashSelection = false

  return () => {
    return (
      <div mix={[ui.stack, ui.gap.lg]}>
        <listbox.context
          value={value}
          activeValue={activeValue}
          flashSelection={flashSelection}
          onSelect={(nextValue) => {
            console.log('onSelect', nextValue)
            value = nextValue
            handle.update()
          }}
          onHighlight={(nextActiveValue) => {
            activeValue = nextActiveValue
            handle.update()
          }}
        >
          <div tabIndex={0} mix={[listbox.list(), containerCss]}>
            {options.map((option) => (
              <div key={option.value} mix={[ui.listbox.option, listbox.option(option)]}>
                <Glyph mix={ui.listbox.glyph} name="check" />
                <span mix={ui.listbox.label}>{option.label}</span>
              </div>
            ))}
          </div>
        </listbox.context>
        <div>
          <label>
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
