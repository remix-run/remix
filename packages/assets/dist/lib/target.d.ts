import type { Targets as LightningCssTargets } from 'lightningcss';
declare const browserTargetNames: readonly ["chrome", "edge", "firefox", "ie", "ios", "opera", "safari", "samsung"];
export type AssetTargetVersion = `${number}` | `${number}.${number}` | `${number}.${number}.${number}`;
export type BrowserTargetName = (typeof browserTargetNames)[number];
export type ResolvedScriptTarget = string[];
export type ResolvedStyleTarget = LightningCssTargets;
export interface AssetTarget {
    chrome?: AssetTargetVersion;
    edge?: AssetTargetVersion;
    firefox?: AssetTargetVersion;
    ie?: AssetTargetVersion;
    ios?: AssetTargetVersion;
    opera?: AssetTargetVersion;
    safari?: AssetTargetVersion;
    samsung?: AssetTargetVersion;
    es?: string;
}
export declare function resolveScriptTarget(target: AssetTarget | undefined): ResolvedScriptTarget | undefined;
export declare function resolveStyleTarget(target: AssetTarget | undefined): ResolvedStyleTarget | undefined;
export {};
//# sourceMappingURL=target.d.ts.map