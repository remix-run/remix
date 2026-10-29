import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'

export const ContactForm = fd.object({
  name: fd.text(s.string()),
  email: fd.text(s.string()),
  message: fd.text(s.string()),
})
