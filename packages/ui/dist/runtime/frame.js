import { jsx } from './jsx.js';
import { Frame, createFrameHandle } from './component.js';
import { createComponentErrorEvent, getComponentError } from './error-event.js';
import { invariant } from './invariant.js';
import { createRangeRoot, createRoot } from './vdom.js';
import { diffElementAttributes, diffNodes } from './diff-dom.js';
import { createStyleManager } from '../style/index.js';
import { findFlushMarker } from './stream-protocol.js';
import { getDocumentModulePreloader } from './module-preloader.js';
import { unwrapFrameResolution } from './frame-resolution.js';
import { disposeClientEntryBoundary, getClientEntryBoundaryOwner, setClientEntryBoundaryOwner, } from './client-entry-boundary.js';
import { getDocumentImportMapManager } from './import-map-manager.js';
import { reloadDocument } from './document-reload.js';
export class NamedFrameRegistry {
    #framesByName = new Map();
    register(name, frame) {
        let frames = this.#framesByName.get(name);
        if (frames) {
            frames.push(frame);
        }
        else {
            this.#framesByName.set(name, [frame]);
        }
    }
    get(name) {
        return this.#framesByName.get(name)?.at(-1);
    }
    unregister(name, frame) {
        let frames = this.#framesByName.get(name);
        if (!frames)
            return;
        let index = frames.lastIndexOf(frame);
        if (index === -1)
            return;
        frames.splice(index, 1);
        if (frames.length === 0) {
            this.#framesByName.delete(name);
        }
    }
}
const bufferedFrameTemplates = new Map();
const frameTemplateListeners = new Map();
const pendingClientEntryHydrations = new WeakMap();
const frameClientEntryParents = new WeakMap();
const DOCTYPE_PATTERN = /<!doctype(?:\s[^>]*)?>/gi;
function createLinkedAbortController(first, second) {
    let controller = new AbortController();
    let signals = second ? [first, second] : [first];
    let abort = () => controller.abort();
    for (let signal of signals) {
        if (signal.aborted) {
            controller.abort();
            break;
        }
        signal.addEventListener('abort', abort, { once: true });
    }
    return {
        controller,
        disconnect() {
            for (let signal of signals) {
                signal.removeEventListener('abort', abort);
            }
        },
    };
}
function stripDoctypeMarkup(html) {
    return html.replace(DOCTYPE_PATTERN, '');
}
// Marker-less HTML is a whole document when it starts with a doctype or `<html>`.
// `renderToString` strips flush markers before returning, and so does any comment-stripping
// minifier run over static output, so the marker alone cannot tell the two apart here.
// Diffing such HTML as a fragment parses it inside a `<template>`, which drops the
// `<html>`/`<head>`/`<body>` wrappers and makes the document diff throw HierarchyRequestError.
const FULL_DOCUMENT_PATTERN = /^\s*(?:<!doctype\b|<html\b)/i;
function inferFlushKind(html) {
    return FULL_DOCUMENT_PATTERN.test(html) ? 'document' : 'fragment';
}
const FRAME_RUNTIME = Symbol('FrameRuntime');
export function isFrameRuntime(value) {
    return isRecord(value) && Reflect.get(value, FRAME_RUNTIME) === true;
}
/**
 * Reloads a frame and returns response metadata used by the navigation runtime.
 *
 * @param frame Frame handle to reload.
 * @param options Form submission metadata and cancellation signal.
 * @returns The reload signal and final response URL, when redirected.
 */
export function reloadFrameForNavigation(frame, options) {
    let runtime = frame.$runtime;
    invariant(isFrameRuntime(runtime), 'Expected a frame runtime');
    let reload = runtime.reloadForNavigation;
    invariant(reload, 'Expected frame runtime to support navigation reloads');
    return reload(options);
}
export function createFrame(root, init) {
    let container = createContainer(root);
    let contentRoot;
    let reloadController;
    // The style registry is document-level and shared by every frame; only the
    // frame that created it (the runtime root) disposes it.
    let ownsStyleManager = !init.styleManager;
    let reloadAbortUnsubscribe;
    let reloadKind;
    let styleManager = init.styleManager ?? createStyleManager();
    let modulePreloader = getDocumentModulePreloader(container.doc);
    let importMapManager = getDocumentImportMapManager(container.doc);
    let currentMarker = init.marker;
    let displayedContentStatus = init.marker?.status ?? 'resolved';
    let pendingTemplateMarkerId;
    let pendingTemplateObserver;
    let pendingTemplateUnsubscribe;
    let inheritedReloadPending = false;
    let inheritedReloadAbortUnsubscribe;
    let disposed = false;
    let lifecycleController = new AbortController();
    async function consumeClientEntryResources(source, documentHref) {
        let importMapStatus = importMapManager.consumeImportMaps(source);
        if (importMapStatus !== 'ready') {
            lifecycleController.abort();
            if (importMapStatus === 'conflict')
                reloadDocument(container.doc, documentHref);
            return false;
        }
        await modulePreloader.consumePreloadLinks(source, init.processClientEntryPreloads);
        return true;
    }
    let initialClientEntryResources;
    function shouldPreserveManagedHeadNode(node) {
        return (importMapManager.shouldPreserveHeadNode(node) ||
            (modulePreloader.hasActivePreloads() && modulePreloader.isActivePreload(node)));
    }
    if (isDocumentNode(container.root)) {
        modulePreloader.adoptInitialPreloadLinks(container.root);
    }
    else {
        initialClientEntryResources = consumeClientEntryResources(container.root);
    }
    // Merge any rmx-data found in the current document once at startup.
    mergeRmxDataFromDocument(init.data, container.doc);
    let runtime = createFrameRuntime({
        ...init,
        styleManager,
        reloadForNavigation: startReloadTransition,
    });
    let frame = createFrameHandle({
        src: init.src,
        $runtime: runtime,
        reload: async (options) => (await reload(options)).signal,
        submit: async (options) => (await submit(options)).signal,
        replace: async (content) => {
            await render(content);
        },
    });
    runtime.topFrame = runtime.topFrame ?? init.topFrame ?? frame;
    let frameName = init.marker?.name ?? init.name;
    if (frameName) {
        init.namedFrames.register(frameName, frame);
    }
    let context = {
        topFrame: runtime.topFrame,
        getContext: (type) => runtime.getContext?.(type),
        errorTarget: init.errorTarget,
        loadModule: init.loadModule,
        resolveFrame: init.resolveFrame,
        pendingClientEntries: init.pendingClientEntries,
        scheduler: init.scheduler,
        frame,
        styleManager,
        data: init.data,
        moduleCache: init.moduleCache,
        moduleLoads: init.moduleLoads,
        frameInstances: init.frameInstances,
        namedFrames: init.namedFrames,
        processClientEntryPreloads: init.processClientEntryPreloads,
        lifecycleSignal: lifecycleController.signal,
        regionTailRef: container.regionTailRef,
        regionParent: container.regionParent,
    };
    async function render(content, options) {
        if (disposed || lifecycleController.signal.aborted || options?.signal?.aborted)
            return;
        let ownsData = options?.data === undefined;
        let renderOptions = {
            ...options,
            data: options?.data ?? {},
        };
        try {
            await renderContent(content, renderOptions);
        }
        finally {
            if (ownsData)
                clearRmxData(renderOptions.data);
        }
    }
    async function renderContent(content, options) {
        if (isRenderAborted(options.signal))
            return;
        if (content instanceof ReadableStream) {
            let linkedAbort = createLinkedAbortController(lifecycleController.signal, options.signal);
            try {
                await renderFrameStream(content, container.doc, async (html, flushKind) => {
                    if (isRenderAborted(options.signal))
                        return;
                    await render(html, { ...options, flushKind });
                }, linkedAbort.controller.signal);
            }
            finally {
                linkedAbort.disconnect();
            }
            return;
        }
        if (isRemixNodeFrameContent(content)) {
            if (!contentRoot) {
                let currentNodes = getContentNodes();
                removeVirtualRoots(currentNodes);
                disposeSubFrames(currentNodes, context);
                clearFrameContent();
                contentRoot = createFrameContentRoot();
            }
            if (isRenderAborted(options.signal))
                return;
            let previousServerFrameReload = runtime.serverFrameReload;
            if (options.signal) {
                runtime.serverFrameReload = {
                    signal: options.signal,
                    reconciliationTracker: options.reconciliationTracker,
                    blockingFrameTracker: options.blockingFrameTracker,
                };
            }
            try {
                contentRoot.render(content);
                await new Promise((resolve) => context.scheduler.enqueueCommitPhase([resolve]));
                options.onCommit?.();
            }
            finally {
                runtime.serverFrameReload = previousServerFrameReload;
            }
            if (isRenderAborted(options.signal))
                return;
            displayedContentStatus = options.contentStatus ?? 'resolved';
            return;
        }
        if (contentRoot) {
            contentRoot.dispose();
            contentRoot = undefined;
        }
        if (typeof content === 'string') {
            let flushed = await consumeFlushBatches(content, async (html, flushKind) => {
                await render(html, { ...options, flushKind });
            });
            if (flushed.applied) {
                if (flushed.remainder !== '') {
                    await render(flushed.remainder, { ...options, flushKind: 'fragment' });
                }
                return;
            }
        }
        let rawHtml = typeof content === 'string' ? content : undefined;
        let htmlContent = rawHtml === undefined ? undefined : stripDoctypeMarkup(rawHtml);
        let isFullDocumentReload = container.root instanceof Document &&
            rawHtml !== undefined &&
            (options.flushKind ?? inferFlushKind(rawHtml)) === 'document';
        if (isFullDocumentReload && htmlContent !== undefined) {
            let parsed = new DOMParser().parseFromString(htmlContent, 'text/html');
            if (!(await consumeClientEntryResources(parsed, options.documentHref)))
                return;
            if (isRenderAborted(options.signal))
                return;
            let responseData = options.data;
            mergeRmxDataFromDocument(responseData, parsed);
            let responseContext = {
                ...context,
                data: responseData,
                reconciliationTracker: options.reconciliationTracker,
                blockingFrameTracker: options.blockingFrameTracker,
            };
            context.styleManager.adoptServerStyles(collectFrameServerStyleTags(createElementContainer(parsed)));
            diffElementAttributes(container.doc.documentElement, parsed.documentElement);
            diffNodes([container.doc.head], [parsed.head], {
                ...responseContext,
                regionParent: container.doc.documentElement,
                regionTailRef: null,
                signal: options.signal,
                shouldPreserveHeadNode: shouldPreserveManagedHeadNode,
            });
            diffNodes([container.doc.body], [parsed.body], {
                ...responseContext,
                regionParent: container.doc.documentElement,
                regionTailRef: null,
                signal: options.signal,
            });
            let bodyContainer = createElementContainer(container.doc.body);
            if (isRenderAborted(options.signal))
                return;
            let subFramesReady = hydrateContainer(bodyContainer, responseContext, options);
            options.onCommit?.();
            await subFramesReady;
            if (isRenderAborted(options.signal))
                return;
            displayedContentStatus = options.contentStatus ?? 'resolved';
            return;
        }
        let fragment = htmlContent !== undefined ? createFragmentFromString(container.doc, htmlContent) : content;
        if (!(await consumeClientEntryResources(fragment, options.documentHref)))
            return;
        if (isRenderAborted(options.signal))
            return;
        context.styleManager.adoptServerStyles(collectFrameServerStyleTags(createElementContainer(fragment)));
        removeEmptyHeads(fragment);
        let responseData = options.data;
        mergeRmxDataFromFragment(responseData, fragment);
        let responseContext = {
            ...context,
            data: responseData,
            reconciliationTracker: options.reconciliationTracker,
            blockingFrameTracker: options.blockingFrameTracker,
        };
        let nextContainer = createContainer(fragment);
        if (isRenderAborted(options.signal))
            return;
        diffNodes(container.childNodes, Array.from(nextContainer.childNodes), {
            ...responseContext,
            regionTailRef: container.regionTailRef,
            regionParent: container.regionParent,
            signal: options.signal,
        });
        let subFramesReady = hydrateContainer(container, responseContext, options);
        options.onCommit?.();
        await subFramesReady;
        if (isRenderAborted(options.signal))
            return;
        displayedContentStatus = options.contentStatus ?? 'resolved';
    }
    function isRenderAborted(signal) {
        return disposed || lifecycleController.signal.aborted || signal?.aborted === true;
    }
    function createFrameContentRoot() {
        let virtualRoot;
        if (container.root instanceof Document) {
            virtualRoot = createRoot(container.doc.body, {
                scheduler: context.scheduler,
                frame,
                getContext: context.getContext,
                styleManager: context.styleManager,
            });
        }
        else {
            invariant(Array.isArray(root), 'Expected comment-bounded frame root');
            virtualRoot = createRangeRoot(root, {
                scheduler: context.scheduler,
                frame,
                getContext: context.getContext,
                styleManager: context.styleManager,
            });
        }
        virtualRoot.addEventListener('error', (event) => {
            if (context.errorTarget === virtualRoot)
                return;
            context.errorTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
        });
        return virtualRoot;
    }
    function getContentNodes() {
        return container.root instanceof Document
            ? Array.from(container.doc.body.childNodes)
            : container.childNodes;
    }
    function clearFrameContent() {
        for (let node of getContentNodes()) {
            node.parentNode?.removeChild(node);
        }
    }
    async function hydrateInitial() {
        let reconciliationTracker = createReconciliationTracker();
        if ((await initialClientEntryResources) === false)
            return;
        if (disposed || context.lifecycleSignal.aborted)
            return;
        context.styleManager.adoptServerStyles(collectFrameServerStyleTags(container));
        let subFramesReady = hydrateContainer(container, context, { reconciliationTracker });
        try {
            await subFramesReady;
            if (disposed || context.lifecycleSignal.aborted)
                return;
            if (currentMarker?.status === 'pending') {
                await watchPendingFrameTemplate(currentMarker, reconciliationTracker);
            }
            reconciliationTracker.finalize();
            await reconciliationTracker.ready();
        }
        finally {
            clearRmxData(context.data);
        }
    }
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        lifecycleController.abort();
        clearRmxData(context.data);
        reloadController?.abort();
        reloadController = undefined;
        reloadAbortUnsubscribe?.();
        reloadAbortUnsubscribe = undefined;
        reloadKind = undefined;
        contentRoot?.dispose();
        contentRoot = undefined;
        clearPendingFrameTemplateWatch();
        // Remove hydrated virtual roots in this frame's region.
        removeVirtualRoots(container.childNodes);
        // Dispose sub-frames recursively.
        disposeSubFrames(container.childNodes, context);
        if (ownsStyleManager) {
            context.styleManager.dispose();
        }
        if (frameName) {
            init.namedFrames.unregister(frameName, frame);
        }
    }
    let readyPromise = hydrateInitial();
    return {
        render,
        ready: () => readyPromise,
        flush: () => context.scheduler.dequeue(),
        clearPendingTemplateWatch: clearPendingFrameTemplateWatch,
        isDisplayingResolvedContent: () => displayedContentStatus === 'resolved',
        beginClientFrameReloadForAncestorReload,
        cancelReload,
        startInheritedReload,
        updateMarker,
        renderMarkerContent,
        matchesIdentity: (src, name) => !disposed && frame.src === src && frameName === name,
        dispose,
        handle: frame,
    };
    async function updateMarker(marker, options) {
        if (disposed || context.lifecycleSignal.aborted || options?.signal?.aborted)
            return;
        let previousMarker = currentMarker;
        let isInheritedReload = previousMarker !== undefined && previousMarker.id !== marker.id;
        currentMarker = marker;
        if (isInheritedReload) {
            startInheritedReload(options?.signal);
        }
        if (marker.status === 'pending') {
            await watchPendingFrameTemplate(marker, options?.reconciliationTracker, options?.signal, isInheritedReload
                ? () => {
                    completeInheritedReload();
                }
                : undefined);
        }
        else {
            clearPendingFrameTemplateWatch();
            if (isInheritedReload && !options?.signal?.aborted) {
                completeInheritedReload();
            }
        }
    }
    async function renderMarkerContent(marker, content, options) {
        if (disposed || context.lifecycleSignal.aborted || options?.signal?.aborted)
            return;
        let previousMarker = currentMarker;
        let isInheritedReload = previousMarker !== undefined && previousMarker.id !== marker.id;
        currentMarker = marker;
        if (isInheritedReload) {
            startInheritedReload(options?.signal);
        }
        clearPendingFrameTemplateWatch();
        await render(content, { ...options, contentStatus: 'resolved' });
        if (isInheritedReload &&
            !disposed &&
            !context.lifecycleSignal.aborted &&
            !options?.signal?.aborted) {
            completeInheritedReload();
        }
    }
    async function reload(options) {
        if (options?.signal?.aborted) {
            return { signal: AbortSignal.abort(options.signal.reason) };
        }
        let transition = startReloadTransition(undefined, options?.signal);
        void transition.committed.catch(() => { });
        return await transition.finished;
    }
    async function submit(options) {
        if (options.signal?.aborted) {
            return { signal: AbortSignal.abort(options.signal.reason) };
        }
        let form = options.data instanceof HTMLFormElement ? options.data : undefined;
        let submitter = options.submitter;
        let action = options.action ??
            (form
                ? submitter?.hasAttribute('formaction')
                    ? submitter.formAction
                    : form.action
                : frame.src);
        let method = options.method ??
            (form ? (submitter?.hasAttribute('formmethod') ? submitter.formMethod : form.method) : 'post');
        let encType = options.encType ??
            (form
                ? submitter?.hasAttribute('formenctype')
                    ? submitter.formEnctype
                    : form.enctype
                : 'application/x-www-form-urlencoded');
        let formData = options.data instanceof HTMLFormElement ? new FormData(options.data, submitter) : options.data;
        if (options.signal?.aborted) {
            return { signal: AbortSignal.abort(options.signal.reason) };
        }
        if (method.toLowerCase() === 'get') {
            let url = new URL(action, container.doc.baseURI);
            let search = new URLSearchParams();
            for (let [name, value] of formData) {
                search.append(name, typeof value === 'string' ? value : value.name);
            }
            url.search = search.toString();
            action = url.href;
        }
        frame.src = action;
        let transition = startReloadTransition(method.toLowerCase() === 'get' ? undefined : { formData, method, encType }, options.signal);
        void transition.committed.catch(() => { });
        let result = await transition.finished;
        if (result.redirectedTo && !result.signal.aborted) {
            frame.src = result.redirectedTo;
        }
        return result;
    }
    function startReloadTransition(options, requestSignal) {
        let controller = startReload(options?.signal);
        let committed = Promise.withResolvers();
        let commitStarted = false;
        let finished = resolveAndRenderReload(controller, options, (ready) => {
            if (commitStarted)
                return;
            commitStarted = true;
            void ready.then(committed.resolve, committed.reject);
        }, requestSignal);
        // Settle committed when a reload is aborted or fails before rendering any content.
        void finished.then(() => committed.resolve(), committed.reject);
        return { signal: controller.signal, committed: committed.promise, finished };
    }
    function startReload(signal) {
        let controller = replaceReloadController(signal);
        reloadKind = 'direct';
        frame.dispatchEvent(new Event('reloadStart'));
        startSubFrameInheritedReloads(getContentNodes(), controller.signal);
        return controller;
    }
    function beginClientFrameReloadForAncestorReload(signal) {
        let inheritedReloadStarted = reuseInheritedReloadStart();
        let continuingAncestorReload = reloadKind === 'ancestor';
        let controller = replaceReloadController(signal);
        reloadKind = 'ancestor';
        if (!inheritedReloadStarted && !continuingAncestorReload) {
            frame.dispatchEvent(new Event('reloadStart'));
            startSubFrameInheritedReloads(getContentNodes(), controller.signal);
        }
        return {
            controller,
            complete: () => completeReload(controller),
        };
    }
    function cancelReload() {
        let controller = reloadController;
        if (!controller)
            return;
        controller.abort();
        completeReload(controller);
    }
    function replaceReloadController(signal) {
        reloadController?.abort();
        reloadAbortUnsubscribe?.();
        reloadAbortUnsubscribe = undefined;
        let controller = new AbortController();
        reloadController = controller;
        if (signal) {
            if (signal.aborted) {
                controller.abort();
            }
            else {
                let abort = () => controller.abort();
                signal.addEventListener('abort', abort, { once: true });
                reloadAbortUnsubscribe = () => signal.removeEventListener('abort', abort);
            }
        }
        return controller;
    }
    async function resolveAndRenderReload(controller, options, resolveCommit, requestSignal) {
        try {
            let resolution;
            let abort = () => controller.abort(requestSignal?.reason);
            requestSignal?.addEventListener('abort', abort, { once: true });
            try {
                if (requestSignal?.aborted)
                    abort();
                if (controller.signal.aborted)
                    return { signal: controller.signal };
                resolution = await init.resolveFrame(frame.src, {
                    ...options,
                    signal: controller.signal,
                    target: frameName,
                });
            }
            finally {
                // Rendering can remove the caller and abort its signal while the response is still streaming.
                requestSignal?.removeEventListener('abort', abort);
            }
            if (reloadController !== controller || controller.signal.aborted) {
                return { signal: controller.signal };
            }
            let { content, redirectedTo } = await unwrapFrameResolution(resolution);
            if (reloadController !== controller || controller.signal.aborted) {
                return { signal: controller.signal };
            }
            let reconciliationTracker = createReconciliationTracker();
            let blockingFrameTracker = createReconciliationTracker();
            let commitStarted = false;
            await render(content, {
                documentHref: isDocumentNode(container.root) ? (redirectedTo ?? frame.src) : undefined,
                signal: controller.signal,
                reconciliationTracker,
                blockingFrameTracker,
                onCommit() {
                    if (commitStarted)
                        return;
                    commitStarted = true;
                    blockingFrameTracker.finalize();
                    resolveCommit?.(blockingFrameTracker.ready());
                },
            });
            reconciliationTracker.finalize();
            await reconciliationTracker.ready();
            return {
                signal: controller.signal,
                redirectedTo: reloadController === controller && !controller.signal.aborted ? redirectedTo : undefined,
            };
        }
        catch (error) {
            if (reloadController !== controller || controller.signal.aborted) {
                return { signal: controller.signal };
            }
            init.errorTarget.dispatchEvent(createComponentErrorEvent(error));
            throw error;
        }
        finally {
            completeReload(controller);
        }
    }
    function completeReload(controller) {
        if (reloadController !== controller || reloadKind === undefined)
            return;
        reloadAbortUnsubscribe?.();
        reloadAbortUnsubscribe = undefined;
        reloadKind = undefined;
        frame.dispatchEvent(new Event('reloadComplete'));
    }
    function startInheritedReload(signal) {
        if (signal?.aborted)
            return;
        if (!inheritedReloadPending) {
            inheritedReloadPending = true;
            frame.dispatchEvent(new Event('reloadStart'));
            startSubFrameInheritedReloads(getContentNodes(), signal);
        }
        inheritedReloadAbortUnsubscribe?.();
        inheritedReloadAbortUnsubscribe = undefined;
        if (signal) {
            let abort = () => completeInheritedReload();
            signal.addEventListener('abort', abort, { once: true });
            inheritedReloadAbortUnsubscribe = () => {
                signal.removeEventListener('abort', abort);
            };
        }
    }
    function reuseInheritedReloadStart() {
        if (!inheritedReloadPending)
            return false;
        inheritedReloadPending = false;
        inheritedReloadAbortUnsubscribe?.();
        inheritedReloadAbortUnsubscribe = undefined;
        return true;
    }
    function completeInheritedReload() {
        if (!inheritedReloadPending)
            return;
        inheritedReloadPending = false;
        inheritedReloadAbortUnsubscribe?.();
        inheritedReloadAbortUnsubscribe = undefined;
        frame.dispatchEvent(new Event('reloadComplete'));
    }
    function startSubFrameInheritedReloads(nodes, signal) {
        for (let i = 0; i < nodes.length; i++) {
            if (signal?.aborted)
                break;
            let node = nodes[i];
            if (isFrameStart(node)) {
                let end = findEndMarker(node, isFrameStart, isFrameEnd);
                context.frameInstances.get(node)?.startInheritedReload(signal);
                i = findMarkerRangeEndIndex(nodes, end, i);
                continue;
            }
            if (node.childNodes && node.childNodes.length > 0) {
                startSubFrameInheritedReloads(Array.from(node.childNodes), signal);
            }
        }
    }
    function clearPendingFrameTemplateWatch() {
        pendingTemplateUnsubscribe?.();
        pendingTemplateUnsubscribe = undefined;
        pendingTemplateObserver?.disconnect();
        pendingTemplateObserver = undefined;
        pendingTemplateMarkerId = undefined;
    }
    async function watchPendingFrameTemplate(marker, reconciliationTracker, signal, onResolved) {
        if (disposed || context.lifecycleSignal.aborted || signal?.aborted)
            return;
        if (pendingTemplateMarkerId === marker.id)
            return;
        clearPendingFrameTemplateWatch();
        pendingTemplateMarkerId = marker.id;
        let early = consumeFrameTemplate(marker.id) ?? getEarlyFrameContent(marker.id);
        if (early) {
            clearPendingFrameTemplateWatch();
            await render(early, { reconciliationTracker, signal, contentStatus: 'resolved' });
            if (!disposed && !context.lifecycleSignal.aborted && !signal?.aborted)
                onResolved?.();
            return;
        }
        if (disposed || context.lifecycleSignal.aborted || signal?.aborted) {
            clearPendingFrameTemplateWatch();
            return;
        }
        let observer = setupTemplateObserver();
        pendingTemplateObserver = observer;
        let unsubscribe = subscribeFrameTemplate(marker.id, async (fragment) => {
            if (disposed || context.lifecycleSignal.aborted || signal?.aborted)
                return;
            if (pendingTemplateMarkerId !== marker.id)
                return;
            clearPendingFrameTemplateWatch();
            await render(fragment, { signal, contentStatus: 'resolved' });
            if (!disposed && !context.lifecycleSignal.aborted && !signal?.aborted)
                onResolved?.();
        });
        pendingTemplateUnsubscribe = unsubscribe;
        signal?.addEventListener('abort', () => {
            if (pendingTemplateMarkerId === marker.id) {
                clearPendingFrameTemplateWatch();
            }
        }, { once: true });
        let buffered = consumeFrameTemplate(marker.id);
        if (buffered) {
            clearPendingFrameTemplateWatch();
            await render(buffered, { reconciliationTracker, signal, contentStatus: 'resolved' });
            if (!disposed && !context.lifecycleSignal.aborted && !signal?.aborted)
                onResolved?.();
        }
    }
}
export function createFrameRuntime(init) {
    return {
        [FRAME_RUNTIME]: true,
        topFrame: init.topFrame,
        getContext: init.getContext,
        errorTarget: init.errorTarget,
        loadModule: init.loadModule,
        resolveFrame: init.resolveFrame,
        pendingClientEntries: init.pendingClientEntries,
        scheduler: init.scheduler,
        styleManager: init.styleManager,
        moduleCache: init.moduleCache,
        moduleLoads: init.moduleLoads,
        frameInstances: init.frameInstances,
        namedFrames: init.namedFrames,
        processClientEntryPreloads: init.processClientEntryPreloads,
        serverFrameReload: undefined,
        reloadForNavigation: init.reloadForNavigation,
    };
}
function createReconciliationTracker() {
    let pending = 0;
    let finalized = false;
    let failed = false;
    let failure;
    let resolveReady;
    let rejectReady;
    let readyPromise = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });
    function maybeSettle() {
        if (!finalized || pending !== 0)
            return;
        if (failed)
            rejectReady?.(failure);
        else
            resolveReady?.();
        resolveReady = undefined;
        rejectReady = undefined;
    }
    function track() {
        pending++;
        let completed = false;
        return () => {
            if (completed)
                return;
            completed = true;
            pending--;
            maybeSettle();
        };
    }
    return {
        track,
        waitFor(task) {
            let complete = track();
            void task.then(complete, (error) => {
                if (!failed) {
                    failed = true;
                    failure = error;
                }
                complete();
            });
        },
        finalize() {
            finalized = true;
            maybeSettle();
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
function clearRmxData(data) {
    delete data.h;
    delete data.f;
}
function removeEmptyHeads(fragment) {
    let heads = Array.from(fragment.querySelectorAll('head'));
    for (let head of heads) {
        if (!head.childNodes.length) {
            head.remove();
        }
    }
}
function collectFrameServerStyleTags(container) {
    let styles = [];
    let nodes = container.root instanceof Document
        ? [...Array.from(container.doc.head.childNodes), ...Array.from(container.doc.body.childNodes)]
        : container.childNodes;
    collectOwnedServerStyleTags(nodes, styles);
    return styles;
}
function collectOwnedServerStyleTags(nodes, styles) {
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        if (isFrameStart(node)) {
            let end = findEndMarker(node, isFrameStart, isFrameEnd);
            i = findMarkerRangeEndIndex(nodes, end, i);
            continue;
        }
        if (node instanceof HTMLStyleElement && node.matches('style[data-rmx-style]')) {
            styles.push(node);
            continue;
        }
        if (node.childNodes.length > 0) {
            collectOwnedServerStyleTags(Array.from(node.childNodes), styles);
        }
    }
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
function hydrateContainer(container, context, options) {
    let hydrationData = context.data.h;
    let hydrationMarkers = findHydrationMarkers(container, hydrationData);
    let hydrations = [];
    for (let marker of hydrationMarkers) {
        let entry = hydrationData?.[marker.id];
        if (!entry)
            continue;
        if (!context.pendingClientEntries.has(marker.start)) {
            context.pendingClientEntries.set(marker.start, [marker.end, undefined]);
        }
        let { promise, resolve } = Promise.withResolvers();
        pendingClientEntryHydrations.set(marker.start, promise);
        hydrations.push({
            marker,
            entry,
            complete() {
                if (pendingClientEntryHydrations.get(marker.start) === promise) {
                    pendingClientEntryHydrations.delete(marker.start);
                }
                resolve();
            },
        });
    }
    // Register frame metadata before a cached client entry can adopt its frame markers.
    let subFramesReady = createSubFrames(container.childNodes, context, options);
    for (let { marker, entry, complete } of hydrations) {
        scheduleHydrationMarker(marker, entry, context, complete, options?.reconciliationTracker, options?.signal);
    }
    return subFramesReady;
}
function scheduleHydrationMarker(marker, entry, context, onComplete, reconciliationTracker, signal) {
    if (signal?.aborted || context.lifecycleSignal.aborted) {
        onComplete();
        return;
    }
    let done = reconciliationTracker?.track();
    let key = `${entry.moduleUrl}#${entry.exportName}`;
    let identity = {
        moduleUrl: entry.moduleUrl,
        exportName: entry.exportName,
    };
    let props = entry.props;
    let completed = false;
    let complete = () => {
        if (completed)
            return;
        completed = true;
        props = undefined;
        signal?.removeEventListener('abort', complete);
        context.lifecycleSignal.removeEventListener('abort', complete);
        onComplete();
        done?.();
    };
    signal?.addEventListener('abort', complete, { once: true });
    context.lifecycleSignal.addEventListener('abort', complete, { once: true });
    let hydrateWithComponent = (component) => {
        if (signal?.aborted || context.lifecycleSignal.aborted)
            return;
        if (!isHydrationMarkerLive(marker, context))
            return;
        if (!props)
            return;
        let pending = context.pendingClientEntries.get(marker.start);
        let vElement = pending?.[1] ?? createElement(component, props);
        context.pendingClientEntries.set(marker.start, [marker.end, vElement]);
        hydrateRegion(vElement, marker.start, marker.end, identity, context, signal);
    };
    let parentHydration = marker.parent && pendingClientEntryHydrations.get(marker.parent);
    let cached = context.moduleCache.get(key);
    if (cached && !parentHydration) {
        hydrateWithComponent(cached);
        complete();
        return;
    }
    let component = cached ?? getOrStartModuleLoad(key, identity, marker.id, context);
    // Imports can finish in any order, but setup must wait for the owning entry's context.
    Promise.all([component, parentHydration])
        .then(([component]) => {
        if (component) {
            hydrateWithComponent(component);
        }
    })
        .finally(() => {
        complete();
    });
}
function getOrStartModuleLoad(key, identity, markerId, context) {
    let inFlight = context.moduleLoads.get(key);
    if (inFlight)
        return inFlight;
    let loadPromise = (async () => {
        try {
            let mod = await context.loadModule(identity.moduleUrl, identity.exportName);
            if (!isElementFunction(mod)) {
                throw new Error(`Export "${identity.exportName}" from "${identity.moduleUrl}" is not a function`);
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
    invariant(isRecord(revivedProps), 'Expected revived component props to be an object');
    return jsx(component, revivedProps);
}
function isElementFunction(value) {
    return typeof value === 'function';
}
function reviveSerializedValue(value) {
    if (value === null || value === undefined)
        return value;
    if (typeof value !== 'object')
        return value;
    if (Array.isArray(value)) {
        return value.map((item) => reviveSerializedValue(item));
    }
    if (!isRecord(value))
        return value;
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
    return isRecord(revived) ? revived : {};
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function hydrateRegion(vElement, start, end, identity, context, signal) {
    if (signal?.aborted)
        return;
    context.pendingClientEntries.delete(start);
    // During a server frame reload, expose the reload signal and reconciliation
    // tracker to client frames created while this entry renders so blocking
    // frames keep the reload pending until their content arrives.
    let renderEntry = (root) => {
        if (!signal) {
            root.render(vElement);
            return;
        }
        let frameRuntime = context.frame.$runtime;
        invariant(isFrameRuntime(frameRuntime), 'Expected frame runtime while rendering a client entry during a reload');
        let previousServerFrameReload = frameRuntime.serverFrameReload;
        frameRuntime.serverFrameReload = {
            signal,
            reconciliationTracker: context.reconciliationTracker,
            blockingFrameTracker: context.blockingFrameTracker,
        };
        try {
            root.render(vElement);
        }
        finally {
            frameRuntime.serverFrameReload = previousServerFrameReload;
        }
    };
    // The same marker can be discovered by overlapping hydration passes
    // (for example, document root + nested frame root). Reuse the existing
    // virtual root instead of redefining the marker property.
    let owner = getClientEntryBoundaryOwner(start);
    if (owner) {
        renderEntry(owner.root);
        return;
    }
    let root = createRangeRoot([start, end], {
        scheduler: context.scheduler,
        frame: context.frame,
        getContext: context.getContext,
        styleManager: context.styleManager,
    });
    root.addEventListener('error', (event) => {
        if (context.errorTarget === root)
            return;
        context.errorTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
    });
    setClientEntryBoundaryOwner(start, end, identity, root);
    renderEntry(root);
}
async function createSubFrames(nodes, context, options) {
    let tasks = [];
    for (let i = 0; i < nodes.length; i++) {
        if (options?.signal?.aborted)
            break;
        let node = nodes[i];
        if (isFrameStart(node)) {
            let end = findEndMarker(node, isFrameStart, isFrameEnd);
            let existingFrame = context.frameInstances.get(node);
            let id = getFrameId(node);
            let marker = context.data.f?.[id];
            if (existingFrame) {
                if (marker) {
                    let frameMarker = { ...marker, id };
                    tasks.push(existingFrame.updateMarker(frameMarker, options));
                }
                else {
                    existingFrame.clearPendingTemplateWatch();
                }
            }
            else {
                if (marker) {
                    let frameMarker = { ...marker, id };
                    let subFrame = createFrame([node, end], {
                        src: frameMarker.src,
                        marker: frameMarker,
                        topFrame: context.topFrame,
                        getContext: context.getContext,
                        errorTarget: context.errorTarget,
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
                        processClientEntryPreloads: context.processClientEntryPreloads,
                    });
                    context.frameInstances.set(node, subFrame);
                    if (frameMarker.status === 'resolved') {
                        tasks.push(subFrame.ready());
                    }
                }
            }
            i = findMarkerRangeEndIndex(nodes, end, i);
            continue;
        }
        if (node.childNodes && node.childNodes.length > 0) {
            tasks.push(createSubFrames(Array.from(node.childNodes), context, options));
        }
    }
    await Promise.all(tasks);
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
        if (isCommentNode(node) && isHydrationStart(node) && disposeClientEntryBoundary(node)) {
            let end = findEndMarker(node, isHydrationStart, isHydrationEnd);
            i = findMarkerRangeEndIndex(nodes, end, i);
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
            i = findMarkerRangeEndIndex(nodes, end, i);
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
        let clone = fragment.cloneNode(true);
        invariant(isDocumentFragmentNode(clone), 'Expected cloned frame template fragment');
        listener(clone);
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
async function renderFrameStream(stream, doc, applyHtml, signal) {
    let reader = stream.getReader();
    let decoder = new TextDecoder();
    let buffer = '';
    let html = '';
    let appliedOnce = false;
    let abort = () => {
        void reader.cancel().catch(() => { });
    };
    if (signal?.aborted) {
        await reader.cancel();
        reader.releaseLock();
        return;
    }
    signal?.addEventListener('abort', abort, { once: true });
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
                let flushed = await consumeFlushBatches(html, applyHtml);
                appliedOnce = flushed.applied || appliedOnce;
                html = flushed.remainder;
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
        if (html !== '') {
            await applyHtml(html, appliedOnce ? 'fragment' : inferFlushKind(html));
            appliedOnce = true;
        }
        // A frame stream can legitimately resolve to empty content. Ensure the
        // existing frame region is cleared instead of treated as a no-op.
        if (html === '' && !appliedOnce) {
            await applyHtml('', 'fragment');
        }
    }
    finally {
        signal?.removeEventListener('abort', abort);
        reader.releaseLock();
    }
}
async function consumeFlushBatches(html, applyHtml) {
    let applied = false;
    let cursor = 0;
    let marker = findFlushMarker(html, cursor);
    while (marker) {
        let batch = html.slice(cursor, marker.index);
        await applyHtml(batch, marker.kind);
        applied = true;
        cursor = marker.endIndex;
        marker = findFlushMarker(html, cursor);
    }
    return { applied, remainder: html.slice(cursor) };
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
        regionStart: start,
        get childNodes() {
            return getChildNodesBetween();
        },
        regionTailRef: end,
        regionParent: parent,
    };
}
function createFragmentFromString(doc, content) {
    let template = doc.createElement('template');
    template.innerHTML = stripDoctypeMarkup(content).trim();
    return template.content;
}
function isRemixNodeFrameContent(content) {
    return !(content instanceof ReadableStream ||
        isDocumentFragmentNode(content) ||
        typeof content === 'string');
}
function findHydrationMarkers(container, data) {
    let markers = [];
    let parent = container.regionStart && frameClientEntryParents.get(container.regionStart);
    visit(container.childNodes, parent);
    return markers.map(({ id, start, end, parent }) => {
        if (!end)
            throw new Error('End marker not found');
        return { id, start, end, parent };
    });
    function visit(nodes, parent) {
        let boundaries = [];
        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            // Nested frames discover their own entries, inheriting this pass's enclosing boundary.
            if (isFrameStart(node)) {
                if (parent)
                    frameClientEntryParents.set(node, parent);
                else
                    frameClientEntryParents.delete(node);
                let end = findEndMarker(node, isFrameStart, isFrameEnd);
                i = findMarkerRangeEndIndex(nodes, end, i);
                continue;
            }
            if (isCommentNode(node)) {
                if (isHydrationStart(node)) {
                    let id = node.data.trim().slice('rmx:h:'.length);
                    let boundary = { id, start: node, parent };
                    markers.push(boundary);
                    boundaries.push(boundary);
                    if (data?.[id] || pendingClientEntryHydrations.has(node))
                        parent = node;
                }
                else if (isHydrationEnd(node)) {
                    let boundary = boundaries.pop();
                    if (boundary) {
                        boundary.end = node;
                        parent = boundary.parent;
                    }
                }
            }
            if (node.childNodes.length > 0) {
                visit(Array.from(node.childNodes), parent);
            }
        }
    }
}
function isHydrationStart(node) {
    return node.data.trim().startsWith('rmx:h:');
}
function isHydrationEnd(node) {
    return node.data.trim() === '/rmx:h';
}
function isFrameStart(node) {
    return isCommentNode(node) && node.data.trim().startsWith('rmx:f:');
}
function isFrameEnd(node) {
    return node.data.trim() === '/rmx:f';
}
function getFrameId(start) {
    let trimmed = start.data.trim();
    invariant(trimmed.startsWith('rmx:f:'), 'Invalid frame start marker');
    return trimmed.slice('rmx:f:'.length);
}
function findMarkerRangeEndIndex(nodes, end, startIndex) {
    // The snapshot may not contain an end marker moved by a DOM update.
    return Math.max(startIndex, nodes.indexOf(end, startIndex));
}
function findEndMarker(start, isStart, isEnd) {
    let node = start.nextSibling;
    let depth = 1;
    while (node) {
        if (isCommentNode(node)) {
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
function isCommentNode(node) {
    return node?.nodeType === Node.COMMENT_NODE;
}
function isDocumentNode(node) {
    return node.nodeType === Node.DOCUMENT_NODE;
}
function isDocumentFragmentNode(value) {
    return (typeof value === 'object' &&
        value !== null &&
        Reflect.get(value, 'nodeType') === Node.DOCUMENT_FRAGMENT_NODE);
}
//# sourceMappingURL=frame.js.map