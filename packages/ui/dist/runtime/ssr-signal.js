export const ssrSignal = Object.freeze({
    get aborted() {
        return false;
    },
    get reason() {
        return undefined;
    },
    get onabort() {
        return null;
    },
    set onabort(_) { },
    addEventListener(_type, _listener, _options) { },
    removeEventListener(_type, _listener, _options) { },
    dispatchEvent(_event) {
        return true;
    },
    throwIfAborted() { },
});
export function isSsrSignal(signal) {
    return signal === ssrSignal;
}
//# sourceMappingURL=ssr-signal.js.map