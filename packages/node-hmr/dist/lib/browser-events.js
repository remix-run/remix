import process from 'node:process';
import { hasNodeHmrParentProcess } from "./process-state.js";
export const defaultBrowserEventChannelPathname = '/hmr';
export function sendHmrEventPayload(payload) {
    if (!hasNodeHmrParentProcess())
        return;
    process.send?.({
        payload,
        type: 'hmr-event:send',
    });
}
