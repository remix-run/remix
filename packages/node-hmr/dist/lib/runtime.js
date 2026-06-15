var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { fileURLToPath } from 'node:url';
import { sendHmrEventPayload } from "./browser-events.js";
import { emitServerHmrEvent } from "./events.js";
import { hasNodeHmrParentProcess } from "./process-state.js";
class NodeHotContext {
    data;
    url;
    #acceptCallbacks = [];
    #acceptDependencyCallbacks = [];
    #disposeCallbacks = [];
    #resolveDependency;
    constructor(url, data, resolveDependency) {
        this.data = data;
        this.url = url;
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
        if (acceptedUrl !== this.url) {
            await this.updateDependency(timestamp, acceptedUrl);
            return;
        }
        if (this.#acceptCallbacks.length === 0) {
            requestRestart(`No HMR accept handler found for ${this.url}`);
            return;
        }
        await this.disposeAll();
        let updatedModule = await import(__rewriteRelativeImportExtension(`${this.url}?t=${timestamp}`));
        for (let callback of this.#acceptCallbacks) {
            await callback(updatedModule);
        }
    }
    async updateDependency(timestamp, acceptedUrl) {
        let callbacks = this.#acceptDependencyCallbacks.filter((callback) => callback.deps.includes(acceptedUrl));
        if (callbacks.length === 0) {
            requestRestart(`No HMR accept handler found for ${acceptedUrl} via ${this.url}`);
            return;
        }
        let updatedModule = await import(__rewriteRelativeImportExtension(`${acceptedUrl}?t=${timestamp}`));
        for (let { callback } of callbacks) {
            await callback(updatedModule, acceptedUrl);
        }
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
export function installNodeHmrRuntime(options = {}) {
    let runtimeGlobal = globalThis;
    if (runtimeGlobal.__remixNodeHmr)
        return runtimeGlobal.__remixNodeHmr;
    let dataByUrl = new Map();
    let contextsByUrl = new Map();
    let runtime = {
        browserEventChannel: options.browserEventUrl === undefined
            ? undefined
            : {
                send: sendHmrEventPayload,
                url: options.browserEventUrl,
            },
        createHotContext(url, resolveDependency = (specifier) => new URL(specifier, url).href) {
            let data = dataByUrl.get(url);
            if (data === undefined) {
                data = {};
                dataByUrl.set(url, data);
            }
            let context = new NodeHotContext(url, data, resolveDependency);
            contextsByUrl.set(url, context);
            return context;
        },
        reportAcceptedDependencies(url, acceptedDeps) {
            if (!hasNodeHmrParentProcess())
                return;
            process.send?.({
                type: 'module-accepted-deps-resolved',
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
                await context.update(timestamp, acceptedUrl);
                emitServerHmrEvent({
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
            type: 'hmr:restart',
            message,
        });
        return;
    }
    process.kill(process.pid, 'SIGTERM');
}
function formatUnknownError(error) {
    return error instanceof Error ? error.message : String(error);
}
