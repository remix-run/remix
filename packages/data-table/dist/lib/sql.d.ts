export type SqlStatement = {
    text: string;
    values: unknown[];
};
export declare function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlStatement;
export declare function isSqlStatement(value: unknown): value is SqlStatement;
export declare function rawSql(text: string, values?: unknown[]): SqlStatement;
//# sourceMappingURL=sql.d.ts.map