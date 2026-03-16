import { css, on, type Handle } from 'remix/component'
import { Listbox, ListboxOption, ui } from 'remix/ui'

let listboxWidthCss = css({
  width: '16rem',
})

let environmentOptions = [
  { label: 'Local', value: 'local' },
  { label: 'Staging', value: 'staging' },
  { label: 'Production', value: 'production' },
] as const

export default function example(handle: Handle) {
  let value: string | null = 'staging'

  function setValue(nextValue: string | null) {
    value = nextValue
    void handle.update()
  }

  return () => (
    <div mix={[ui.stack, ui.gap.sm]}>
      <div mix={[ui.row, ui.row.wrap, ui.gap.xs]}>
        {environmentOptions.map(option => (
          <button
            mix={[
              value === option.value ? ui.button.primary : ui.button.secondary,
              on('click', () => {
                setValue(option.value)
              }),
            ]}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <Listbox
        initialLabel="Choose an environment"
        mix={[
          listboxWidthCss,
          on(Listbox.change, event => {
            setValue(event.value)
          }),
        ]}
        value={value}
      >
        <ListboxOption value="local">Local</ListboxOption>
        <ListboxOption value="staging">Staging</ListboxOption>
        <ListboxOption value="production">Production</ListboxOption>
        <ListboxOption disabled value="archived">
          Archived
        </ListboxOption>
      </Listbox>
    </div>
  )
}
