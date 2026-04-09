import type { Targets } from 'lightningcss';
import type { CompiledRoutes } from './routes.ts';
type TransformedStyleDependency = {
    placeholder: string;
    type: 'import';
    url: string;
} | {
    placeholder: string;
    type: 'url';
    url: string;
};
export type TransformedStyle = {
    fingerprint: string | null;
    identityPath: string;
    rawCode: string;
    resolvedPath: string;
    sourceMap: string | null;
    stableUrlPathname: string;
    trackedFiles: string[];
    unresolvedDependencies: TransformedStyleDependency[];
};
export type TransformFailureState = {
    trackedFiles: readonly string[];
};
type TransformResult = {
    ok: true;
    value: TransformedStyle;
} | ({
    error: Error;
    ok: false;
} & TransformFailureState);
export type TransformArgs = {
    buildId: string | null;
    minify: boolean;
    routes: CompiledRoutes;
    sourceMaps: 'external' | 'inline' | null;
    targets: Targets | null;
};
type TransformRecord = {
    identityPath: string;
};
export declare function transformStyle(record: TransformRecord, args: TransformArgs): Promise<TransformResult>;
export {};
//# sourceMappingURL=transform.d.ts.map