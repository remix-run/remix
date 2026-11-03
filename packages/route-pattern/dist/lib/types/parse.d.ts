import type { Split, SplitPattern } from './split.ts';
import type { ForceDistributive } from './utils.ts';
export interface ParsedPattern {
    protocol: Token[] | undefined;
    hostname: Token[] | undefined;
    port: string | undefined;
    pathname: Token[] | undefined;
    search: string | undefined;
}
export type Parse<T extends string> = string extends T ? ParsedPattern : T extends ForceDistributive ? Split<T> extends infer S extends SplitPattern ? ParseSplit<S> : never : never;
type ParseSplit<S extends SplitPattern> = S['protocol'] extends string ? ParseProtocol<S['protocol']> extends infer protocol ? [
    protocol
] extends [never] ? never : protocol extends Token[] | undefined ? ParseParts<S, protocol> : never : never : ParseParts<S, undefined>;
type ParseParts<S extends SplitPattern, protocol extends Token[] | undefined> = ParseMaybePart<S['hostname'], '.'> extends infer hostname ? [
    hostname
] extends [never] ? never : hostname extends Token[] | undefined ? ParseMaybePart<S['pathname'], '/'> extends infer pathname ? [
    pathname
] extends [never] ? never : pathname extends Token[] | undefined ? Parsed<S, protocol, hostname, pathname> : never : never : never : never;
type ParseMaybePart<T, Sep extends string> = T extends string ? ParsePart<T, Sep> extends infer tokens extends Token[] ? ValidatePart<tokens> : never : undefined;
type Parsed<S extends SplitPattern, protocol extends Token[] | undefined, hostname extends Token[] | undefined, pathname extends Token[] | undefined> = {
    protocol: protocol;
    hostname: hostname;
    port: S['port'] extends string ? S['port'] : undefined;
    pathname: pathname;
    search: S['search'] extends string ? S['search'] : undefined;
};
type ParseProtocol<T extends string> = T extends '' ? undefined : T extends 'http' | 'https' | 'http(s)' ? [{
    type: 'text';
    value: T;
}] : never;
export type Variable = {
    type: 'variable';
    name: string;
};
export type Wildcard = {
    type: 'wildcard';
    name?: string;
};
export type Text = {
    type: 'text';
    value: string;
};
export type Separator = {
    type: 'separator';
};
export type Optional = {
    type: 'optional';
    tokens: Token[];
};
export type Token = Variable | Wildcard | Text | Separator | Optional;
type ParsePartState = {
    tokens: Token[];
    optionals: Array<Token[]>;
    rest: string;
};
type ParsePart<T extends string, Sep extends string = ''> = _ParsePart<{
    tokens: [];
    optionals: [];
    rest: T;
}, Sep, [
]>;
type _ParsePart<S extends ParsePartState, Sep extends string = '', depth extends unknown[] = []> = depth['length'] extends 64 ? Token[] : S extends {
    rest: `${infer Head}${infer Tail}`;
} ? Head extends Sep ? _ParsePart<AppendToken<S, {
    type: 'separator';
}, Tail>, Sep, [...depth, unknown]> : Head extends ':' ? IdentifierParse<Tail> extends {
    identifier: infer name extends string;
    rest: infer rest extends string;
} ? (name extends '' ? never : _ParsePart<AppendToken<S, {
    type: 'variable';
    name: name;
}, rest>, Sep, [...depth, unknown]>) : never : Head extends '*' ? IdentifierParse<Tail> extends {
    identifier: infer name extends string;
    rest: infer rest extends string;
} ? _ParsePart<AppendToken<S, (name extends '' ? {
    type: 'wildcard';
} : {
    type: 'wildcard';
    name: name;
}), rest>, Sep, [...depth, unknown]> : never : Head extends '(' ? _ParsePart<PushOptional<S, Tail>, Sep, [...depth, unknown]> : Head extends ')' ? PopOptional<S, Tail> extends infer next extends ParsePartState ? _ParsePart<next, Sep, [...depth, unknown]> : never : Head extends '\\' ? Tail extends `${infer L}${infer R}` ? _ParsePart<AppendText<S, L, R>, Sep, [...depth, unknown]> : never : _ParsePart<AppendText<S, Head, Tail>, Sep, [...depth, unknown]> : S['optionals'] extends [] ? S['tokens'] : never;
type ValidatePart<tokens extends Token[]> = Token[] extends tokens ? tokens : ValidateTokens<tokens> extends true ? tokens : never;
type ValidateTokens<tokens extends Token[]> = tokens extends [infer token extends Token, ...infer rest extends Token[]] ? token extends {
    type: 'optional';
    tokens: infer optional extends Token[];
} ? optional extends [] ? false : ValidateTokens<optional> extends false ? false : HasAdjacentOptionalAmbiguity<optional, rest> extends true ? false : CanEndWithWildcard<optional> extends true ? CanStartWithWildcard<rest> extends true ? false : ValidateTokens<rest> : ValidateTokens<rest> : token extends {
    type: 'variable';
} ? ValidAfterParam<rest> extends true ? ValidateTokens<rest> : false : token extends {
    type: 'wildcard';
} ? CanStartWithWildcard<rest> extends true ? false : ValidateTokens<rest> : ValidateTokens<rest> : true;
type ValidAfterParam<tokens extends Token[]> = tokens extends [] ? true : tokens extends [{
    type: 'separator';
} | {
    type: 'wildcard';
}, ...Token[]] ? true : tokens extends [{
    type: 'text';
    value: `.${string}`;
}, ...Token[]] ? true : tokens extends [{
    type: 'optional';
    tokens: infer optional extends Token[];
}, ...infer rest extends Token[]] ? AllStartsAreParamDelimiters<optional> extends true ? ValidAfterParam<rest> : false : false;
type AllStartsAreParamDelimiters<tokens extends Token[]> = tokens extends [] ? true : tokens extends [{
    type: 'separator';
} | {
    type: 'wildcard';
}, ...Token[]] ? true : tokens extends [{
    type: 'text';
    value: `.${string}`;
}, ...Token[]] ? true : tokens extends [{
    type: 'optional';
    tokens: infer optional extends Token[];
}, ...infer rest extends Token[]] ? AllStartsAreParamDelimiters<optional> extends true ? AllStartsAreParamDelimiters<rest> : false : false;
type CanStartWithWildcard<tokens extends Token[]> = tokens extends [{
    type: 'wildcard';
}, ...Token[]] ? true : tokens extends [{
    type: 'optional';
    tokens: infer optional extends Token[];
}, ...infer rest extends Token[]] ? CanStartWithWildcard<optional> extends true ? true : CanStartWithWildcard<rest> : false;
type CanEndWithWildcard<tokens extends Token[]> = tokens extends [...Token[], {
    type: 'wildcard';
}] ? true : tokens extends [...infer rest extends Token[], {
    type: 'optional';
    tokens: infer optional extends Token[];
}] ? CanEndWithWildcard<optional> extends true ? true : CanEndWithWildcard<rest> : false;
type HasAdjacentOptionalAmbiguity<optional extends Token[], rest extends Token[]> = rest extends [{
    type: 'optional';
    tokens: infer next extends Token[];
}, ...Token[]] ? TokenStructure<optional> extends TokenStructure<next> ? TokenStructure<next> extends TokenStructure<optional> ? CaptureSchema<optional> extends CaptureSchema<next> ? false : true : false : false : false;
type TokenStructure<tokens extends Token[], result extends string = ''> = tokens extends [infer token extends Token, ...infer rest extends Token[]] ? token extends {
    type: 'variable';
} ? TokenStructure<rest, `${result}:|`> : token extends {
    type: 'wildcard';
} ? TokenStructure<rest, `${result}*|`> : token extends {
    type: 'separator';
} ? TokenStructure<rest, `${result}/|`> : token extends {
    type: 'text';
    value: infer value extends string;
} ? TokenStructure<rest, `${result}t:${value}|`> : token extends {
    type: 'optional';
    tokens: infer optional extends Token[];
} ? TokenStructure<rest, `${result}(${TokenStructure<optional>})|`> : never : result;
type CaptureSchema<tokens extends Token[], result extends string = ''> = tokens extends [infer token extends Token, ...infer rest extends Token[]] ? token extends {
    type: 'variable';
    name: infer name extends string;
} ? CaptureSchema<rest, `${result}::${name}|`> : token extends {
    type: 'wildcard';
    name: infer name extends string;
} ? CaptureSchema<rest, `${result}*:${name}|`> : token extends {
    type: 'wildcard';
} ? CaptureSchema<rest, `${result}*:*|`> : token extends {
    type: 'optional';
    tokens: infer optional extends Token[];
} ? CaptureSchema<rest, `${result}(${CaptureSchema<optional>})|`> : CaptureSchema<rest, result> : result;
type AppendToken<S extends ParsePartState, token extends Token, rest extends string> = S['optionals'] extends [...infer O extends Array<Token[]>, infer Top extends Token[]] ? {
    tokens: S['tokens'];
    optionals: [...O, [...Top, token]];
    rest: rest;
} : {
    tokens: [...S['tokens'], token];
    optionals: S['optionals'];
    rest: rest;
};
type AppendText<S extends ParsePartState, text extends string, rest extends string> = S['optionals'] extends [...infer O extends Array<Token[]>, infer Top extends Token[]] ? (Top extends [...infer Tokens extends Array<Token>, {
    type: 'text';
    value: infer value extends string;
}] ? {
    tokens: S['tokens'];
    optionals: [...O, [...Tokens, {
        type: 'text';
        value: `${value}${text}`;
    }]];
    rest: rest;
} : {
    tokens: S['tokens'];
    optionals: [...O, [...Top, {
        type: 'text';
        value: text;
    }]];
    rest: rest;
}) : (S['tokens'] extends [...infer Tokens extends Array<Token>, {
    type: 'text';
    value: infer value extends string;
}] ? {
    tokens: [...Tokens, {
        type: 'text';
        value: `${value}${text}`;
    }];
    optionals: S['optionals'];
    rest: rest;
} : {
    tokens: [...S['tokens'], {
        type: 'text';
        value: text;
    }];
    optionals: S['optionals'];
    rest: rest;
});
type PushOptional<S extends ParsePartState, rest extends string> = {
    tokens: S['tokens'];
    optionals: [...S['optionals'], []];
    rest: rest;
};
type PopOptional<S extends ParsePartState, R extends string> = S['optionals'] extends [
    ...infer O extends Array<Token[]>,
    infer Top extends Array<Token>
] ? O extends [...infer OO extends Array<Token[]>, infer Parent extends Token[]] ? {
    tokens: S['tokens'];
    optionals: [...OO, [...Parent, {
        type: 'optional';
        tokens: Top;
    }]];
    rest: R;
} : {
    tokens: [...S['tokens'], {
        type: 'optional';
        tokens: Top;
    }];
    optionals: [];
    rest: R;
} : never;
type _a_z = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';
type _A_Z = Uppercase<_a_z>;
type _0_9 = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type IdentifierHead = _a_z | _A_Z | '_' | '$';
type IdentifierTail = IdentifierHead | _0_9;
type IdentifierParse<T extends string> = _IdentifierParse<{
    identifier: '';
    rest: T;
}>;
type _IdentifierParse<S extends {
    identifier: string;
    rest: string;
}> = S extends {
    identifier: '';
    rest: `${infer Head extends IdentifierHead}${infer Tail}`;
} ? _IdentifierParse<{
    identifier: Head;
    rest: Tail;
}> : S extends {
    identifier: string;
    rest: `${infer Head extends IdentifierTail}${infer Tail}`;
} ? _IdentifierParse<{
    identifier: `${S['identifier']}${Head}`;
    rest: Tail;
}> : S;
export {};
//# sourceMappingURL=parse.d.ts.map