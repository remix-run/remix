import { css } from 'remix/component'
import { Listbox, ListboxOption } from 'remix/ui'

let listboxExampleCss = css({
  width: '16rem',
})

export default function example() {
  return () => (
    <div>
      <Listbox
        defaultValue="staging"
        initialLabel="Choose an environment"
        mix={listboxExampleCss}
        name="environment"
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
