import { createMixin, on } from '@remix-run/component';
function createPointerClickMixin(pointerEventType) {
    return createMixin((handle) => {
        let suppressNextClickToken = null;
        function clearSuppressedClick() {
            suppressNextClickToken = null;
        }
        function armSuppressedClick() {
            let token = {};
            suppressNextClickToken = token;
            queueMicrotask(() => {
                if (suppressNextClickToken === token) {
                    suppressNextClickToken = null;
                }
            });
        }
        handle.addEventListener('remove', clearSuppressedClick);
        return (handler) => [
            on(pointerEventType, (pointerEvent) => {
                if (pointerEvent.button !== 0 || pointerEvent.isPrimary === false)
                    return;
                armSuppressedClick();
                handler(pointerEvent);
            }),
            on('click', (clickEvent) => {
                if (clickEvent.button !== 0)
                    return;
                if (suppressNextClickToken) {
                    clearSuppressedClick();
                    clickEvent.stopImmediatePropagation();
                    clickEvent.preventDefault();
                    return;
                }
                handler(clickEvent);
            }, true),
        ];
    });
}
export const onPointerDownClick = createPointerClickMixin('pointerdown');
export const onPointerUpClick = createPointerClickMixin('pointerup');
//# sourceMappingURL=pointer-click.js.map