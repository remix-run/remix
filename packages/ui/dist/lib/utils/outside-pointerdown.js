import { createMixin } from '@remix-run/component';
export const onOutsidePointerDown = createMixin((handle) => {
    let currentHandler = () => { };
    let controller = null;
    let currentNode = null;
    let mounted = false;
    let suppressNextClick = false;
    function cleanupListeners() {
        controller?.abort();
        controller = null;
        currentNode = null;
        suppressNextClick = false;
    }
    handle.addEventListener('insert', (event) => {
        cleanupListeners();
        controller = new AbortController();
        currentNode = event.node;
        mounted = true;
        let signal = controller.signal;
        let handlePointerDown = (pointerEvent) => {
            if (!mounted)
                return;
            if (pointerEvent.button !== 0)
                return;
            if (currentNode &&
                pointerEvent.target instanceof Node &&
                currentNode.contains(pointerEvent.target)) {
                return;
            }
            suppressNextClick = true;
            pointerEvent.stopPropagation();
            currentHandler(pointerEvent);
        };
        let handleClick = (clickEvent) => {
            let shouldSuppress = suppressNextClick;
            suppressNextClick = false;
            if (clickEvent.button !== 0)
                return;
            if (currentNode &&
                clickEvent.target instanceof Node &&
                currentNode.contains(clickEvent.target)) {
                return;
            }
            if (!mounted) {
                if (shouldSuppress) {
                    clickEvent.stopPropagation();
                }
                cleanupListeners();
                return;
            }
            clickEvent.stopPropagation();
            if (shouldSuppress) {
                return;
            }
            currentHandler(clickEvent);
        };
        document.addEventListener('pointerdown', handlePointerDown, {
            capture: true,
            signal,
        });
        document.addEventListener('click', handleClick, {
            capture: true,
            signal,
        });
    });
    handle.addEventListener('remove', () => {
        mounted = false;
        if (!suppressNextClick)
            cleanupListeners();
    });
    return (handler) => {
        currentHandler = handler;
        return handle.element;
    };
});
//# sourceMappingURL=outside-pointerdown.js.map