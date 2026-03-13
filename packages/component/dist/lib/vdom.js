import { createFrameHandle } from "./component.js";
import { invariant } from "./invariant.js";
import { createComponentErrorEvent, getComponentError, } from "./error-event.js";
import { createScheduler } from "./scheduler.js";
import { diffVNodes, remove as removeVNode } from "./reconcile.js";
import { toVNode } from "./to-vnode.js";
import { TypedEventTarget } from "./typed-event-target.js";
import { ROOT_VNODE } from "./vnode.js";
import { resetStyleState, defaultStyleManager } from "./diff-props.js";
export { createScheduler };
export { diffVNodes, toVNode };
export { resetStyleState };
function getHydrationComponentIdFromRangeStart(start) {
    if (!(start instanceof Comment))
        return undefined;
    let marker = start.data.trim();
    if (!marker.startsWith('rmx:h:'))
        return undefined;
    let id = marker.slice('rmx:h:'.length);
    return id.length > 0 ? id : undefined;
}
export function createRangeRoot([start, end], options = {}) {
    let vroot = null;
    let styles = options.styleManager ?? defaultStyleManager;
    let container = end.parentNode;
    invariant(container, 'Expected parent node');
    invariant(start.parentNode === container, 'Boundaries must share parent');
    let parent = container;
    let hydrationCursor = start.nextSibling;
    let eventTarget = new TypedEventTarget();
    let scheduler = options.scheduler ?? createScheduler(parent.ownerDocument ?? document, eventTarget, styles);
    let frameStub = options.frame ??
        createRootFrameHandle({
            src: options.frameInit?.src,
            resolveFrame: options.frameInit?.resolveFrame,
            loadModule: options.frameInit?.loadModule,
            errorTarget: eventTarget,
            scheduler,
            styleManager: styles,
        });
    let isErrorForwardingAttached = false;
    function forwardDomError(event) {
        eventTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
    }
    function attachDomErrorForwarding() {
        if (isErrorForwardingAttached)
            return;
        parent.addEventListener('error', forwardDomError);
        isErrorForwardingAttached = true;
    }
    function detachDomErrorForwarding() {
        if (!isErrorForwardingAttached)
            return;
        parent.removeEventListener('error', forwardDomError);
        isErrorForwardingAttached = false;
    }
    attachDomErrorForwarding();
    return Object.assign(eventTarget, {
        render(element) {
            attachDomErrorForwarding();
            let vnode = toVNode(element);
            let vParent = {
                type: ROOT_VNODE,
                _svg: false,
                _rangeStart: start,
                _rangeEnd: end,
                _pendingHydrationComponentId: getHydrationComponentIdFromRangeStart(start),
            };
            scheduler.enqueueWork([
                () => {
                    diffVNodes(vroot, vnode, parent, frameStub, scheduler, styles, vParent, eventTarget, end, hydrationCursor);
                    vroot = vnode;
                    hydrationCursor = null;
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
            scheduler.enqueueWork([() => removeVNode(current, parent, scheduler, styles)]);
            scheduler.dequeue();
        },
        flush() {
            scheduler.dequeue();
        },
    });
}
export function createRoot(container, options = {}) {
    let vroot = null;
    let styles = options.styleManager ?? defaultStyleManager;
    let hydrationCursor = container.innerHTML.trim() !== '' ? container.firstChild : undefined;
    let eventTarget = new TypedEventTarget();
    let scheduler = options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget, styles);
    let frameStub = options.frame ??
        createRootFrameHandle({
            src: options.frameInit?.src,
            resolveFrame: options.frameInit?.resolveFrame,
            loadModule: options.frameInit?.loadModule,
            errorTarget: eventTarget,
            scheduler,
            styleManager: styles,
        });
    let isErrorForwardingAttached = false;
    function forwardDomError(event) {
        eventTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
    }
    function attachDomErrorForwarding() {
        if (isErrorForwardingAttached)
            return;
        container.addEventListener('error', forwardDomError);
        isErrorForwardingAttached = true;
    }
    function detachDomErrorForwarding() {
        if (!isErrorForwardingAttached)
            return;
        container.removeEventListener('error', forwardDomError);
        isErrorForwardingAttached = false;
    }
    attachDomErrorForwarding();
    return Object.assign(eventTarget, {
        render(element) {
            attachDomErrorForwarding();
            let vnode = toVNode(element);
            let vParent = { type: ROOT_VNODE, _svg: false };
            scheduler.enqueueWork([
                () => {
                    diffVNodes(vroot, vnode, container, frameStub, scheduler, styles, vParent, eventTarget, undefined, hydrationCursor);
                    vroot = vnode;
                    hydrationCursor = undefined;
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
            scheduler.enqueueWork([() => removeVNode(current, container, scheduler, styles)]);
            scheduler.dequeue();
        },
        flush() {
            scheduler.dequeue();
        },
    });
}
function createRootFrameHandle(init) {
    let resolveFrame = init.resolveFrame ??
        (() => {
            throw new Error('Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.');
        });
    let frame = createFrameHandle({
        src: init.src ?? '/',
        $runtime: {
            canResolveFrames: !!init.resolveFrame,
            topFrame: undefined,
            loadModule: init.loadModule ??
                (() => {
                    throw new Error('loadModule is required to hydrate client entries inside <Frame />');
                }),
            resolveFrame,
            errorTarget: init.errorTarget,
            pendingClientEntries: new Map(),
            scheduler: init.scheduler,
            styleManager: init.styleManager,
            data: {},
            moduleCache: new Map(),
            moduleLoads: new Map(),
            frameInstances: new WeakMap(),
            namedFrames: new Map(),
        },
    });
    let runtime = frame.$runtime;
    if (runtime)
        runtime.topFrame = frame;
    return frame;
}
//# sourceMappingURL=vdom.js.map