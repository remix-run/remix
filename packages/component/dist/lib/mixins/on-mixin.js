import { createMixin } from "../mixin.js";
let onMixin = createMixin((handle) => {
    let currentHandler = () => { };
    let currentType = '';
    let currentCapture = false;
    let reentry = null;
    let stableHandler = (event) => {
        reentry?.abort(new DOMException('', 'EventReentry'));
        reentry = new AbortController();
        void currentHandler(event, reentry.signal);
    };
    handle.addEventListener('insert', (event) => {
        let node = event.node;
        node.addEventListener(currentType, stableHandler, currentCapture);
        handle.addEventListener('remove', () => {
            node.removeEventListener(currentType, stableHandler, currentCapture);
            reentry?.abort(new DOMException('', 'AbortError'));
        });
    });
    return (type, handler, captureBoolean = false) => {
        let previousType = currentType;
        let previousCapture = currentCapture;
        let needsRebind = currentType !== type || currentCapture !== captureBoolean;
        currentType = type;
        currentHandler = handler;
        currentCapture = captureBoolean;
        if (needsRebind) {
            handle.queueTask((node) => {
                node.removeEventListener(previousType, stableHandler, previousCapture);
                node.addEventListener(type, stableHandler, captureBoolean);
            });
        }
        return handle.element;
    };
});
export function on(...args) {
    let [type, handler, captureBoolean] = args;
    // Keep this typed wrapper so JSX host context can infer event/currentTarget
    // from `type`, rather than exposing the raw `string` + `Event` runtime signature.
    return onMixin(type, handler, captureBoolean);
}
//# sourceMappingURL=on-mixin.js.map