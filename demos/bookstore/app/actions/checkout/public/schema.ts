import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'

export const ShippingAddressForm = fd.object({
  street: fd.text(s.string()),
  city: fd.text(s.string()),
  state: fd.text(s.string()),
  zip: fd.text(s.string()),
})
