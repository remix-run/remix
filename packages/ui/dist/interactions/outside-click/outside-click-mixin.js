import { createMixin } from '@remix-run/ui';
const onOutsideClick = createMixin((handle) => {
    let active = false;
    let handler = () => { };
    let isInsideTarget = () => false;
    let stopPropagation = true;
    handle.addEventListener('insert', (event) => {
        let node = event.node;
        let doc = node.ownerDocument;
        doc.addEventListener('click', (event) => {
            let target = event.target instanceof Node ? event.target : null;
            if (!active || (target && (node.contains(target) || isInsideTarget(target)))) {
                return;
            }
            if (stopPropagation) {
                event.stopPropagation();
            }
            handler(target);
        }, { capture: true, signal: handle.signal });
    });
    return (nextActive, nextHandler, nextIsInsideTarget = () => false, nextStopPropagation = true) => {
        active = nextActive;
        handler = nextHandler;
        isInsideTarget = nextIsInsideTarget;
        stopPropagation = nextStopPropagation;
    };
});
export { onOutsideClick };
//# sourceMappingURL=outside-click-mixin.js.map