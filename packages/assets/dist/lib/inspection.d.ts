import type { AccessPolicy, AssetAccessDetails } from './access.ts';
import type { CompiledRoutes } from './routes.ts';
/** How the asset server handles an inspected file. */
export type AssetKind = 'file' | 'script' | 'style' | 'unsupported';
/** Browser-reachability result for an inspected asset. */
export type AssetStatus = 'denied' | 'missing' | 'not-allowed' | 'reachable' | 'unmapped' | 'unsupported';
/** Diagnostic information about a configured asset URL or file path. */
export interface AssetDetails {
    /** Access-control decision and the rules responsible for it. */
    access?: AssetAccessDetails;
    /** Absolute mapped file path. */
    filePath?: string;
    /** Configured filesystem mount root that matched the asset. */
    fileRoot?: string;
    /** Browser-reachability result. */
    status: AssetStatus;
    /** How the asset server handles the file. */
    type?: AssetKind;
    /** Stable public URL pathname for the asset. */
    url?: string;
    /** Public mount root that matched the asset. */
    urlRoot?: string;
}
interface AssetInspectorOptions {
    accessPolicy: AccessPolicy;
    allowFiles: readonly string[];
    fileExtensions: readonly string[];
    rootDir: string;
    routes: CompiledRoutes;
}
export interface AssetInspector {
    /** Returns diagnostic information for a public URL or file path. */
    getAssetDetails(input: string): Promise<AssetDetails>;
    /** Returns every file currently reachable through the configured asset server. */
    getAssets(): Promise<AssetDetails[]>;
}
export declare function createAssetInspector(options: AssetInspectorOptions): AssetInspector;
export {};
//# sourceMappingURL=inspection.d.ts.map