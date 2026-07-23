import { createMixin } from "./mixin.js";
/**
 * Calls a callback when an element is inserted and aborts it when removed.
 */
export const ref = createMixin((handle) => {
    let controller;
    handle.addEventListener('insert', (event) => {
        controller = new AbortController();
        callback(event.node, controller.signal);
    });
    handle.addEventListener('remove', () => {
        controller?.abort(new DOMException('', 'AbortError'));
        controller = undefined;
    });
    let callback = () => { };
    return (nextCallback) => {
        callback = nextCallback;
        return handle.element;
    };
});
//# sourceMappingURL=ref-mixin.js.map