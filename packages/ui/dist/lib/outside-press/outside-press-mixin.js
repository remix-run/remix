import { createMixin } from '@remix-run/component';
export const onOutsidePress = createMixin((handle) => {
    let currentHandler = () => { };
    handle.addEventListener('insert', (event) => {
        let node = event.node;
        let sawPrimaryPointerDown = false;
        let document = node.ownerDocument;
        function isOutsideEventTarget(event) {
            return !(event.target instanceof Node && node.contains(event.target));
        }
        function handlePointerDown(event) {
            if (event.button !== 0 || event.isPrimary === false) {
                return;
            }
            sawPrimaryPointerDown = true;
            if (!isOutsideEventTarget(event)) {
                return;
            }
            currentHandler(event);
        }
        function handleClick(event) {
            if (event.button !== 0) {
                return;
            }
            let shouldSuppressPointerGestureClick = sawPrimaryPointerDown;
            sawPrimaryPointerDown = false;
            if (!isOutsideEventTarget(event)) {
                return;
            }
            if (shouldSuppressPointerGestureClick) {
                event.stopPropagation();
                return;
            }
            currentHandler(event);
        }
        document.addEventListener('pointerdown', handlePointerDown, {
            capture: true,
            signal: handle.signal,
        });
        document.addEventListener('click', handleClick, {
            capture: true,
            signal: handle.signal,
        });
    });
    return (handler) => {
        currentHandler = handler;
    };
});
//# sourceMappingURL=outside-press-mixin.js.map