type TrustedHTML = string & {
    readonly __trustedHTML: unique symbol;
};
type TrustedScript = string & {
    readonly __trustedScript: unique symbol;
};
interface TrustedTypePolicy {
    createHTML(html: string): TrustedHTML;
    createScript(script: string): TrustedScript;
}
export declare let policy: TrustedTypePolicy | undefined;
export declare function maybeTrustedInnerHTML(html: string): string | TrustedHTML;
export declare function maybeTrustedScript(script: string): string | TrustedScript;
export {};
//# sourceMappingURL=trusted-types.d.ts.map