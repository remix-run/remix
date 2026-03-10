import { createMixin } from "../mixin.js";
export let ref = createMixin((handle) => {
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