import { createFrameHandle } from './component.js';
import { invariant } from './invariant.js';
import { createFrameRuntime } from './frame.js';
import { createComponentErrorEvent, getComponentError, } from './error-event.js';
import { createScheduler } from './scheduler.js';
import { diffVNodes, remove as removeVNode } from './reconcile.js';
import { toVNode } from './to-vnode.js';
import { TypedEventTarget } from './typed-event-target.js';
import { ROOT_VNODE } from './vnode.js';
import { resetStyleState, defaultStyleManager } from './diff-props.js';
import { registerRoot, unregisterRoot } from './refresh.js';
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
/**
 * Creates a virtual root bounded by two DOM nodes.
 *
 * @param boundaries Start and end marker nodes that define the render region.
 * @param options Root configuration.
 * @returns A virtual root controller.
 */
export function createRangeRoot(boundaries, options = {}) {
    let [start, end] = boundaries;
    let vroot = null;
    let currentElement;
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
    let context = {
        frame: frameStub,
        scheduler,
        styles,
        rootTarget: eventTarget,
    };
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
    let root = Object.assign(eventTarget, {
        render(element) {
            attachDomErrorForwarding();
            currentElement = element;
            let vnode = toVNode(element);
            let vParent = {
                kind: 'root',
                type: ROOT_VNODE,
                _children: [],
                _svg: false,
                _rangeStart: start,
                _rangeEnd: end,
                _pendingHydrationComponentId: getHydrationComponentIdFromRangeStart(start),
            };
            scheduler.enqueueWork([
                () => {
                    let cursor = hydrationCursor === null ? undefined : { current: hydrationCursor };
                    let committed = diffVNodes(vroot, vnode, parent, vParent, context, end, cursor);
                    vParent._children = [committed];
                    vroot = committed;
                    hydrationCursor = null;
                },
            ]);
            scheduler.dequeue();
        },
        reconcile() {
            if (currentElement === undefined)
                return;
            root.render(currentElement);
        },
        dispose() {
            detachDomErrorForwarding();
            unregisterRoot(root);
            currentElement = undefined;
            if (!vroot)
                return;
            let current = vroot;
            vroot = null;
            scheduler.enqueueWork([() => removeVNode(current, parent, context)]);
            scheduler.dequeue();
        },
        flush() {
            scheduler.dequeue();
        },
    });
    registerRoot(root);
    return root;
}
/**
 * Creates a virtual root for a host container element.
 *
 * @param container Host element to render into.
 * @param options Root configuration.
 * @returns A virtual root controller.
 */
export function createRoot(container, options = {}) {
    let vroot = null;
    let currentElement;
    let styles = options.styleManager ?? defaultStyleManager;
    if (container.innerHTML.trim() !== '') {
        // Adopt additively: multiple roots hydrating separate islands may share
        // the default style manager, and adopting a later island must not release
        // the server styles an earlier island still depends on.
        styles.adoptServerStyles(container);
    }
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
    let context = {
        frame: frameStub,
        scheduler,
        styles,
        rootTarget: eventTarget,
    };
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
    let root = Object.assign(eventTarget, {
        render(element) {
            attachDomErrorForwarding();
            currentElement = element;
            let vnode = toVNode(element);
            let vParent = {
                kind: 'root',
                type: ROOT_VNODE,
                _children: [],
                _svg: false,
            };
            scheduler.enqueueWork([
                () => {
                    let cursor = hydrationCursor === undefined ? undefined : { current: hydrationCursor };
                    let committed = diffVNodes(vroot, vnode, container, vParent, context, undefined, cursor);
                    vParent._children = [committed];
                    vroot = committed;
                    hydrationCursor = undefined;
                },
            ]);
            scheduler.dequeue();
        },
        reconcile() {
            if (currentElement === undefined)
                return;
            root.render(currentElement);
        },
        dispose() {
            detachDomErrorForwarding();
            unregisterRoot(root);
            currentElement = undefined;
            if (!vroot)
                return;
            let current = vroot;
            vroot = null;
            scheduler.enqueueWork([() => removeVNode(current, container, context)]);
            scheduler.dequeue();
        },
        flush() {
            scheduler.dequeue();
        },
    });
    registerRoot(root);
    return root;
}
function createRootFrameHandle(init) {
    let resolveFrame = init.resolveFrame ??
        (() => {
            throw new Error('Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.');
        });
    let runtime = createFrameRuntime({
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
    });
    runtime.canResolveFrames = !!init.resolveFrame;
    let frame = createFrameHandle({ src: init.src ?? '/', $runtime: runtime });
    runtime.topFrame = frame;
    return frame;
}
//# sourceMappingURL=vdom.js.map