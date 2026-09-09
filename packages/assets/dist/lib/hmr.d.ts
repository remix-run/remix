/**
 * Messages consumed by the browser HMR client.
 *
 * Server runtimes use `server:update` to request reconciliation with freshly rendered server
 * output. Asset tooling uses `browser:update` for updates accepted by JavaScript or CSS boundaries,
 * and falls back to `browser:reload` when the page must reload.
 */
export type HmrPayload = {
    /** Indicates that server-rendered output may have changed. */
    type: 'server:update';
} | {
    /** JavaScript and CSS modules that the browser should update. */
    updates: Array<{
        /** Importing module whose dependency-accept handler accepts this update. */
        acceptedPath?: string;
        /** Public URL of the changed JavaScript module. */
        path: string;
        /** Identifies a JavaScript module update. */
        type: 'js';
    } | {
        /** Public URL of the changed stylesheet. */
        path: string;
        /** Identifies a stylesheet update. */
        type: 'css';
    }>;
    /** Update time used to bypass browser module and stylesheet caches. */
    timestamp: number;
    /** Indicates that the listed browser modules should update in place. */
    type: 'browser:update';
} | {
    /** Indicates that no HMR boundary accepted the change and the page must reload. */
    type: 'browser:reload';
};
export declare function createHmrClientSource(options: {
    eventPathname: string;
}): string;
//# sourceMappingURL=hmr.d.ts.map