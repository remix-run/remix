import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/form'

export const AdminUserForm = fd.object({
  name: fd.text(s.string()),
  email: fd.text(s.string()),
  role: fd.text(s.union([s.literal('customer'), s.literal('admin')])),
})
