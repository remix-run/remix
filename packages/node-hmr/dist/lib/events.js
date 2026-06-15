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
    if (!hasNodeHmrParentProcess())
        return;
    process.send?.({
        event,
        type: 'server-hmr:event',
    });
}
