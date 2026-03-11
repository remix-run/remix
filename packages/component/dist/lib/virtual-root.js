import { defaultStyleManager } from "./diff-props.js";
import { diffVNodes, remove as removeVNode } from "./reconcile.js";
import { createScheduler } from "./scheduler.js";
import { toVNode } from "./to-vnode.js";
import { TypedEventTarget } from "./typed-event-target.js";
export function createVirtualRoot(init) {
    let vroot = null;
    let styles = init.styleManager ?? defaultStyleManager;
    let hydrationCursor = init.hydrationCursor;
    let eventTarget = new TypedEventTarget();
    let scheduler = init.scheduler ??
        createScheduler(init.container.ownerDocument ?? document, eventTarget, styles);
    let frame = init.frame ?? init.createFrame?.(scheduler, styles);
    if (!frame) {
        throw new Error('Expected frame handle');
    }
    let isErrorForwardingAttached = false;
    function forwardDomError(event) {
        eventTarget.dispatchEvent(new ErrorEvent('error', { error: event.error }));
    }
    function attachDomErrorForwarding() {
        if (isErrorForwardingAttached)
            return;
        init.container.addEventListener('error', forwardDomError);
        isErrorForwardingAttached = true;
    }
    function detachDomErrorForwarding() {
        if (!isErrorForwardingAttached)
            return;
        init.container.removeEventListener('error', forwardDomError);
        isErrorForwardingAttached = false;
    }
    attachDomErrorForwarding();
    return Object.assign(eventTarget, {
        render(element) {
            attachDomErrorForwarding();
            let vnode = toVNode(element);
            let vParent = init.createParentVNode();
            scheduler.enqueueTasks([
                () => {
                    diffVNodes(vroot, vnode, init.container, frame, scheduler, styles, vParent, eventTarget, init.anchor, hydrationCursor);
                    vroot = vnode;
                    hydrationCursor = init.nextHydrationCursor;
                },
            ]);
            scheduler.dequeue();
        },
        dispose() {
            detachDomErrorForwarding();
            if (!vroot)
                return;
            let current = vroot;
            vroot = null;
            scheduler.enqueueTasks([() => removeVNode(current, init.container, scheduler, styles)]);
            scheduler.dequeue();
        },
        flush() {
            scheduler.dequeue();
        },
    });
}
//# sourceMappingURL=virtual-root.js.map