import { createFrame } from "./frame.js";
import { createScheduler } from "./vdom.js";
import { defaultStyleManager } from "./diff-props.js";
export function run(doc, init) {
    let styleManager = defaultStyleManager;
    let errorTarget = new EventTarget();
    let scheduler = createScheduler(doc, errorTarget, styleManager);
    let resolveFrame = init.resolveFrame ?? (() => '<p>resolve frame unimplemented</p>');
    let frame = createFrame(doc, {
        src: doc.location?.href ?? '/',
        loadModule: init.loadModule,
        resolveFrame,
        pendingClientEntries: new Map(),
        scheduler,
        styleManager,
        data: {},
        moduleCache: new Map(),
        moduleLoads: new Map(),
        frameInstances: new WeakMap(),
        namedFrames: new Map(),
    });
    return Object.assign(errorTarget, {
        ready: () => frame.ready(),
        flush: () => frame.flush(),
        dispose: () => frame.dispose(),
    });
}
//# sourceMappingURL=run.js.map