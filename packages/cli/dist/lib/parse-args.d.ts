export interface ParseArgsBooleanOptionSpec {
    flag: string;
    type: 'boolean';
}
export interface ParseArgsStringOptionSpec {
    flag: string;
    type: 'string';
}
export type ParseArgsOptionSpec = ParseArgsBooleanOptionSpec | ParseArgsStringOptionSpec;
export type ParseArgsOptionDefinitions = Record<string, ParseArgsOptionSpec>;
export interface ParseArgsOptions {
    maxPositionals?: number;
}
export type ParsedArgsValues<definitions extends ParseArgsOptionDefinitions> = {
    [key in keyof definitions]: definitions[key]['type'] extends 'boolean' ? boolean : string | undefined;
};
export interface ParsedArgsResult<definitions extends ParseArgsOptionDefinitions> {
    options: ParsedArgsValues<definitions>;
    positionals: string[];
}
export declare function parseArgs<const definitions extends ParseArgsOptionDefinitions>(argv: string[], definitions: definitions, options?: ParseArgsOptions): ParsedArgsResult<definitions>;
//# sourceMappingURL=parse-args.d.ts.map