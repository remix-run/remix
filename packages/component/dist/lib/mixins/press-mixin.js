import { createMixin } from "../mixin.js";
export let pressEventType = 'rmx:press';
export let pressDownEventType = 'rmx:press-down';
export let pressUpEventType = 'rmx:press-up';
export let longPressEventType = 'rmx:long-press';
export let pressCancelEventType = 'rmx:press-cancel';
export class PressEvent extends Event {
    clientX;
    clientY;
    constructor(type, init = {}) {
        super(type, { bubbles: true, cancelable: true });
        this.clientX = init.clientX ?? 0;
        this.clientY = init.clientY ?? 0;
    }
}
let basePressEvents = createMixin((handle) => {
    let target = null;
    let doc = null;
    let isPointerDown = false;
    let isKeyboardDown = false;
    let longPressTimer = 0;
    let suppressNextUp = false;
    let clearLongTimer = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = 0;
        }
    };
    let startLongTimer = () => {
        if (!target)
            return;
        clearLongTimer();
        longPressTimer = window.setTimeout(() => {
            if (!target)
                return;
            suppressNextUp = !target.dispatchEvent(new PressEvent(longPressEventType));
        }, 500);
    };
    let onPointerDown = (event) => {
        if (!target)
            return;
        if (event.isPrimary === false)
            return;
        if (isPointerDown)
            return;
        isPointerDown = true;
        target.dispatchEvent(new PressEvent(pressDownEventType, {
            clientX: event.clientX,
            clientY: event.clientY,
        }));
        startLongTimer();
    };
    let onPointerUp = (event) => {
        if (!target)
            return;
        if (!isPointerDown)
            return;
        isPointerDown = false;
        clearLongTimer();
        if (suppressNextUp) {
            suppressNextUp = false;
            return;
        }
        target.dispatchEvent(new PressEvent(pressUpEventType, {
            clientX: event.clientX,
            clientY: event.clientY,
        }));
        target.dispatchEvent(new PressEvent(pressEventType, {
            clientX: event.clientX,
            clientY: event.clientY,
        }));
    };
    let onPointerLeave = () => {
        if (!isPointerDown)
            return;
        clearLongTimer();
    };
    let onKeyDown = (event) => {
        if (!target)
            return;
        let key = event.key;
        if (key == 'Escape' && (isKeyboardDown || isPointerDown)) {
            clearLongTimer();
            suppressNextUp = true;
            target.dispatchEvent(new PressEvent(pressCancelEventType));
            return;
        }
        if (!(key === 'Enter' || key === ' '))
            return;
        if (event.repeat)
            return;
        if (isKeyboardDown)
            return;
        isKeyboardDown = true;
        target.dispatchEvent(new PressEvent(pressDownEventType));
        startLongTimer();
    };
    let onKeyUp = (event) => {
        if (!target)
            return;
        let key = event.key;
        if (!(key === 'Enter' || key === ' '))
            return;
        if (!isKeyboardDown)
            return;
        isKeyboardDown = false;
        clearLongTimer();
        if (suppressNextUp) {
            suppressNextUp = false;
            return;
        }
        target.dispatchEvent(new PressEvent(pressUpEventType));
        target.dispatchEvent(new PressEvent(pressEventType));
    };
    let onDocumentPointerUp = () => {
        if (!target)
            return;
        if (!isPointerDown)
            return;
        isPointerDown = false;
        target.dispatchEvent(new PressEvent(pressCancelEventType));
    };
    handle.addEventListener('insert', (event) => {
        target = event.node;
        doc = target.ownerDocument;
        target.addEventListener('pointerdown', onPointerDown);
        target.addEventListener('pointerup', onPointerUp);
        target.addEventListener('pointerleave', onPointerLeave);
        target.addEventListener('keydown', onKeyDown);
        target.addEventListener('keyup', onKeyUp);
        doc.addEventListener('pointerup', onDocumentPointerUp);
    });
    handle.addEventListener('remove', () => {
        clearLongTimer();
        if (target) {
            target.removeEventListener('pointerdown', onPointerDown);
            target.removeEventListener('pointerup', onPointerUp);
            target.removeEventListener('pointerleave', onPointerLeave);
            target.removeEventListener('keydown', onKeyDown);
            target.removeEventListener('keyup', onKeyUp);
        }
        if (doc) {
            doc.removeEventListener('pointerup', onDocumentPointerUp);
        }
        target = null;
        doc = null;
        isPointerDown = false;
        isKeyboardDown = false;
        suppressNextUp = false;
    });
});
export let pressEvents = Object.assign(basePressEvents, {
    press: pressEventType,
    down: pressDownEventType,
    up: pressUpEventType,
    long: longPressEventType,
    cancel: pressCancelEventType,
});
//# sourceMappingURL=press-mixin.js.map