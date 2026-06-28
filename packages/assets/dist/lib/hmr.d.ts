/**
 * Payloads emitted by the browser and server HMR runtimes.
 */
export type HmrPayload = {
    type: 'server:update';
} | {
    updates: Array<{
        acceptedPath?: string;
        path: string;
        type: 'js';
    } | {
        path: string;
        type: 'css';
    }>;
    timestamp: number;
    type: 'browser:update';
} | {
    type: 'browser:reload';
};
export declare function createHmrClientSource(options: {
    eventPathname: string;
}): string;
//# sourceMappingURL=hmr.d.ts.map