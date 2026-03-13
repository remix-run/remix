import { createFrame } from "./frame.js";
import { createScheduler } from "./vdom.js";
import { defaultStyleManager } from "./diff-props.js";
import { createComponentErrorEvent } from "./error-event.js";
import { startNavigationListener } from "./navigation.js";
import { TypedEventTarget } from "./typed-event-target.js";
let topFrame;
export function getTopFrame() {
    if (!topFrame)
        throw new Error('app runtime not initialized');
    return topFrame.handle;
}
let namedFrames = new Map();
export function getNamedFrame(name) {
    return namedFrames.get(name) ?? getTopFrame();
}
export function run(init) {
    let styleManager = defaultStyleManager;
    let errorTarget = new TypedEventTarget();
    let scheduler = createScheduler(document, errorTarget, styleManager);
    let resolveFrame = init.resolveFrame ?? (() => '<p>resolve frame unimplemented</p>');
    topFrame = createFrame(document, {
        src: document.location.href,
        errorTarget,
        loadModule: init.loadModule,
        resolveFrame,
        pendingClientEntries: new Map(),
        scheduler,
        styleManager,
        data: {},
        moduleCache: new Map(),
        moduleLoads: new Map(),
        frameInstances: new WeakMap(),
        namedFrames,
    });
    let appController = new AbortController();
    startNavigationListener(appController.signal);
    let readyPromise = topFrame.ready().catch((error) => {
        errorTarget.dispatchEvent(createComponentErrorEvent(error));
        throw error;
    });
    return Object.assign(errorTarget, {
        ready: () => readyPromise,
        flush: () => topFrame.flush(),
        dispose: () => {
            appController.abort();
            topFrame.dispose();
        },
    });
}
//# sourceMappingURL=run.js.map