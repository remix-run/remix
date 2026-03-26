import * as coerce from 'remix/data-schema/coerce'
import * as f from 'remix/data-schema/form-data'
import * as s from 'remix/data-schema'

const messageLimitSchema = f.object({
  limit: f.field(s.optional(coerce.number())),
})

export function getMessageLimit(url: URL): number | null {
  let result = s.parseSafe(messageLimitSchema, url.searchParams)

  if (!result.success || !result.value.limit) {
    return null
  }

  return result.value.limit
}
