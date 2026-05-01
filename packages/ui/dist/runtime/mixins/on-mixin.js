import { createMixin } from "./mixin.js";
const onMixin = createMixin((handle) => {
    let currentHandler = () => { };
    let currentType = '';
    let currentCapture = false;
    let currentNode = null;
    let reentry = null;
    let stableHandler = (event) => {
        reentry?.abort(new DOMException('', 'EventReentry'));
        reentry = new AbortController();
        void currentHandler(event, reentry.signal);
    };
    handle.addEventListener('insert', (event) => {
        currentNode = event.node;
        currentNode.addEventListener(currentType, stableHandler, currentCapture);
    });
    handle.addEventListener('remove', () => {
        currentNode?.removeEventListener(currentType, stableHandler, currentCapture);
        currentNode = null;
        reentry?.abort(new DOMException('', 'AbortError'));
    });
    return (type, handler, captureBoolean = false) => {
        let previousType = currentType;
        let previousCapture = currentCapture;
        let needsRebind = currentType !== type || currentCapture !== captureBoolean;
        currentType = type;
        currentHandler = handler;
        currentCapture = captureBoolean;
        if (needsRebind && currentNode) {
            currentNode.removeEventListener(previousType, stableHandler, previousCapture);
            currentNode.addEventListener(type, stableHandler, captureBoolean);
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