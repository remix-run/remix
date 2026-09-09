import { createFrame } from './frame.js';
import { createScheduler } from './vdom.js';
import { createStyleManager } from '../style/index.js';
import { createComponentErrorEvent } from './error-event.js';
import { startNavigationListener } from './navigation.js';
import { TypedEventTarget } from './typed-event-target.js';
let topFrame;
/**
 * Returns the top-level frame handle for the running application.
 *
 * @returns The top-level frame handle.
 */
export function getTopFrame() {
    if (!topFrame)
        throw new Error('app runtime not initialized');
    return topFrame.handle;
}
const namedFrames = new Map();
/**
 * Returns a named frame handle, falling back to the top frame when not found.
 *
 * @param name Name of the frame to look up.
 * @returns The matching frame handle or the top frame.
 */
export function getNamedFrame(name) {
    return namedFrames.get(name) ?? getTopFrame();
}
// Frame reloads can receive raw FormData without going through form navigation. Encode it here so
// manual reloads use the requested form encoding instead of always sending multipart bodies.
function getRequestBody(options) {
    let formData = options?.formData;
    if (!formData || options?.method?.toLowerCase() === 'get')
        return;
    if (options?.encType === 'text/plain') {
        let body = '';
        for (let [name, value] of formData) {
            name = normalizeLineBreaks(name);
            value = normalizeLineBreaks(typeof value === 'string' ? value : value.name);
            body += `${name}=${value}\r\n`;
        }
        return new Blob([body], { type: 'text/plain' });
    }
    if (options?.encType !== 'application/x-www-form-urlencoded')
        return formData;
    let body = new URLSearchParams();
    for (let [name, value] of formData) {
        body.append(name, typeof value === 'string' ? value : value.name);
    }
    return body;
}
function normalizeLineBreaks(value) {
    return value.replace(/\r\n|\r|\n/g, '\r\n');
}
async function defaultResolveFrame(src, options) {
    let response = await fetch(src, {
        body: getRequestBody(options),
        headers: { Accept: 'text/html' },
        method: options?.method,
        signal: options?.signal,
    });
    if (!response.ok) {
        throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd());
    }
    return response;
}
/**
 * Starts the client-side Remix component runtime for the current document.
 *
 * @param init Runtime options for loading modules and customizing frame resolution.
 * @returns The running application runtime.
 */
export function run(init) {
    let styleManager = createStyleManager();
    let errorTarget = new TypedEventTarget();
    let scheduler = createScheduler(document, errorTarget, styleManager);
    let resolveFrame = init.resolveFrame ?? defaultResolveFrame;
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
    let frames = {
        top: topFrame.handle,
        get(name) {
            return namedFrames.get(name);
        },
    };
    startNavigationListener(appController.signal);
    let readyPromise = topFrame.ready().catch((error) => {
        errorTarget.dispatchEvent(createComponentErrorEvent(error));
        throw error;
    });
    return Object.assign(errorTarget, {
        frames,
        ready: () => readyPromise,
        flush: () => topFrame.flush(),
        dispose: () => {
            appController.abort();
            topFrame.dispose();
            styleManager.dispose();
        },
    });
}
//# sourceMappingURL=run.js.map