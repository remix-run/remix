export function beginPointerSession(origin, window) {
    let controller = new AbortController();
    let listener;
    let captureTarget;
    let latest = origin;
    let ended;
    function end(event, cancelled) {
        if (ended)
            return;
        ended = { event, cancelled };
        controller.abort();
        listener?.end(event, cancelled);
        listener = undefined;
    }
    window.addEventListener('pointermove', (event) => {
        if (event.pointerId !== origin.pointerId)
            return;
        latest = event;
        listener?.move(event);
    }, { signal: controller.signal, passive: false, capture: true });
    window.addEventListener('pointerup', (event) => {
        if (event.pointerId === origin.pointerId)
            end(event, false);
    }, { signal: controller.signal, capture: true });
    window.addEventListener('pointercancel', (event) => {
        if (event.pointerId === origin.pointerId)
            end(event, true);
    }, { signal: controller.signal, capture: true });
    window.addEventListener('gotpointercapture', (event) => {
        if (event.pointerId !== origin.pointerId || !captureTarget)
            return;
        if (event.target !== captureTarget)
            end(event, true);
    }, { signal: controller.signal, capture: true });
    window.addEventListener('lostpointercapture', (event) => {
        if (event.pointerId !== origin.pointerId || event.target !== captureTarget)
            return;
        if (event.buttons === 0) {
            end(event, false);
            return;
        }
        // Native keyed moves can release capture without ending the pointer stream.
        // Wait for a deliberate transfer's gotpointercapture before considering repair.
        queueMicrotask(() => {
            if (!ended &&
                captureTarget?.isConnected &&
                event.buttons !== 0 &&
                !captureTarget.hasPointerCapture(origin.pointerId))
                captureTarget.setPointerCapture(origin.pointerId);
        });
    }, { signal: controller.signal, capture: true });
    window.addEventListener('blur', (event) => end(event, true), { signal: controller.signal });
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape')
            end(event, true);
    }, { signal: controller.signal, capture: true });
    return {
        capture(node) {
            captureTarget = node;
            if (!ended && node.isConnected && !node.hasPointerCapture(origin.pointerId))
                node.setPointerCapture(origin.pointerId);
        },
        attach(receiver) {
            if (listener)
                throw new Error('Pointer session already has a receiver');
            listener = receiver;
            if (ended) {
                listener = undefined;
                receiver.end(ended.event, ended.cancelled);
            }
            else if (latest !== origin)
                receiver.move(latest);
        },
        dispose() {
            ended ??= { event: undefined, cancelled: true };
            controller.abort();
            listener = undefined;
            if (captureTarget?.hasPointerCapture(origin.pointerId))
                captureTarget.releasePointerCapture(origin.pointerId);
            captureTarget = undefined;
        },
    };
}
//# sourceMappingURL=pointer-session.js.map