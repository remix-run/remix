import { css } from 'remix/component'
import { Listbox, ListboxOption } from 'remix/ui'

let exampleLayoutCss = css({
  display: 'grid',
  gap: '1rem',
})

let listboxExampleCss = css({
  width: '16rem',
})

export default function example() {
  return () => (
    <div mix={exampleLayoutCss}>
      <Listbox initialLabel="Select an environment" mix={listboxExampleCss}>
        <ListboxOption value="local">Local</ListboxOption>
        <ListboxOption value="staging">Staging</ListboxOption>
        <ListboxOption value="production">Production</ListboxOption>
        <ListboxOption disabled value="archived">
          Archived
        </ListboxOption>
      </Listbox>

      <select defaultValue="archived" style={{ width: '16rem' }}>
        <option value="local">Local</option>
        <option value="staging">Staging</option>
        <option value="production">Production</option>
        <option disabled value="archived">
          Archived
        </option>
      </select>
    </div>
  )
}
