import { TypedEventTarget } from '@remix-run/interaction';
import { createFrameHandle } from "./component.js";
import { invariant } from "./invariant.js";
import { createScheduler } from "./scheduler.js";
import { diffVNodes, remove as removeVNode } from "./reconcile.js";
import { toVNode } from "./to-vnode.js";
import { ROOT_VNODE } from "./vnode.js";
import { resetStyleState } from "./diff-props.js";
export { createScheduler };
export { diffVNodes, toVNode };
export { resetStyleState };
export function createRangeRoot([start, end], options = {}) {
    let vroot = null;
    let frameStub = options.frame ?? createFrameHandle();
    let container = end.parentNode;
    invariant(container, 'Expected parent node');
    invariant(end.parentNode === container, 'Boundaries must share parent');
    let hydrationCursor = start.nextSibling;
    let eventTarget = new TypedEventTarget();
    let scheduler = options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget);
    // Forward bubbling error events from DOM to root EventTarget
    container.addEventListener('error', (event) => {
        eventTarget.dispatchEvent(new ErrorEvent('error', { error: event.error }));
    });
    return Object.assign(eventTarget, {
        render(element) {
            let vnode = toVNode(element);
            let vParent = { type: ROOT_VNODE, _svg: false, _rangeStart: start, _rangeEnd: end };
            scheduler.enqueueTasks([
                () => {
                    diffVNodes(vroot, vnode, container, frameStub, scheduler, vParent, eventTarget, end, hydrationCursor);
                    vroot = vnode;
                    hydrationCursor = null;
                },
            ]);
            scheduler.dequeue();
        },
        remove() {
            if (!vroot)
                return;
            let current = vroot;
            vroot = null;
            scheduler.enqueueTasks([() => removeVNode(current, container, scheduler)]);
            scheduler.dequeue();
        },
        flush() {
            scheduler.dequeue();
        },
    });
}
export function createRoot(container, options = {}) {
    let vroot = null;
    let frameStub = options.frame ?? createFrameHandle();
    let hydrationCursor = container.innerHTML.trim() !== '' ? container.firstChild : undefined;
    let eventTarget = new TypedEventTarget();
    let scheduler = options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget);
    // Forward bubbling error events from DOM to root EventTarget
    container.addEventListener('error', (event) => {
        eventTarget.dispatchEvent(new ErrorEvent('error', { error: event.error }));
    });
    return Object.assign(eventTarget, {
        render(element) {
            let vnode = toVNode(element);
            let vParent = { type: ROOT_VNODE, _svg: false };
            scheduler.enqueueTasks([
                () => {
                    diffVNodes(vroot, vnode, container, frameStub, scheduler, vParent, eventTarget, undefined, hydrationCursor);
                    vroot = vnode;
                    hydrationCursor = undefined;
                },
            ]);
            scheduler.dequeue();
        },
        remove() {
            if (!vroot)
                return;
            let current = vroot;
            vroot = null;
            scheduler.enqueueTasks([() => removeVNode(current, container, scheduler)]);
            scheduler.dequeue();
        },
        flush() {
            scheduler.dequeue();
        },
    });
}
//# sourceMappingURL=vdom.js.map