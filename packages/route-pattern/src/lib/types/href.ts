import type { OptionalParams, RequiredParams } from './params'
import type * as Search from '../route-pattern/search.ts'

type ParamValue = string | number

// prettier-ignore
export type HrefArgs<source extends string> =
  [RequiredParams<source>] extends [never] ?
    [] | [null | undefined | Record<string, any>] | [null | undefined | Record<string, any>, Search.HrefParams] :
    [HrefParams<source>, Search.HrefParams] | [HrefParams<source>]

// prettier-ignore
type HrefParams<source extends string> =
  & Record<RequiredParams<source>, ParamValue>
  & Partial<Record<OptionalParams<source>, ParamValue | null | undefined>>
  & Record<string, unknown>
