import { createFrameHandle } from "./component.js";
import { defaultStyleManager, resetStyleState } from "./diff-props.js";
import { invariant } from "./invariant.js";
import { ROOT_VNODE } from "./vnode.js";
import { createVirtualRoot } from "./virtual-root.js";
export { createScheduler } from "./scheduler.js";
export { diffVNodes } from "./reconcile.js";
export { toVNode } from "./to-vnode.js";
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
    let styleManager = options.styleManager ?? defaultStyleManager;
    let container = end.parentNode;
    invariant(container, 'Expected parent node');
    invariant(start.parentNode === container, 'Boundaries must share parent');
    let parent = container;
    return createVirtualRoot({
        container: parent,
        frame: options.frame,
        scheduler: options.scheduler,
        styleManager,
        anchor: end,
        hydrationCursor: start.nextSibling,
        nextHydrationCursor: null,
        createFrame(scheduler, frameStyleManager) {
            return createRootFrameHandle({
                src: options.frameInit?.src,
                resolveFrame: options.frameInit?.resolveFrame,
                loadModule: options.frameInit?.loadModule,
                scheduler,
                styleManager: frameStyleManager,
            });
        },
        createParentVNode() {
            return {
                type: ROOT_VNODE,
                _svg: false,
                _rangeStart: start,
                _rangeEnd: end,
                _pendingHydrationComponentId: getHydrationComponentIdFromRangeStart(start),
            };
        },
    });
}
export function createRoot(container, options = {}) {
    let styleManager = options.styleManager ?? defaultStyleManager;
    return createVirtualRoot({
        container,
        frame: options.frame,
        scheduler: options.scheduler,
        styleManager,
        hydrationCursor: container.innerHTML.trim() !== '' ? container.firstChild : undefined,
        createFrame(scheduler, frameStyleManager) {
            return createRootFrameHandle({
                src: options.frameInit?.src,
                resolveFrame: options.frameInit?.resolveFrame,
                loadModule: options.frameInit?.loadModule,
                scheduler,
                styleManager: frameStyleManager,
            });
        },
        createParentVNode() {
            return { type: ROOT_VNODE, _svg: false };
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