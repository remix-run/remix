import type { OptionalParams, RequiredParams } from './params';
import type * as Search from '../route-pattern/search.ts';
type ParamValue = string | number;
export type HrefArgs<T extends string> = [
    RequiredParams<T>
] extends [never] ? [
] | [null | undefined | Record<string, any>] | [null | undefined | Record<string, any>, Search.HrefParams] : [
    HrefParams<T>,
    Search.HrefParams
] | [HrefParams<T>];
type HrefParams<T extends string> = Record<RequiredParams<T>, ParamValue> & Partial<Record<OptionalParams<T>, ParamValue | null | undefined>>;
export {};
//# sourceMappingURL=href.d.ts.map