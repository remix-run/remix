import { type StyleRouteDefinition } from './routes.ts';
interface StyleServerWatchOptions {
    ignore?: readonly string[];
    poll?: boolean;
    pollInterval?: number;
}
interface StyleServerFingerprintOptions {
    buildId: string;
}
export interface StyleServerOptions {
    routes: ReadonlyArray<StyleRouteDefinition>;
    root?: string;
    allow?: readonly string[];
    deny?: readonly string[];
    browserslist?: string;
    sourceMaps?: 'inline' | 'external';
    fingerprint?: StyleServerFingerprintOptions;
    minify?: boolean;
    watch?: boolean | StyleServerWatchOptions;
    onError?: (error: unknown) => void | Response | Promise<void | Response>;
}
export interface StyleServer {
    fetch(request: Request): Promise<Response | null>;
    getHref(filePath: string): Promise<string>;
    getPreloads(filePath: string | readonly string[]): Promise<string[]>;
    close(): Promise<void>;
}
export declare function getInternalStyleServerWatchedDirectories(styleServer: StyleServer): string[];
export declare function waitForInternalStyleServerWatcher(styleServer: StyleServer): Promise<void>;
export declare function createStyleServer(options: StyleServerOptions): StyleServer;
export {};
//# sourceMappingURL=style-server.d.ts.map