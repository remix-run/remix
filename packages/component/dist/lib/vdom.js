import { TypedEventTarget } from '@remix-run/interaction';
import { createFrameHandle } from "./component.js";
import { invariant } from "./invariant.js";
import { createScheduler } from "./scheduler.js";
import { diffVNodes, remove as removeVNode } from "./reconcile.js";
import { toVNode } from "./to-vnode.js";
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
    invariant(end.parentNode === container, 'Boundaries must share parent');
    let hydrationCursor = start.nextSibling;
    let eventTarget = new TypedEventTarget();
    let scheduler = options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget, styles);
    let frameStub = options.frame ??
        createRootFrameHandle({
            src: options.frameInit?.src,
            resolveFrame: options.frameInit?.resolveFrame,
            loadModule: options.frameInit?.loadModule,
            scheduler,
            styleManager: styles,
        });
    // Forward bubbling error events from DOM to root EventTarget
    container.addEventListener('error', (event) => {
        eventTarget.dispatchEvent(new ErrorEvent('error', { error: event.error }));
    });
    return Object.assign(eventTarget, {
        render(element) {
            let vnode = toVNode(element);
            let vParent = {
                type: ROOT_VNODE,
                _svg: false,
                _rangeStart: start,
                _rangeEnd: end,
                _pendingHydrationComponentId: getHydrationComponentIdFromRangeStart(start),
            };
            scheduler.enqueueTasks([
                () => {
                    diffVNodes(vroot, vnode, container, frameStub, scheduler, styles, vParent, eventTarget, end, hydrationCursor);
                    vroot = vnode;
                    hydrationCursor = null;
                },
            ]);
            scheduler.dequeue();
        },
        dispose() {
            if (!vroot)
                return;
            let current = vroot;
            vroot = null;
            scheduler.enqueueTasks([() => removeVNode(current, container, scheduler, styles)]);
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
            scheduler,
            styleManager: styles,
        });
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
                    diffVNodes(vroot, vnode, container, frameStub, scheduler, styles, vParent, eventTarget, undefined, hydrationCursor);
                    vroot = vnode;
                    hydrationCursor = undefined;
                },
            ]);
            scheduler.dequeue();
        },
        dispose() {
            if (!vroot)
                return;
            let current = vroot;
            vroot = null;
            scheduler.enqueueTasks([() => removeVNode(current, container, scheduler, styles)]);
            scheduler.dequeue();
        },
        flush() {
            scheduler.dequeue();
        },
    });
}
function createRootFrameHandle(init) {
    if (!init.resolveFrame) {
        return createFrameHandle({ src: init.src ?? '/' });
    }
    let frame = createFrameHandle({
        src: init.src ?? '/',
        $runtime: {
            topFrame: undefined,
            loadModule: init.loadModule ??
                (() => {
                    throw new Error('loadModule is required to hydrate client entries inside <Frame />');
                }),
            resolveFrame: init.resolveFrame,
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