import process from 'node:process';
import { hasNodeHmrParentProcess } from "./process-state.js";
class ServerHmrEvents {
    #listeners = new Set();
    subscribe(listener) {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    }
    emit(event) {
        for (let listener of this.#listeners) {
            listener(event);
        }
    }
}
export const serverHmrEvents = new ServerHmrEvents();
export function emitServerHmrEvent(event) {
    serverHmrEvents.emit(event);
}
export function emitServerHmrUpdate(event) {
    emitServerHmrEvent(event);
    if (!hasNodeHmrParentProcess())
        return;
    process.send?.({
        acceptedUrl: event.acceptedUrl,
        filePath: event.filePath,
        timestamp: event.timestamp,
        type: 'node-hmr:child:hot-module-updated',
        url: event.url,
    });
}
