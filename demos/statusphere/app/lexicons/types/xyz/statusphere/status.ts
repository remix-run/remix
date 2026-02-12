import type {} from '@atcute/lexicons'
import * as v from '@atcute/lexicons/validations'
import type {} from '@atcute/lexicons/ambient'

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.tidString(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal('xyz.statusphere.status'),
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * @minLength 1
     * @maxLength 32
     * @maxGraphemes 1
     */
    status: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(1, 32),
      /*#__PURE__*/ v.stringGraphemes(0, 1),
    ]),
  }),
)

type main$schematype = typeof _mainSchema

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module '@atcute/lexicons/ambient' {
  interface Records {
    'xyz.statusphere.status': mainSchema
  }
}
