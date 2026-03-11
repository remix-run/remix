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