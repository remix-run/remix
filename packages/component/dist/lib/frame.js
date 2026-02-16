import { jsx } from "./jsx.js";
import { Frame, createFrameHandle } from "./component.js";
import { invariant } from "./invariant.js";
import { createRangeRoot } from "./vdom.js";
import { diffNodes } from "./diff-dom.js";
let bufferedFrameTemplates = new Map();
let frameTemplateListeners = new Map();
export function createFrame(root, init) {
    let container = createContainer(root);
    let observers = [];
    let subscriptions = [];
    let reloadController;
    // Merge any rmx-data found in the current document once at startup.
    mergeRmxDataFromDocument(init.data, container.doc);
    let runtime = createFrameRuntime(init);
    let frame = createFrameHandle({
        src: init.src,
        $runtime: runtime,
        reload: async () => {
            reloadController?.abort();
            let controller = new AbortController();
            reloadController = controller;
            frame.dispatchEvent(new Event('reloadStart'));
            try {
                let content = await init.resolveFrame(frame.src, controller.signal);
                if (reloadController !== controller || controller.signal.aborted)
                    return controller.signal;
                await render(content, { signal: controller.signal });
                return controller.signal;
            }
            finally {
                if (reloadController === controller) {
                    frame.dispatchEvent(new Event('reloadComplete'));
                }
            }
        },
        replace: async (content) => {
            await render(content);
        },
    });
    runtime.topFrame = runtime.topFrame ?? init.topFrame ?? frame;
    let frameName = init.marker?.name ?? init.name;
    if (frameName) {
        init.namedFrames.set(frameName, frame);
    }
    let context = {
        topFrame: runtime.topFrame,
        loadModule: init.loadModule,
        resolveFrame: init.resolveFrame,
        pendingClientEntries: init.pendingClientEntries,
        scheduler: init.scheduler,
        frame,
        styleManager: init.styleManager,
        data: init.data,
        moduleCache: init.moduleCache,
        moduleLoads: init.moduleLoads,
        frameInstances: init.frameInstances,
        namedFrames: init.namedFrames,
        regionTailRef: container.regionTailRef,
        regionParent: container.regionParent,
    };
    async function render(content, options) {
        if (options?.signal?.aborted)
            return;
        if (content instanceof ReadableStream) {
            await renderFrameStream(content, container.doc, async (html) => {
                if (options?.signal?.aborted)
                    return;
                await render(html, options);
            });
            return;
        }
        if (container.root instanceof Document &&
            typeof content === 'string' &&
            isFullDocumentHtml(content)) {
            // Full-document reload should tear down existing hydrated roots and subframes
            // before diffing fresh HTML, otherwise stale component instances can survive
            // on detached DOM nodes.
            let previousBodyNodes = Array.from(container.doc.body.childNodes);
            removeVirtualRoots(previousBodyNodes);
            disposeSubFrames(previousBodyNodes, context);
            let parsed = new DOMParser().parseFromString(content, 'text/html');
            mergeRmxDataFromDocument(context.data, parsed);
            diffNodes(Array.from(container.doc.head.childNodes), Array.from(parsed.head.childNodes), {
                ...context,
                regionParent: container.doc.head,
                regionTailRef: null,
            });
            diffNodes(Array.from(container.doc.body.childNodes), Array.from(parsed.body.childNodes), {
                ...context,
                regionParent: container.doc.body,
                regionTailRef: null,
            });
            let bodyContainer = createElementContainer(container.doc.body);
            if (options?.signal?.aborted)
                return;
            scheduleHydrationInContainer(bodyContainer, context, options?.initialHydrationTracker);
            createSubFrames(bodyContainer.childNodes, context);
            return;
        }
        let fragment = typeof content === 'string' ? createFragmentFromString(container.doc, content) : content;
        hoistHeadElements(container.doc, fragment);
        mergeRmxDataFromFragment(context.data, fragment);
        let nextContainer = createContainer(fragment);
        if (options?.signal?.aborted)
            return;
        diffNodes(container.childNodes, Array.from(nextContainer.childNodes), {
            ...context,
            regionTailRef: container.regionTailRef,
            regionParent: container.regionParent,
        });
        if (options?.signal?.aborted)
            return;
        scheduleHydrationInContainer(container, context, options?.initialHydrationTracker);
        createSubFrames(container.childNodes, context);
    }
    async function hydrateInitial() {
        let initialHydrationTracker = createInitialHydrationTracker();
        createSubFrames(container.childNodes, context);
        scheduleHydrationInContainer(container, context, initialHydrationTracker);
        if (init.marker?.status === 'pending') {
            let markerId = init.marker.id;
            let early = consumeFrameTemplate(markerId) ?? getEarlyFrameContent(markerId);
            if (early) {
                hoistHeadElements(container.doc, early);
                mergeRmxDataFromFragment(context.data, early);
                await render(early, { initialHydrationTracker });
            }
            else {
                let observer = setupTemplateObserver();
                let unsubscribe = subscribeFrameTemplate(markerId, async (fragment) => {
                    unsubscribe();
                    hoistHeadElements(container.doc, fragment);
                    mergeRmxDataFromFragment(context.data, fragment);
                    await render(fragment);
                    observer.disconnect();
                });
                subscriptions.push(unsubscribe);
                let buffered = consumeFrameTemplate(markerId);
                if (buffered) {
                    unsubscribe();
                    hoistHeadElements(container.doc, buffered);
                    mergeRmxDataFromFragment(context.data, buffered);
                    await render(buffered);
                    observer.disconnect();
                }
                observers.push(observer);
            }
        }
        initialHydrationTracker.finalize();
        await initialHydrationTracker.ready();
    }
    function dispose() {
        reloadController?.abort();
        reloadController = undefined;
        // Disconnect any MutationObservers waiting for templates.
        for (let observer of observers) {
            observer.disconnect();
        }
        observers.length = 0;
        for (let unsubscribe of subscriptions) {
            unsubscribe();
        }
        subscriptions.length = 0;
        // Remove hydrated virtual roots in this frame's region.
        removeVirtualRoots(container.childNodes);
        // Dispose sub-frames recursively.
        disposeSubFrames(container.childNodes, context);
        if (frameName) {
            if (init.namedFrames.get(frameName) === frame) {
                init.namedFrames.delete(frameName);
            }
        }
    }
    let readyPromise = hydrateInitial();
    return {
        render,
        ready: () => readyPromise,
        flush: () => context.scheduler.dequeue(),
        dispose,
        handle: frame,
    };
}
export function createFrameRuntime(init) {
    return {
        topFrame: init.topFrame,
        loadModule: init.loadModule,
        resolveFrame: init.resolveFrame,
        pendingClientEntries: init.pendingClientEntries,
        scheduler: init.scheduler,
        styleManager: init.styleManager,
        data: init.data,
        moduleCache: init.moduleCache,
        moduleLoads: init.moduleLoads,
        frameInstances: init.frameInstances,
        namedFrames: init.namedFrames,
    };
}
function createInitialHydrationTracker() {
    let pending = 0;
    let finalized = false;
    let resolveReady;
    let readyPromise = new Promise((resolve) => {
        resolveReady = resolve;
    });
    function maybeResolve() {
        if (finalized && pending === 0) {
            resolveReady?.();
            resolveReady = undefined;
        }
    }
    return {
        track() {
            pending++;
            let completed = false;
            return () => {
                if (completed)
                    return;
                completed = true;
                pending--;
                maybeResolve();
            };
        },
        finalize() {
            finalized = true;
            maybeResolve();
        },
        ready() {
            return readyPromise;
        },
    };
}
function mergeRmxDataFromDocument(into, doc) {
    let scripts = Array.from(doc.querySelectorAll('script#rmx-data'));
    for (let script of scripts) {
        if (!(script instanceof HTMLScriptElement))
            continue;
        mergeRmxData(into, parseRmxDataScript(script));
        script.remove();
    }
}
function mergeRmxDataFromFragment(into, fragment) {
    let scripts = Array.from(fragment.querySelectorAll('script#rmx-data'));
    for (let script of scripts) {
        if (!(script instanceof HTMLScriptElement))
            continue;
        mergeRmxData(into, parseRmxDataScript(script));
        script.remove();
    }
}
function hoistHeadElements(doc, fragment) {
    let target = doc.head;
    if (!target)
        return;
    let heads = Array.from(fragment.querySelectorAll('head'));
    for (let head of heads) {
        while (head.firstChild) {
            target.appendChild(head.firstChild);
        }
        head.remove();
    }
    // Some fragment parses can normalize <head> content to top-level siblings
    // (e.g. leading <style>), so hoist head-managed elements directly as well.
    let maybeHeadManaged = Array.from(fragment.querySelectorAll('title,meta,link,style,script[type="application/ld+json"]'));
    for (let element of maybeHeadManaged) {
        if (!(element instanceof Element))
            continue;
        if (!isHeadManagedElementNode(element))
            continue;
        target.appendChild(element);
    }
}
function isHeadManagedElementNode(element) {
    let tag = element.tagName.toLowerCase();
    if (tag === 'title' || tag === 'meta' || tag === 'link' || tag === 'style') {
        return true;
    }
    if (tag === 'script') {
        return element.getAttribute('type') === 'application/ld+json';
    }
    return false;
}
function parseRmxDataScript(script) {
    try {
        return JSON.parse(script.textContent || '{}');
    }
    catch {
        console.error('[createFrame] Failed to parse rmx-data script');
        return {};
    }
}
function mergeRmxData(into, from) {
    if (from.h) {
        if (!into.h)
            into.h = {};
        copyOwnRmxEntries(into.h, from.h);
    }
    if (from.f) {
        if (!into.f)
            into.f = {};
        copyOwnRmxEntries(into.f, from.f);
    }
}
function copyOwnRmxEntries(target, source) {
    for (let key of Object.keys(source)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype')
            continue;
        if (!Object.hasOwn(source, key))
            continue;
        target[key] = source[key];
    }
}
function scheduleHydrationInContainer(container, context, initialHydrationTracker) {
    let hydrationMarkers = findHydrationMarkers(container);
    if (hydrationMarkers.length === 0)
        return;
    let hydrationData = context.data.h;
    if (!hydrationData)
        return;
    for (let marker of hydrationMarkers) {
        let entry = hydrationData[marker.id];
        if (!entry)
            continue;
        scheduleHydrationMarker(marker, entry, context, initialHydrationTracker);
    }
}
function scheduleHydrationMarker(marker, entry, context, initialHydrationTracker) {
    let done = initialHydrationTracker?.track();
    let key = `${entry.moduleUrl}#${entry.exportName}`;
    let hydrateWithComponent = (component) => {
        if (!isHydrationMarkerLive(marker, context))
            return;
        let vElement = createElement(component, entry.props);
        context.pendingClientEntries.set(marker.start, [marker.end, vElement]);
        hydrateRegion(vElement, marker.start, marker.end, context);
    };
    let cached = context.moduleCache.get(key);
    if (cached) {
        hydrateWithComponent(cached);
        done?.();
        return;
    }
    getOrStartModuleLoad(key, entry, marker.id, context)
        .then((component) => {
        if (component) {
            hydrateWithComponent(component);
        }
    })
        .finally(() => {
        done?.();
    });
}
function getOrStartModuleLoad(key, entry, markerId, context) {
    let inFlight = context.moduleLoads.get(key);
    if (inFlight)
        return inFlight;
    let loadPromise = (async () => {
        try {
            let mod = await context.loadModule(entry.moduleUrl, entry.exportName);
            if (typeof mod !== 'function') {
                throw new Error(`Export "${entry.exportName}" from "${entry.moduleUrl}" is not a function`);
            }
            context.moduleCache.set(key, mod);
            return mod;
        }
        catch (error) {
            console.error(`[createFrame] Failed to load module for ${markerId}:`, error);
            return undefined;
        }
        finally {
            context.moduleLoads.delete(key);
        }
    })();
    context.moduleLoads.set(key, loadPromise);
    return loadPromise;
}
function createElement(component, props) {
    let revivedProps = reviveSerializedValue(props);
    return jsx(component, revivedProps);
}
function reviveSerializedValue(value) {
    if (value === null || value === undefined)
        return value;
    if (typeof value !== 'object')
        return value;
    if (Array.isArray(value)) {
        return value.map((item) => reviveSerializedValue(item));
    }
    let record = value;
    if (record.$rmxFrame === true) {
        let props = reviveSerializedObject(record.props);
        let key = reviveSerializedValue(record.key);
        return jsx(Frame, props, key);
    }
    if (record.$rmx === true && typeof record.type === 'string') {
        let props = reviveSerializedObject(record.props);
        let key = reviveSerializedValue(record.key);
        return jsx(record.type, props, key);
    }
    let revived = {};
    for (let key in record) {
        revived[key] = reviveSerializedValue(record[key]);
    }
    return revived;
}
function reviveSerializedObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    let revived = reviveSerializedValue(value);
    if (!revived || typeof revived !== 'object' || Array.isArray(revived))
        return {};
    return revived;
}
function hydrateRegion(vElement, start, end, context) {
    context.pendingClientEntries.delete(start);
    // The same marker can be discovered by overlapping hydration passes
    // (for example, document root + nested frame root). Reuse the existing
    // virtual root instead of redefining the marker property.
    if (isHydratedVirtualRootMarker(start)) {
        start.$rmx.render(vElement);
        return;
    }
    let root = createRangeRoot([start, end], {
        scheduler: context.scheduler,
        frame: context.frame,
        styleManager: context.styleManager,
    });
    Object.defineProperty(start, '$rmx', { value: root, enumerable: false });
    root.render(vElement);
}
function createSubFrames(nodes, context) {
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        if (isFrameStart(node)) {
            let end = findEndMarker(node, isFrameStart, isFrameEnd);
            if (!context.frameInstances.has(node)) {
                let id = getFrameId(node);
                let marker = context.data.f?.[id];
                if (marker) {
                    let frameMarker = { ...marker, id };
                    let subFrame = createFrame([node, end], {
                        src: frameMarker.src,
                        marker: frameMarker,
                        topFrame: context.topFrame,
                        loadModule: context.loadModule,
                        resolveFrame: context.resolveFrame,
                        pendingClientEntries: context.pendingClientEntries,
                        scheduler: context.scheduler,
                        styleManager: context.styleManager,
                        data: context.data,
                        moduleCache: context.moduleCache,
                        moduleLoads: context.moduleLoads,
                        frameInstances: context.frameInstances,
                        namedFrames: context.namedFrames,
                    });
                    context.frameInstances.set(node, subFrame);
                }
            }
            i = nodes.indexOf(end);
            continue;
        }
        if (node.childNodes && node.childNodes.length > 0) {
            createSubFrames(Array.from(node.childNodes), context);
        }
    }
}
function isHydrationMarkerLive(marker, context) {
    if (!marker.start.isConnected || !marker.end.isConnected)
        return false;
    if (marker.start.parentNode !== marker.end.parentNode)
        return false;
    let startText = marker.start.data.trim();
    if (startText !== `rmx:h:${marker.id}`)
        return false;
    if (marker.end.data.trim() !== '/rmx:h')
        return false;
    let parent = marker.start.parentNode;
    if (!parent)
        return false;
    if (context.regionTailRef) {
        let startPosition = marker.start.compareDocumentPosition(context.regionTailRef);
        let endPosition = marker.end.compareDocumentPosition(context.regionTailRef);
        let tailFollowsStart = (startPosition & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        let tailFollowsEnd = (endPosition & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        if (!tailFollowsStart || !tailFollowsEnd)
            return false;
    }
    return true;
}
function removeVirtualRoots(nodes) {
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        if (isHydratedVirtualRootMarker(node)) {
            node.$rmx.dispose();
            let end = findEndMarker(node, isHydrationStart, isHydrationEnd);
            i = nodes.indexOf(end);
            continue;
        }
        if (node.childNodes && node.childNodes.length > 0) {
            removeVirtualRoots(Array.from(node.childNodes));
        }
    }
}
function disposeSubFrames(nodes, context) {
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        if (isFrameStart(node)) {
            let end = findEndMarker(node, isFrameStart, isFrameEnd);
            let subFrame = context.frameInstances.get(node);
            if (subFrame) {
                subFrame.dispose();
                context.frameInstances.delete(node);
            }
            i = nodes.indexOf(end);
            continue;
        }
        if (node.childNodes && node.childNodes.length > 0) {
            disposeSubFrames(Array.from(node.childNodes), context);
        }
    }
}
function getEarlyFrameContent(id) {
    let template = document.querySelector(`template#${id}`);
    if (template instanceof HTMLTemplateElement) {
        let fragment = template.content;
        template.remove();
        return fragment;
    }
    return null;
}
function setupTemplateObserver() {
    let root = document.body ?? document.documentElement ?? document;
    let observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            for (let node of mutation.addedNodes) {
                collectAndPublishTemplates(node);
            }
        }
    });
    observer.observe(root, { childList: true, subtree: true });
    return observer;
}
function collectAndPublishTemplates(node) {
    if (node instanceof HTMLTemplateElement) {
        publishFrameTemplateElement(node);
        return;
    }
    if (!(node instanceof Element))
        return;
    let templates = Array.from(node.querySelectorAll('template'));
    for (let template of templates) {
        if (!(template instanceof HTMLTemplateElement))
            continue;
        publishFrameTemplateElement(template);
    }
}
function publishFrameTemplateElement(template) {
    if (!template.id)
        return;
    template.remove();
    publishFrameTemplate(template.id, template.content);
}
export function publishFrameTemplate(id, fragment) {
    let listeners = frameTemplateListeners.get(id);
    if (!listeners || listeners.size === 0) {
        let queue = bufferedFrameTemplates.get(id);
        if (!queue) {
            queue = [];
            bufferedFrameTemplates.set(id, queue);
        }
        queue.push(fragment);
        return;
    }
    for (let listener of listeners) {
        listener(fragment.cloneNode(true));
    }
}
export function consumeFrameTemplate(id) {
    let queue = bufferedFrameTemplates.get(id);
    if (!queue || queue.length === 0)
        return null;
    let fragment = queue.shift() ?? null;
    if (queue.length === 0) {
        bufferedFrameTemplates.delete(id);
    }
    return fragment;
}
function subscribeFrameTemplate(id, listener) {
    let listeners = frameTemplateListeners.get(id);
    if (!listeners) {
        listeners = new Set();
        frameTemplateListeners.set(id, listeners);
    }
    listeners.add(listener);
    return () => {
        let current = frameTemplateListeners.get(id);
        if (!current)
            return;
        current.delete(listener);
        if (current.size === 0) {
            frameTemplateListeners.delete(id);
        }
    };
}
const COMPLETE_TEMPLATE_WITH_ID_PATTERN = /<template\b[^>]*\bid=(?:"([^"]+)"|'([^']+)')[^>]*>[\s\S]*?<\/template>/gi;
function extractTemplatesFromBuffer(doc, buffer, onTemplate) {
    let html = '';
    let cursor = 0;
    let hadMatch = false;
    COMPLETE_TEMPLATE_WITH_ID_PATTERN.lastIndex = 0;
    let match = COMPLETE_TEMPLATE_WITH_ID_PATTERN.exec(buffer);
    while (match) {
        hadMatch = true;
        let index = match.index;
        let fullMatch = match[0];
        let id = match[1] ?? match[2];
        let matchEnd = index + fullMatch.length;
        html += buffer.slice(cursor, index);
        if (id) {
            let parsed = createFragmentFromString(doc, fullMatch);
            let template = parsed.querySelector('template');
            if (template instanceof HTMLTemplateElement && template.id) {
                onTemplate(template.id, template.content);
            }
        }
        cursor = matchEnd;
        match = COMPLETE_TEMPLATE_WITH_ID_PATTERN.exec(buffer);
    }
    let tail = buffer.slice(cursor);
    if (tail === '')
        return { html, remainder: '' };
    let tailStart = tail.toLowerCase().lastIndexOf('<template');
    if (tailStart === -1) {
        return { html: html + tail, remainder: '' };
    }
    if (!hadMatch) {
        return {
            html: buffer.slice(0, tailStart),
            remainder: buffer.slice(tailStart),
        };
    }
    return {
        html: html + tail.slice(0, tailStart),
        remainder: tail.slice(tailStart),
    };
}
async function renderFrameStream(stream, doc, applyHtml) {
    let reader = stream.getReader();
    let decoder = new TextDecoder();
    let buffer = '';
    let html = '';
    let appliedLength = 0;
    let appliedOnce = false;
    try {
        while (true) {
            let { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            let parsed = extractTemplatesFromBuffer(doc, buffer, publishFrameTemplate);
            buffer = parsed.remainder;
            if (parsed.html !== '') {
                html += parsed.html;
                await applyHtml(html);
                appliedLength = html.length;
                appliedOnce = true;
            }
        }
        buffer += decoder.decode();
        let parsed = extractTemplatesFromBuffer(doc, buffer, publishFrameTemplate);
        html += parsed.html;
        buffer = parsed.remainder;
        if (buffer !== '') {
            html += buffer;
            buffer = '';
        }
        if (html !== '' && html.length > appliedLength) {
            await applyHtml(html);
            appliedOnce = true;
        }
        // A frame stream can legitimately resolve to empty content. Ensure the
        // existing frame region is cleared instead of treated as a no-op.
        if (html === '' && !appliedOnce) {
            await applyHtml('');
        }
    }
    finally {
        reader.releaseLock();
    }
}
function createContainer(root) {
    return Array.isArray(root) ? createCommentContainer(root) : createElementContainer(root);
}
function createElementContainer(root) {
    let doc = root instanceof Document ? root : (root.ownerDocument ?? document);
    return {
        doc,
        root,
        get childNodes() {
            return Array.from(root.childNodes);
        },
    };
}
function createCommentContainer([start, end]) {
    let parent = end.parentNode;
    invariant(parent, 'Invalid comment container');
    invariant(start.parentNode === parent, 'Boundaries must share parent');
    let doc = parent.ownerDocument ?? document;
    let getChildNodesBetween = () => {
        let nodes = [];
        let node = start.nextSibling;
        while (node && node !== end) {
            nodes.push(node);
            node = node.nextSibling;
        }
        return nodes;
    };
    return {
        doc,
        root: parent,
        get childNodes() {
            return getChildNodesBetween();
        },
        regionTailRef: end,
        regionParent: parent,
    };
}
function createFragmentFromString(doc, content) {
    let template = doc.createElement('template');
    template.innerHTML = content.trim();
    return template.content;
}
function isFullDocumentHtml(content) {
    let trimmed = content.trimStart();
    return /^<!doctype html\b/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
}
function findHydrationMarkers(container) {
    let results = [];
    forEachComment(container, (comment) => {
        let trimmed = comment.data.trim();
        if (!trimmed.startsWith('rmx:h:'))
            return;
        let id = trimmed.slice('rmx:h:'.length);
        let end = findEndMarker(comment, isHydrationStart, isHydrationEnd);
        results.push({ id, start: comment, end });
    });
    return results;
}
function forEachComment(container, cb) {
    walkCommentsInNodes(container.childNodes, cb);
}
function walkCommentsInNodes(nodes, cb) {
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        // Frame ownership boundary: hydration markers inside nested frame regions
        // are discovered and hydrated by the nested frame instance only.
        if (isFrameStart(node)) {
            let end = findEndMarker(node, isFrameStart, isFrameEnd);
            i = nodes.indexOf(end);
            continue;
        }
        if (node.nodeType === Node.COMMENT_NODE)
            cb(node);
        if (node.childNodes && node.childNodes.length > 0) {
            walkCommentsInNodes(Array.from(node.childNodes), cb);
        }
    }
}
function isHydrationStart(node) {
    return node.data.trim().startsWith('rmx:h:');
}
function isHydrationEnd(node) {
    return node.data.trim() === '/rmx:h';
}
function isHydratedVirtualRootMarker(node) {
    return node instanceof Comment && '$rmx' in node;
}
function isFrameStart(node) {
    return node instanceof Comment && node.data.trim().startsWith('rmx:f:');
}
function isFrameEnd(node) {
    return node.data.trim() === '/rmx:f';
}
function getFrameId(start) {
    let trimmed = start.data.trim();
    invariant(trimmed.startsWith('rmx:f:'), 'Invalid frame start marker');
    return trimmed.slice('rmx:f:'.length);
}
function findEndMarker(start, isStart, isEnd) {
    let node = start.nextSibling;
    let depth = 1;
    while (node) {
        if (node.nodeType === Node.COMMENT_NODE) {
            let comment = node;
            if (isStart(comment))
                depth++;
            else if (isEnd(comment)) {
                depth--;
                if (depth === 0)
                    return comment;
            }
        }
        node = node.nextSibling;
    }
    throw new Error('End marker not found');
}
//# sourceMappingURL=frame.js.map