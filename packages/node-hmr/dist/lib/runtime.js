var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { fileURLToPath } from 'node:url';
import { sendHmrEventPayload, } from "./browser-events.js";
import { emitServerHmrEvent, emitServerHmrUpdate } from "./events.js";
import { hasNodeHmrParentProcess } from "./process-state.js";
const browserHmrChannelRequestTimeoutMs = 5_000;
class NodeHotContext {
    data;
    url;
    #acceptCallbacks = [];
    #acceptDependencyCallbacks = [];
    #disposeCallbacks = [];
    #invalidated = false;
    #invalidationMessage;
    #isUpdating = false;
    #disposeDependency;
    #resolveDependency;
    constructor(url, data, disposeDependency, resolveDependency) {
        this.data = data;
        this.url = url;
        this.#disposeDependency = disposeDependency;
        this.#resolveDependency = resolveDependency;
    }
    accept(deps, callback = () => { }) {
        if (typeof deps === 'string') {
            let normalizedDeps = [this.#normalizeAcceptedDependency(deps)];
            let dependencyCallback = callback;
            this.#acceptDependencyCallbacks.push({
                callback(module) {
                    return dependencyCallback(module);
                },
                deps: normalizedDeps,
            });
            return;
        }
        if (isDependencyArray(deps)) {
            let normalizedDeps = deps.map((dep) => this.#normalizeAcceptedDependency(dep));
            let dependencyCallback = callback;
            this.#acceptDependencyCallbacks.push({
                callback(module, acceptedUrl) {
                    return dependencyCallback(normalizedDeps.map((dep) => (dep === acceptedUrl ? module : undefined)));
                },
                deps: normalizedDeps,
            });
            return;
        }
        this.#acceptCallbacks.push(deps ?? (() => { }));
    }
    dispose(callback) {
        this.#disposeCallbacks.push(callback);
    }
    invalidate(message) {
        this.#invalidated = true;
        this.#invalidationMessage = message;
        if (this.#isUpdating) {
            if (message !== undefined)
                console.warn(message);
            return;
        }
        requestRestart(message);
    }
    on(_event, _callback) {
        void _event;
        void _callback;
    }
    async disposeAll() {
        for (let callback of this.#disposeCallbacks) {
            await callback(this.data);
        }
    }
    async update(timestamp, acceptedUrl) {
        this.#invalidated = false;
        this.#invalidationMessage = undefined;
        if (acceptedUrl !== this.url) {
            return await this.updateDependency(timestamp, acceptedUrl);
        }
        if (this.#acceptCallbacks.length === 0) {
            requestRestart(`No HMR accept handler found for ${this.url}`);
            return 'restart-requested';
        }
        await this.disposeAll();
        this.#isUpdating = true;
        try {
            let updatedModule = await import(__rewriteRelativeImportExtension(`${this.url}?t=${timestamp}`));
            for (let callback of this.#acceptCallbacks) {
                await callback(updatedModule);
            }
        }
        finally {
            this.#isUpdating = false;
        }
        return this.#invalidated ? 'invalidated' : 'accepted';
    }
    get invalidationMessage() {
        return this.#invalidationMessage;
    }
    async updateDependency(timestamp, acceptedUrl) {
        let callbacks = this.#acceptDependencyCallbacks.filter((callback) => callback.deps.includes(acceptedUrl));
        if (callbacks.length === 0) {
            requestRestart(`No HMR accept handler found for ${acceptedUrl} via ${this.url}`);
            return 'restart-requested';
        }
        this.#isUpdating = true;
        try {
            await this.#disposeDependency(acceptedUrl);
            let updatedModule = await import(__rewriteRelativeImportExtension(`${acceptedUrl}?t=${timestamp}`));
            for (let { callback } of callbacks) {
                await callback(updatedModule, acceptedUrl);
            }
        }
        finally {
            this.#isUpdating = false;
        }
        return this.#invalidated ? 'invalidated' : 'accepted';
    }
    #normalizeAcceptedDependency(dep) {
        let resolved = this.#resolveDependency(dep);
        let url = new URL(resolved);
        url.search = '';
        url.hash = '';
        return url.href;
    }
}
function isDependencyArray(deps) {
    return Array.isArray(deps);
}
export function getNodeHmrRuntime() {
    let runtimeGlobal = globalThis;
    return runtimeGlobal.__remixNodeHmr;
}
/**
 * Notifies the parent process that the child server is ready.
 */
export function emitServerReady() {
    getNodeHmrRuntime()?.emitServerReady();
}
export function installNodeHmrRuntime(options = {}) {
    let runtimeGlobal = globalThis;
    if (runtimeGlobal.__remixNodeHmr)
        return runtimeGlobal.__remixNodeHmr;
    let dataByUrl = new Map();
    let contextsByUrl = new Map();
    let browserEventUrl = options.browserEventUrl;
    let browserHmrChannelId = 0;
    let browserHmrChannelRequestId = 0;
    let pendingBrowserHmrChannelRequests = new Map();
    let browserHmrChannels = new Map();
    process.on('message', (message) => {
        if (!isBrowserHmrChannelMessage(message))
            return;
        let request = pendingBrowserHmrChannelRequests.get(message.requestId);
        if (request === undefined)
            return;
        clearTimeout(request.timer);
        pendingBrowserHmrChannelRequests.delete(message.requestId);
        request.resolve(message.url);
    });
    let runtime = {
        async createBrowserHmrChannel() {
            browserEventUrl ??= await requestBrowserHmrChannelUrl();
            if (browserEventUrl === undefined) {
                throw new Error('Browser HMR is disabled for this node-hmr runtime');
            }
            let id = browserHmrChannelId++;
            let watchedFiles = new Set();
            let handlers = new Set();
            let closed = false;
            browserHmrChannels.set(id, {
                async handleFileEvents(events) {
                    let eventGroups = await Promise.all([...handlers].map((handler) => handler(events)));
                    return eventGroups.flat();
                },
            });
            function updateWatchedFiles(delta) {
                if (closed)
                    return;
                for (let file of delta.add) {
                    watchedFiles.add(file);
                }
                for (let file of delta.remove) {
                    watchedFiles.delete(file);
                }
                process.send?.({
                    id,
                    delta,
                    type: 'node-hmr:child:browser-hmr-watch-files-changed',
                });
            }
            return {
                close() {
                    if (closed)
                        return;
                    closed = true;
                    browserHmrChannels.delete(id);
                    handlers.clear();
                    let remove = [...watchedFiles];
                    watchedFiles.clear();
                    process.send?.({
                        id,
                        delta: { add: [], remove },
                        type: 'node-hmr:child:browser-hmr-watch-files-changed',
                    });
                },
                onFileEvents(handler) {
                    if (closed)
                        return () => { };
                    handlers.add(handler);
                    return () => {
                        handlers.delete(handler);
                    };
                },
                updateWatchedFiles,
                url: browserEventUrl,
            };
        },
        createHotContext(url, resolveDependency = (specifier) => new URL(specifier, url).href) {
            let data = dataByUrl.get(url);
            if (data === undefined) {
                data = {};
                dataByUrl.set(url, data);
            }
            let context = new NodeHotContext(url, data, async (dependencyUrl) => {
                await contextsByUrl.get(dependencyUrl)?.disposeAll();
            }, resolveDependency);
            contextsByUrl.set(url, context);
            return context;
        },
        emitServerReady() {
            if (!hasNodeHmrParentProcess())
                return;
            process.send?.({
                type: 'node-hmr:child:server-ready',
            });
        },
        handleBrowserHmrFileEvents(requestId, events) {
            if (!hasNodeHmrParentProcess())
                return;
            Promise.all([...browserHmrChannels.values()].map((browserHmrChannel) => browserHmrChannel.handleFileEvents(events)))
                .then((eventGroups) => {
                process.send?.({
                    events: eventGroups.flat(),
                    requestId,
                    type: 'node-hmr:child:browser-hmr-file-events-handled',
                });
            })
                .catch((error) => {
                process.send?.({
                    error: formatUnknownError(error),
                    events: [],
                    requestId,
                    type: 'node-hmr:child:browser-hmr-file-events-handled',
                });
            });
        },
        reportAcceptedDependencies(url, acceptedDeps) {
            if (!hasNodeHmrParentProcess())
                return;
            process.send?.({
                type: 'node-hmr:child:accepted-deps-resolved',
                url,
                acceptedDeps,
            });
        },
        async disposeAll() {
            for (let context of contextsByUrl.values()) {
                await context.disposeAll();
            }
            contextsByUrl.clear();
        },
        async update(url, timestamp, acceptedUrl = url) {
            let context = contextsByUrl.get(url);
            if (context === undefined) {
                requestRestart(`No HMR context found for ${url}`);
                return;
            }
            try {
                let updateResult = await context.update(timestamp, acceptedUrl);
                if (updateResult === 'invalidated') {
                    process.send?.({
                        acceptedUrl,
                        message: context.invalidationMessage,
                        timestamp,
                        type: 'node-hmr:child:hot-module-invalidated',
                        url,
                    });
                    return;
                }
                if (updateResult === 'restart-requested')
                    return;
                emitServerHmrUpdate({
                    ...(acceptedUrl === url ? {} : { acceptedUrl }),
                    filePath: acceptedUrl.startsWith('file:') ? fileURLToPath(acceptedUrl) : acceptedUrl,
                    timestamp,
                    type: 'update',
                    url,
                });
            }
            catch (error) {
                requestRestart(`Failed to hot update ${url}: ${formatUnknownError(error)}`);
            }
        },
    };
    runtimeGlobal.__remixNodeHmr = runtime;
    return runtime;
    function requestBrowserHmrChannelUrl() {
        if (!hasNodeHmrParentProcess())
            return Promise.resolve(undefined);
        let requestId = browserHmrChannelRequestId++;
        return new Promise((resolvePromise) => {
            let timer = setTimeout(() => {
                pendingBrowserHmrChannelRequests.delete(requestId);
                resolvePromise(undefined);
            }, browserHmrChannelRequestTimeoutMs);
            pendingBrowserHmrChannelRequests.set(requestId, {
                resolve: resolvePromise,
                timer,
            });
            if (!process.send?.({
                requestId,
                type: 'node-hmr:child:browser-hmr-channel-requested',
            })) {
                clearTimeout(timer);
                pendingBrowserHmrChannelRequests.delete(requestId);
                resolvePromise(undefined);
            }
        });
    }
}
function isBrowserHmrChannelMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'node-hmr:parent:browser-hmr-channel' &&
        'requestId' in message &&
        typeof message.requestId === 'number' &&
        (!('url' in message) || typeof message.url === 'string'));
}
function requestRestart(message) {
    if (message !== undefined) {
        console.warn(message);
    }
    emitServerHmrEvent({
        reason: message,
        timestamp: Date.now(),
        type: 'restart',
    });
    if (process.send) {
        process.send({
            type: 'node-hmr:child:restart-requested',
            message,
        });
        return;
    }
    process.kill(process.pid, 'SIGTERM');
}
function formatUnknownError(error) {
    return error instanceof Error ? error.message : String(error);
}
