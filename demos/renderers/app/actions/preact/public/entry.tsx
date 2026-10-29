import { hydrate } from 'preact'

import { EntryForm, type EntryFormProps } from './entry-form.tsx'

// The server rendered the form and serialized its props next to it. Hydrate in place so the
// markup is reused and Preact takes over event handling.
const root = document.getElementById('entry-form')
const propsScript = document.getElementById('entry-form-props')

if (root && propsScript?.textContent) {
  let props: EntryFormProps = JSON.parse(propsScript.textContent)
  hydrate(<EntryForm {...props} />, root)
}
