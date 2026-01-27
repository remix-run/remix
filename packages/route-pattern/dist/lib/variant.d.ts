import type { ParseResult, Parse, Token, Variable, Wildcard, Text, Separator, Optional } from './parse.ts';
export type Variant<T extends string> = string extends T ? string : VariantString<Parse<T>, HasLeadingSlash<T>>;
type HasLeadingSlash<T extends string> = T extends `${string}://${string}` ? false : T extends `/${string}` ? true : false;
type VariantString<T extends Partial<ParseResult>, L extends boolean> = T extends {
    protocol: infer P extends Array<Token>;
} ? `${PartVariantString<P>}${VariantString<Omit<T, 'protocol'>, false>}` : T extends {
    hostname: infer H extends Array<Token>;
    port: infer P extends string;
} ? `://${PartVariantString<H, '.'>}:${P}${VariantString<Omit<T, 'hostname' | 'port'>, false> extends '' ? '' : `/${VariantString<Omit<T, 'hostname' | 'port'>, false>}`}` : T extends {
    hostname: infer H extends Array<Token>;
} ? `://${PartVariantString<H, '.'>}${VariantString<Omit<T, 'hostname'>, false> extends '' ? '' : `/${VariantString<Omit<T, 'hostname'>, false>}`}` : T extends {
    pathname: infer P extends Array<Token>;
} ? `${L extends true ? '/' : ''}${PartVariantString<P, '/'>}${VariantString<Omit<T, 'pathname'>, false>}` : T extends {
    search: infer S extends string;
} ? `?${S}` : '';
type PartVariantString<T extends Array<Token>, Sep extends string = '/'> = T extends [infer L extends Token, ...infer R extends Array<Token>] ? L extends Variable ? `:${L['name']}${PartVariantString<R, Sep>}` : L extends Wildcard ? (L extends {
    name: infer N extends string;
} ? `*${N}${PartVariantString<R, Sep>}` : `*${PartVariantString<R, Sep>}`) : L extends Text ? `${L['value']}${PartVariantString<R, Sep>}` : L extends Separator ? `${Sep}${PartVariantString<R, Sep>}` : L extends Optional ? `${PartVariantString<L['tokens'], Sep>}${PartVariantString<R, Sep>}` | PartVariantString<R, Sep> : never : '';
export {};
//# sourceMappingURL=variant.d.ts.map