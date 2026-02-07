var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { TypedEventTarget } from '@remix-run/interaction';
import { jsx } from "./jsx.js";
import { createRangeRoot, createScheduler } from "./vdom.js";
/*
 * Default module loader using dynamic import
 */
async function defaultLoadModule(moduleUrl, exportName) {
    let mod = await import(__rewriteRelativeImportExtension(moduleUrl));
    let component = mod[exportName];
    if (typeof component !== 'function') {
        throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`);
    }
    return component;
}
/*
 * Find hydration start markers in the DOM
 * Returns a map of instance ID -> [startComment, endComment]
 */
function findHydrationMarkers(root) {
    let markers = new Map();
    // Walk all nodes to find comment markers
    let walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    let node;
    while ((node = walker.nextNode())) {
        let data = node.data.trim();
        // Match start markers: "rmx:h:h1", "rmx:h:h1.1", etc.
        let match = data.match(/^rmx:h:(.+)$/);
        if (match) {
            let id = match[1];
            let endMarker = findEndMarker(node);
            if (endMarker) {
                markers.set(id, [node, endMarker]);
            }
        }
    }
    return markers;
}
/*
 * Find the end marker for a hydration region
 * Walks siblings to find <!-- /rmx:h -->
 */
function findEndMarker(startMarker) {
    let node = startMarker.nextSibling;
    // Handle nesting depth - we need to skip over any nested hydration regions
    let depth = 1;
    while (node) {
        if (node.nodeType === Node.COMMENT_NODE) {
            let data = node.data.trim();
            // Check for nested start marker
            if (data.match(/^rmx:h:/)) {
                depth++;
            }
            // Check for end marker
            else if (data === '/rmx:h') {
                depth--;
                if (depth === 0) {
                    return node;
                }
            }
        }
        node = node.nextSibling;
    }
    return null;
}
/*
 * Parse the rmx-data script element
 */
function parseRmxData(doc) {
    let script = doc.getElementById('rmx-data');
    if (!script)
        return null;
    try {
        return JSON.parse(script.textContent || '{}');
    }
    catch {
        console.error('[hydrate] Failed to parse rmx-data script');
        return null;
    }
}
/*
 * Create a RemixElement from a component and props
 */
function createElement(component, props) {
    return jsx(component, props);
}
/*
 * Hydrate a single region
 */
function hydrateRegion(start, end, component, props, scheduler) {
    let element = createElement(component, props);
    let root = createRangeRoot([start, end], { scheduler });
    root.render(element);
}
/**
 * Hydrate all components marked with `hydrationRoot()` in the document.
 *
 * This function:
 * 1. Finds the rmx-data script containing hydration metadata
 * 2. Discovers all hydration markers in the DOM
 * 3. Loads all component modules in parallel
 * 4. Hydrates each region by creating virtual roots
 *
 * The returned root is an EventTarget that receives error events from all
 * hydrated components.
 *
 * @param options Hydration options
 * @returns A HydrationRoot with `ready` promise, `flush()` method, and event handling
 * @example
 * ```ts
 * let root = hydrate()
 *
 * // Listen for errors from any hydrated component
 * root.addEventListener('error', (event) => {
 *   console.error('Hydration error:', event.error)
 * })
 *
 * await root.ready
 * root.flush()
 * ```
 */
export function hydrate(options) {
    let loadModule = options?.loadModule ?? defaultLoadModule;
    // Create event target for error handling
    let eventTarget = new TypedEventTarget();
    // Create a shared scheduler for all hydration roots
    let scheduler = createScheduler(document, eventTarget);
    let ready = (async () => {
        // Parse hydration data
        let data = parseRmxData(document);
        if (!data?.h) {
            return; // Nothing to hydrate
        }
        let hydrationData = data.h;
        // Find all hydration markers
        let markers = findHydrationMarkers(document);
        // Load all modules in parallel
        let loadedModules = new Map();
        let loadPromises = [];
        for (let [id, entry] of Object.entries(hydrationData)) {
            let promise = (async () => {
                try {
                    let component = await loadModule(entry.moduleUrl, entry.exportName);
                    loadedModules.set(id, component);
                }
                catch (error) {
                    console.error(`[hydrate] Failed to load module for ${id}:`, error);
                }
            })();
            loadPromises.push(promise);
        }
        await Promise.all(loadPromises);
        // Hydrate each region synchronously (after all modules are loaded)
        for (let [id, entry] of Object.entries(hydrationData)) {
            let component = loadedModules.get(id);
            if (!component)
                continue;
            let markerPair = markers.get(id);
            if (!markerPair) {
                console.warn(`[hydrate] Could not find markers for hydration root: ${id}`);
                continue;
            }
            let [start, end] = markerPair;
            hydrateRegion(start, end, component, entry.props, scheduler);
        }
    })();
    return Object.assign(eventTarget, {
        ready,
        flush() {
            scheduler.dequeue();
        },
    });
}
//# sourceMappingURL=hydrate-client.js.map