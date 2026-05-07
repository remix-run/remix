import type { FileStorage } from '@remix-run/file-storage';
export interface AssetFileTransformResult {
    content: string | Uint8Array;
    extension?: string;
}
type AssetRequestTransformParamMode = true | 'optional' | undefined;
declare const assetRequestTransformTypes: unique symbol;
type AssetRequestTransformTypes<param extends string, mode extends AssetRequestTransformParamMode> = {
    input: param;
    mode: mode;
};
export interface AssetTransformContext {
    extension: string;
    filePath: string;
}
type AssetRequestTransformRuntimeParam<mode extends AssetRequestTransformParamMode> = mode extends true ? string : mode extends 'optional' ? string | undefined : undefined;
export interface AssetRequestTransformContext<mode extends AssetRequestTransformParamMode = undefined> extends AssetTransformContext {
    param: AssetRequestTransformRuntimeParam<mode>;
}
export interface AssetGlobalTransformContext extends AssetTransformContext {
}
export type AssetRequestTransform<param extends string = string, mode extends AssetRequestTransformParamMode = undefined> = {
    readonly [assetRequestTransformTypes]?: AssetRequestTransformTypes<param, mode>;
    /**
     * Optional list of file extensions this transform accepts. Values must use `.ext` format.
     * Matching is evaluated against the current extension at this point in the transform pipeline.
     */
    extensions?: readonly string[];
    transform(bytes: Uint8Array, context: AssetRequestTransformContext<mode>): string | Uint8Array | AssetFileTransformResult | Promise<string | Uint8Array | AssetFileTransformResult>;
} & (mode extends undefined ? {
    param?: undefined;
} : {
    param: mode;
});
type AssetGlobalTransformHandler = (bytes: Uint8Array, context: AssetGlobalTransformContext) => string | Uint8Array | AssetFileTransformResult | null | Promise<string | Uint8Array | AssetFileTransformResult | null>;
export type AssetGlobalTransform = AssetGlobalTransformHandler | {
    /**
     * Optional list of file extensions this transform accepts. Values must use `.ext` format.
     * Non-matching files are skipped automatically.
     */
    extensions?: readonly string[];
    name?: string;
    transform: AssetGlobalTransformHandler;
};
interface ResolvedAssetGlobalTransform {
    extensions?: readonly string[];
    name?: string;
    transform: AssetGlobalTransformHandler;
}
export type AssetRequestTransformMap = Readonly<Record<string, AssetRequestTransform<string, AssetRequestTransformParamMode>>>;
export interface AssetServerFilesOptions<transforms extends AssetRequestTransformMap = {}> {
    /**
     * File extensions to expose as leaf assets. Values must include the leading dot,
     * for example `['.png', '.svg', '.woff2']`.
     */
    extensions: readonly string[];
    /**
     * Named transforms that can be requested from asset URLs.
     */
    transforms?: transforms;
    /**
     * Maximum number of request transforms allowed in a single asset URL.
     * Defaults to `5`.
     */
    maxRequestTransforms?: number;
    /**
     * Ordered transforms that run for every served file asset and may return `null`
     * to skip themselves for a given input.
     */
    globalTransforms?: readonly AssetGlobalTransform[];
    /**
     * Optional backing store for cached transformed file outputs.
     */
    cache?: FileStorage;
}
export interface ResolvedAssetServerFilesOptions<transforms extends AssetRequestTransformMap = {}> {
    cache?: FileStorage;
    extensions: readonly string[];
    globalTransforms: readonly ResolvedAssetGlobalTransform[];
    hasTransforms: boolean;
    maxRequestTransforms: number;
    transforms: transforms;
}
type AssetTransformStep<name extends string, param extends string, mode extends AssetRequestTransformParamMode> = mode extends true ? readonly [name, param] : mode extends 'optional' ? name | readonly [name] | readonly [name, param] : name | readonly [name];
export type AssetTransformInvocation<transforms extends AssetRequestTransformMap> = {
    [name in keyof transforms & string]: transforms[name] extends {
        readonly [assetRequestTransformTypes]?: infer types;
    } ? types extends {
        input: infer param extends string;
        mode: infer mode extends AssetRequestTransformParamMode;
    } ? AssetTransformStep<name, param, mode> : never : never;
}[keyof transforms & string];
export declare function defineFileTransform(transform: AssetRequestTransform<string, undefined>): AssetRequestTransform<string, undefined>;
export declare function defineFileTransform<const param extends string = string>(transform: AssetRequestTransform<param, true>): AssetRequestTransform<param, true>;
export declare function defineFileTransform<const param extends string = string>(transform: AssetRequestTransform<param, 'optional'>): AssetRequestTransform<param, 'optional'>;
export declare function normalizeFilesOptions<transforms extends AssetRequestTransformMap>(files: AssetServerFilesOptions<transforms> | undefined): ResolvedAssetServerFilesOptions<transforms>;
export declare function serializeAssetTransformInvocations<transforms extends AssetRequestTransformMap>(transforms: readonly AssetTransformInvocation<transforms>[], transformsByName: transforms, maxTransforms?: number): string[];
export declare function parseAssetTransformInvocations<transforms extends AssetRequestTransformMap>(transformsQuery: readonly string[], transformsByName: transforms, maxTransforms?: number): readonly (string | readonly [string, string])[];
export {};
//# sourceMappingURL=config.d.ts.map