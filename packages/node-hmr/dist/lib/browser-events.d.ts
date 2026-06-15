export declare const defaultBrowserEventChannelPathname = "/hmr";
export interface HmrEventPayload {
    type: string;
    [key: string]: unknown;
}
export interface BrowserEventChannel {
    url: string;
    send(payload: HmrEventPayload): void;
}
export declare function sendHmrEventPayload(payload: HmrEventPayload): void;
//# sourceMappingURL=browser-events.d.ts.map