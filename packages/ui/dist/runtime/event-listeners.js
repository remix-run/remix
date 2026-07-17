/**
 * Adds typed event listeners and reentry abort signals to a target.
 *
 * @param target Event target to attach listeners to.
 * @param signal Lifetime signal used to remove all listeners.
 * @param listeners Listener map keyed by event type.
 */
export function addEventListeners(target, signal, listeners) {
    for (let type in listeners) {
        let listener = listeners[type];
        if (!listener)
            continue;
        let reentry = null;
        signal.addEventListener('abort', () => {
            reentry?.abort();
        });
        target.addEventListener(type, (event) => {
            reentry?.abort();
            let dispatchedEvent = event;
            if (listener.length < 2) {
                reentry = null;
                listener(dispatchedEvent);
            }
            else {
                reentry = new AbortController();
                listener(dispatchedEvent, reentry.signal);
            }
        }, { signal });
    }
}
//# sourceMappingURL=event-listeners.js.map