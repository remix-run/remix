import process from 'node:process';
import { hasNodeHmrParentProcess } from "./process-state.js";
export const defaultBrowserHmrPathname = '/hmr';
export function sendHmrEventPayload(payload) {
    if (!hasNodeHmrParentProcess())
        return;
    process.send?.({
        payload,
        type: 'node-hmr:child:browser-event-emitted',
    });
}
