import { Fragment, createComponent, createFrameHandle, Frame } from '../runtime/component.js';
import { isEntry } from '../runtime/client-entries.js';
import { FRAMEWORK_PROPS as RUNTIME_FRAMEWORK_PROPS, SELF_CLOSING_TAGS, normalizeAttributeName, serializeStyleObject, shouldStringifyBooleanAttribute, } from '../runtime/core/attributes.js';
import { appendFlushMarker, stripFlushMarkers } from '../runtime/stream-protocol.js';
import { REMIX_UI_STYLE_LAYER } from '../style/layers.js';
export function createVNode(type, props, key) {
    return { type, props, key };
}
const TEXTAREA_VALUE_PROPS = new Set(['value', 'defaultValue']);
const INPUT_DEFAULT_PROPS = new Set(['defaultValue', 'defaultChecked']);
const DOCTYPE_PATTERN = /<!doctype(?:\s[^>]*)?>/gi;
function stripDoctypeMarkup(html) {
    return html.replace(DOCTYPE_PATTERN, '');
}
function hasRenderableHtml(html) {
    return stripDoctypeMarkup(html).trim() !== '';
}
function emptyReadableStream() {
    return new ReadableStream({
        start(controller) {
            controller.close();
        },
    });
}
function getStyleLayerName(selector, layer = REMIX_UI_STYLE_LAYER) {
    return `${layer}.${selector}`;
}
const SSR_OMITTED_PROPS = RUNTIME_FRAMEWORK_PROPS;
const ssrSignal = Object.freeze({
    get aborted() {
        return false;
    },
    get reason() {
        return undefined;
    },
    get onabort() {
        return null;
    },
    set onabort(_) { },
    addEventListener(_type, _listener, _options) { },
    removeEventListener(_type, _listener, _options) { },
    dispatchEvent(_event) {
        return true;
    },
    throwIfAborted() { },
});
/**
 * Renders a node tree to a streaming HTML response body.
 *
 * @param node Node tree to render.
 * @param options Stream rendering options.
 * @returns A readable byte stream of HTML.
 */
export function renderToStream(node, options) {
    let encoder = new TextEncoder();
    let onError = options?.onError ?? ((error) => console.error(error));
    let currentFrameSrc = normalizeFrameSrc(options?.frameSrc ?? options?.topFrameSrc);
    let topFrameSrc = normalizeFrameSrc(options?.topFrameSrc ?? currentFrameSrc);
    let rootFrameState = createSsrFrameState(currentFrameSrc, topFrameSrc);
    let renderAbortController = new AbortController();
    let context = {
        insideSvg: false,
        insideHead: false,
        onError,
        resolveFrame: options?.resolveFrame ?? defaultResolveFrame,
        styleCache: new Map(),
        pendingFrames: [],
        hydrationData: new Map(),
        unresolvedHydrationData: new Map(),
        authoredImportMapImports: new Map(),
        authoredImportMapScopes: new Map(),
        frameData: new Map(),
        clientEntryHeadResources: { modulePreloadTags: new Set() },
        blockingFrameTails: [],
        signal: renderAbortController.signal,
        flushKind: 'fragment',
        serverIdScope: crypto.randomUUID().slice(0, 8),
        serverIdCounter: 0,
    };
    function cancel(reason) {
        if (!renderAbortController.signal.aborted) {
            renderAbortController.abort(reason);
        }
    }
    let signal = options?.signal;
    if (signal?.aborted) {
        cancel(signal.reason);
    }
    else {
        signal?.addEventListener('abort', () => cancel(signal.reason), { once: true });
    }
    return new ReadableStream({
        async start(controller) {
            try {
                let root = buildSegment(node, context, rootFrameState);
                await resolveBlocking(root);
                if (closeIfCancelled(controller, context))
                    return;
                await resolveClientEntries(context, options?.resolveClientEntry);
                if (closeIfCancelled(controller, context))
                    return;
                validateClientEntriesForHydration(context);
                let html = serializeSegment(root);
                let finalHtml = finalizeHtml(html, context);
                let bytes = encoder.encode(appendFlushMarker(finalHtml, context.flushKind));
                if (closeIfCancelled(controller, context))
                    return;
                controller.enqueue(bytes);
                // If we have any tails from blocking frame streams, stream them now.
                // These contain nested non-blocking frame templates (or other follow-up chunks)
                // that must come after the initial document chunk.
                let tailPromise = context.blockingFrameTails.length > 0
                    ? streamByteStreams(context.blockingFrameTails, controller, context)
                    : Promise.resolve();
                // If we have pending non-blocking frames, stream them as they resolve
                let pendingPromise = context.pendingFrames.length > 0
                    ? streamPendingFrames(context, controller, encoder)
                    : Promise.resolve();
                await Promise.all([tailPromise, pendingPromise]);
                if (closeIfCancelled(controller, context))
                    return;
                controller.close();
            }
            catch (error) {
                if (isSignalAbortError(context.signal, error)) {
                    closeStream(controller);
                    return;
                }
                onError(error);
                controller.error(error);
            }
        },
        cancel(reason) {
            cancel(reason);
        },
    });
}
function isSignalAbortError(signal, error) {
    return signal.aborted && error === signal.reason;
}
function closeIfCancelled(controller, context) {
    if (!context.signal.aborted)
        return false;
    closeStream(controller);
    return true;
}
function closeStream(controller) {
    try {
        controller.close();
    }
    catch {
        // The consumer may already have cancelled the stream.
    }
}
function defaultResolveFrame() {
    throw new Error('No resolveFrame provided');
}
function normalizeFrameSrc(value) {
    return value == null ? '' : String(value);
}
function createSsrFrameState(frameSrc, topFrameSrc = frameSrc) {
    let topFrame = createFrameHandle({ src: topFrameSrc });
    let frame = frameSrc === topFrameSrc ? topFrame : createFrameHandle({ src: frameSrc });
    return { frame, topFrame };
}
function getResolveFrameContext(frameState) {
    return {
        currentFrameSrc: frameState.frame.src,
        topFrameSrc: frameState.topFrame.src,
    };
}
function randomId(prefix) {
    return prefix + crypto.randomUUID().slice(0, 8);
}
function createServerComponentId(context) {
    context.serverIdCounter++;
    return `s${context.serverIdScope}-${context.serverIdCounter}`;
}
async function splitFirstChunk(stream) {
    let reader = stream.getReader();
    let decoder = new TextDecoder();
    let first;
    while (true) {
        let { value, done } = await reader.read();
        if (done || !value)
            break;
        let text = decoder.decode(value, { stream: true });
        if (hasRenderableHtml(text)) {
            first = value;
            break;
        }
    }
    if (!first) {
        decoder.decode();
        reader.releaseLock();
        return { html: '', tail: emptyReadableStream() };
    }
    let released = false;
    function release() {
        if (released)
            return;
        released = true;
        try {
            reader.releaseLock();
        }
        catch {
            // ignore
        }
    }
    let tail = new ReadableStream({
        async pull(controller) {
            let next = await reader.read();
            if (next.done) {
                controller.close();
                release();
                return;
            }
            controller.enqueue(next.value);
        },
        cancel(reason) {
            release();
            return reader.cancel(reason);
        },
    });
    return { html: stripFlushMarkers(stripDoctypeMarkup(decoder.decode(first))), tail };
}
async function resolveFrameHtml(input) {
    if (typeof input === 'string') {
        let html = stripFlushMarkers(stripDoctypeMarkup(input));
        return { html };
    }
    return splitFirstChunk(input);
}
function isRemixElement(node) {
    return typeof node === 'object' && node !== null && '$rmx' in node;
}
function staticSeg(html) {
    return { kind: 'static', html };
}
function compositeSeg(parts) {
    return { kind: 'composite', parts };
}
function buildSegment(node, context, frameState) {
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
        return staticSeg(escapeTextContent(String(node)));
    }
    if (node === null || node === undefined || typeof node === 'boolean') {
        return staticSeg('');
    }
    if (Array.isArray(node)) {
        return compositeSeg(node.map((child) => buildSegment(child, context, frameState)));
    }
    if (isRemixElement(node)) {
        let type = node.type;
        let props = node.props;
        if (type === Fragment) {
            let children = props.children;
            return children != null ? buildSegment(children, context, frameState) : staticSeg('');
        }
        if (typeof type === 'string') {
            let tag = type;
            if (tag === 'html') {
                context.flushKind = 'document';
                return buildElementSegment(tag, props, context, frameState);
            }
            if (tag === 'head') {
                return buildHeadElementSegment(tag, props, context, frameState);
            }
            return buildElementSegment(tag, props, context, frameState);
        }
        if (isElementFunction(type)) {
            if (type === Frame) {
                return buildFrameSegment(node, context, frameState);
            }
            if (isEntry(type)) {
                return buildEntrySegment(type, props, context, frameState);
            }
            return buildComponentSegment(type, props, context, createServerComponentId(context), frameState);
        }
    }
    return staticSeg('');
}
function buildFrameSegment(node, context, frameState) {
    let props = node.props;
    let frameId = randomId('f');
    // Store frame data in context for aggregation
    context.frameData.set(frameId, {
        status: props.fallback ? 'pending' : 'resolved',
        name: props.name,
        src: props.src,
    });
    let seg = {
        kind: 'frame',
        frameId,
        content: null,
    };
    let resolveFrameContext = getResolveFrameContext(frameState);
    let nonBlocking = !!props.fallback;
    if (nonBlocking) {
        seg.content = buildSegment(props.fallback, context, frameState);
        let framePromise = Promise.resolve(context.resolveFrame(props.src, props.name, resolveFrameContext)).then(async (resolved) => resolveFrameHtml(resolved));
        // The response stream can be cancelled before pending frames are drained.
        // Keep the promise observed so request aborts don't become unhandled.
        framePromise.catch(() => { });
        context.pendingFrames.push({ frameId, promise: framePromise });
    }
    else {
        seg.pending = Promise.resolve(context.resolveFrame(props.src, props.name, resolveFrameContext)).then(async (resolved) => {
            let { html, tail } = await resolveFrameHtml(resolved);
            html = hoistClientEntryResourcesFromFrameHead(html, context.clientEntryHeadResources);
            seg.content = staticSeg(html);
            if (tail) {
                context.blockingFrameTails.push(tail);
            }
        });
    }
    return seg;
}
function buildElementSegment(tag, props, context, frameState) {
    let mixedProps = resolveSsrMixedProps(tag, props, context, frameState);
    let processedProps = processStyleProps(mixedProps);
    // Determine namespace context for the current element and its children
    let currentIsSvg = context.insideSvg || tag === 'svg';
    if (!currentIsSvg && tag === 'textarea') {
        return buildTextareaElementSegment(tag, processedProps);
    }
    let attrs = !currentIsSvg && tag === 'input'
        ? renderInputAttributes(processedProps)
        : renderAttributes(processedProps, currentIsSvg);
    if (SELF_CLOSING_TAGS.has(tag)) {
        return staticSeg(`<${tag}${attrs} />`);
    }
    if (props.innerHTML) {
        return staticSeg(`<${tag}${attrs}>${props.innerHTML}</${tag}>`);
    }
    if (tag === 'script') {
        if (typeof props.children === 'string') {
            if (context.insideHead) {
                collectAuthoredImportMap(context, tag, processedProps, props.children);
            }
            return staticSeg(`<${tag}${attrs}>${escapeScriptTextContent(props.children)}</${tag}>`);
        }
        if (props.children != null) {
            console.error(new Error('script elements with children must have a single string child'));
        }
        return staticSeg(`<${tag}${attrs}></${tag}>`);
    }
    let open = staticSeg(`<${tag}${attrs}>`);
    // Adjust svg context for children: foreignObject switches back to HTML
    let previousInsideSvg = context.insideSvg;
    context.insideSvg = tag === 'foreignObject' ? false : currentIsSvg;
    let children = props.children != null ? buildSegment(props.children, context, frameState) : staticSeg('');
    context.insideSvg = previousInsideSvg;
    let close = staticSeg(`</${tag}>`);
    return compositeSeg([open, children, close]);
}
function buildTextareaElementSegment(tag, props) {
    let attrs = renderAttributes(props, false, TEXTAREA_VALUE_PROPS);
    let value = props.value ?? props.defaultValue ?? '';
    return staticSeg(`<${tag}${attrs}>${escapeTextContent(String(value))}</${tag}>`);
}
function collectAuthoredImportMap(context, tag, props, children) {
    if (tag !== 'script' ||
        typeof props.type !== 'string' ||
        props.type.toLowerCase() !== 'importmap' ||
        (props.src !== undefined && props.src !== null && props.src !== false) ||
        typeof children !== 'string') {
        return;
    }
    let importMap = parseAuthoredImportMap(children);
    if (!importMap)
        return;
    if (importMap.imports) {
        collectAuthoredImportMapEntries(context.authoredImportMapImports, importMap.imports);
    }
    if (importMap.scopes) {
        for (let [scope, imports] of Object.entries(importMap.scopes)) {
            let authoredScope = context.authoredImportMapScopes.get(scope);
            if (!authoredScope) {
                authoredScope = { imports: new Map() };
                context.authoredImportMapScopes.set(scope, authoredScope);
            }
            collectAuthoredImportMapEntries(authoredScope.imports, imports);
        }
    }
}
function collectAuthoredImportMapEntries(target, source) {
    for (let [specifier, address] of Object.entries(source)) {
        if (!target.has(specifier))
            target.set(specifier, address);
    }
}
function renderInputAttributes(props) {
    let value = props.value === undefined && props.defaultValue !== undefined ? props.defaultValue : props.value;
    let checked = props.checked === undefined && props.defaultChecked !== undefined
        ? props.defaultChecked
        : props.checked;
    let inputProps = {
        ...props,
        ...(value === undefined ? {} : { value }),
        ...(checked === undefined ? {} : { checked }),
    };
    return renderAttributes(inputProps, false, INPUT_DEFAULT_PROPS);
}
function buildHeadElementSegment(tag, props, context, frameState) {
    let processedProps = processStyleProps(props);
    let attrs = renderAttributes(processedProps, false);
    let open = staticSeg(`<${tag}${attrs}>`);
    let previousInsideHead = context.insideHead;
    context.insideHead = true;
    let children = props.children != null ? buildSegment(props.children, context, frameState) : staticSeg('');
    context.insideHead = previousInsideHead;
    let close = staticSeg(`</${tag}>`);
    return compositeSeg([open, children, close]);
}
function renderAttributes(props, isSvg, excludedProps) {
    let attrs = '';
    for (let key in props) {
        if (SSR_OMITTED_PROPS.has(key))
            continue;
        if (excludedProps?.has(key))
            continue;
        let value = props[key];
        let attrName = transformAttributeName(key, isSvg);
        let shouldStringifyBoolean = shouldStringifyBooleanAttribute(attrName);
        if (value === undefined || value === null || (value === false && !shouldStringifyBoolean)) {
            continue;
        }
        if (typeof value === 'boolean' && shouldStringifyBoolean) {
            attrs += ` ${attrName}="${escapeHtml(String(value))}"`;
        }
        else if (value === true) {
            attrs += ` ${attrName}`;
        }
        else {
            attrs += ` ${attrName}="${escapeHtml(String(value))}"`;
        }
    }
    return attrs;
}
function resolveSsrMixedProps(hostType, initialProps, context, frameState) {
    let descriptors = resolveSsrMixDescriptors(initialProps);
    if (descriptors.length === 0)
        return initialProps;
    let composedProps = withoutSsrMix(initialProps);
    let mixinProps = withoutSsrMixinTreeProps(composedProps);
    let maxDescriptors = 1024;
    for (let index = 0; index < descriptors.length && index < maxDescriptors; index++) {
        let descriptor = descriptors[index];
        let runner = resolveSsrMixinRunner(hostType, descriptor, context, frameState);
        if (!runner)
            continue;
        let result;
        try {
            result = runner(...descriptor.args, mixinProps);
        }
        catch (error) {
            console.error(error);
            continue;
        }
        if (!result)
            continue;
        if (isSsrMixinElement(result))
            continue;
        let returnedDescriptors = resolveReturnedSsrMixDescriptors(result);
        if (returnedDescriptors) {
            for (let returned of returnedDescriptors)
                descriptors.push(returned);
            continue;
        }
        if (!isRemixElement(result)) {
            console.error(new Error('mixins must return a remix element'));
            continue;
        }
        let remixResult = result;
        let resultType = typeof remixResult.type === 'string'
            ? remixResult.type
            : isSsrMixinElement(remixResult.type)
                ? remixResult.type.__rmxMixinElementType
                : null;
        if (resultType !== hostType) {
            console.error(new Error('mixins must return an element with the same host type'));
            continue;
        }
        if (remixResult.type !== resultType) {
            remixResult = { ...remixResult, type: resultType };
        }
        let nextProps = sanitizeReturnedSsrMixinProps(remixResult.props);
        let nestedDescriptors = resolveSsrMixDescriptors(nextProps);
        for (let nested of nestedDescriptors)
            descriptors.push(nested);
        composedProps = { ...composedProps, ...withoutSsrMix(nextProps) };
        mixinProps = withoutSsrMixinTreeProps(composedProps);
    }
    let nextMix = initialProps.mix;
    return {
        ...composedProps,
        ...(nextMix === undefined ? {} : { mix: nextMix }),
    };
}
function resolveSsrMixinRunner(hostType, descriptor, context, frameState) {
    if (typeof descriptor.type !== 'function')
        return null;
    try {
        let handle = createSsrMixinHandle(hostType, descriptor, context, frameState);
        let runner = descriptor.type(handle, hostType);
        if (typeof runner !== 'function')
            return null;
        return runner;
    }
    catch (error) {
        console.error(error);
        return null;
    }
}
function createSsrMixinHandle(hostType, _descriptor, context, frameState) {
    let element = ((handle) => () => ({
        $rmx: true,
        type: hostType,
        key: null,
        props: handle.props,
    }));
    element.__rmxMixinElementType = hostType;
    return {
        id: 'ssr-mixin',
        context: {
            get(providerType) {
                if (typeof providerType !== 'function') {
                    return undefined;
                }
                let current = context.parentVNode;
                while (current) {
                    if (current.type === providerType) {
                        let providerHandle = current._handle;
                        if (providerHandle) {
                            return providerHandle.getContextValue();
                        }
                    }
                    current = current._parent;
                }
                return undefined;
            },
        },
        frame: createFrameHandle({
            src: frameState.frame.src,
            $runtime: {
                styleCache: context.styleCache,
            },
        }),
        element,
        signal: ssrSignal,
        update: () => {
            throw new Error('handle.update() is not available during SSR.');
        },
        queueTask: () => { },
        on: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => true,
    };
}
function resolveSsrMixDescriptors(props) {
    let mix = props.mix;
    if (!mix)
        return [];
    if (Array.isArray(mix)) {
        if (mix.length === 0)
            return [];
        return mix.filter(Boolean);
    }
    return [mix];
}
function withoutSsrMix(props) {
    if (!('mix' in props))
        return props;
    let output = { ...props };
    delete output.mix;
    return output;
}
function withoutSsrMixinTreeProps(props) {
    if (!('children' in props) && !('innerHTML' in props))
        return props;
    let output = { ...props };
    delete output.children;
    delete output.innerHTML;
    return output;
}
function sanitizeReturnedSsrMixinProps(props) {
    if (!('children' in props) && !('innerHTML' in props))
        return props;
    console.error(new Error('mixins must not return children or innerHTML'));
    return withoutSsrMixinTreeProps(props);
}
function resolveReturnedSsrMixDescriptors(value) {
    let descriptors = [];
    if (!collectReturnedSsrMixDescriptors(value, descriptors)) {
        return null;
    }
    return descriptors;
}
function collectReturnedSsrMixDescriptors(value, output) {
    if (!value) {
        return true;
    }
    if (Array.isArray(value)) {
        for (let item of value) {
            if (!collectReturnedSsrMixDescriptors(item, output)) {
                return false;
            }
        }
        return true;
    }
    if (!isSsrMixinDescriptor(value)) {
        return false;
    }
    output.push(value);
    return true;
}
function isSsrMixinElement(value) {
    if (typeof value !== 'function')
        return false;
    return '__rmxMixinElementType' in value;
}
function isElementFunction(value) {
    return typeof value === 'function';
}
function isSsrMixinDescriptor(value) {
    if (!value || typeof value !== 'object' || isRemixElement(value)) {
        return false;
    }
    let descriptor = value;
    return typeof descriptor.type === 'function' && Array.isArray(descriptor.args);
}
function buildComponentSegment(type, props, context, componentId, frameState) {
    let vnode = createVNode(type, props);
    if (context.parentVNode) {
        vnode._parent = context.parentVNode;
    }
    let handle = createComponent({
        id: componentId,
        type: type,
        frame: frameState.frame,
        signal: ssrSignal,
        getContext(providerType) {
            let current = vnode._parent;
            while (current) {
                if (current.type === providerType) {
                    let providerHandle = current._handle;
                    // TODO: need better vnode types to avoid defensive checks
                    if (providerHandle) {
                        return providerHandle.getContextValue();
                    }
                }
                current = current._parent;
            }
            return undefined;
        },
        getFrameByName() {
            return undefined;
        },
        getTopFrame() {
            return frameState.topFrame;
        },
    });
    vnode._handle = handle;
    let [renderedNode] = handle.render(props);
    let childContext = { ...context, parentVNode: vnode };
    let rendered = buildSegment(renderedNode, childContext, frameState);
    if (childContext.flushKind === 'document') {
        context.flushKind = 'document';
    }
    return rendered;
}
function createHydrationPropsReplacer(context, frameState) {
    function unwrapNode(node) {
        if (node === null || node === undefined || typeof node === 'boolean')
            return node;
        if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
            return node;
        }
        if (Array.isArray(node)) {
            return node.map((child) => unwrapNode(child));
        }
        if (isRemixElement(node)) {
            return unwrapElement(node);
        }
        return node;
    }
    function unwrapElement(element) {
        let type = element.type;
        let props = element.props;
        // Preserve Frame semantics through serialized props by emitting
        // a dedicated descriptor that can be revived on the client.
        if (type === Frame) {
            return {
                $rmxFrame: true,
                props: transformProps(props),
                key: element.key,
            };
        }
        // If it's a DOM tag, return a serializable shape with transformed props
        if (typeof type === 'string') {
            return { $rmx: true, type, props: transformProps(props) };
        }
        // Component function: render synchronously, then unwrap its result
        if (isElementFunction(type)) {
            let vnode = createVNode(type, props);
            if (context.parentVNode) {
                vnode._parent = context.parentVNode;
            }
            let handle = createComponent({
                id: 'SERIALIZED',
                type: type,
                frame: frameState.frame,
                signal: ssrSignal,
                getContext(providerType) {
                    let current = vnode._parent;
                    while (current) {
                        if (current.type === providerType) {
                            let providerHandle = current._handle;
                            if (providerHandle) {
                                return providerHandle.getContextValue();
                            }
                        }
                        current = current._parent;
                    }
                    return undefined;
                },
                getFrameByName() {
                    return undefined;
                },
                getTopFrame() {
                    return frameState.topFrame;
                },
            });
            vnode._handle = handle;
            let [renderedNode] = handle.render(props);
            return unwrapNode(renderedNode);
        }
        return null;
    }
    function transformProps(input) {
        let out = {};
        for (let key in input) {
            let value = input[key];
            if (key === 'children') {
                out[key] = unwrapNode(value);
            }
            else {
                if (isRemixElement(value)) {
                    out[key] = unwrapNode(value);
                }
                else if (Array.isArray(value)) {
                    out[key] = value.map((v) => unwrapNode(v));
                }
                else {
                    out[key] = value;
                }
            }
        }
        return out;
    }
    return function replacer(_key, value) {
        if (isRemixElement(value)) {
            return unwrapElement(value);
        }
        if (Array.isArray(value)) {
            return value.map((v) => unwrapNode(v));
        }
        return value;
    };
}
function buildEntrySegment(type, props, context, frameState) {
    let instanceId = randomId('h');
    let rendered = buildComponentSegment(type, props, context, instanceId, frameState);
    // Store hydration data in context for aggregation
    let replacer = createHydrationPropsReplacer(context, frameState);
    context.unresolvedHydrationData.set(instanceId, {
        entryId: type.$entryId,
        component: type,
        props: JSON.parse(JSON.stringify(props, replacer)),
    });
    let start = staticSeg(`<!-- rmx:h:${instanceId} -->`);
    let end = staticSeg('<!-- /rmx:h -->');
    return compositeSeg([start, rendered, end]);
}
function resolveDefaultClientEntry(entryId, component) {
    let fallbackExportName = component.name || '';
    let hashIndex = entryId.lastIndexOf('#');
    if (hashIndex === -1 && fallbackExportName) {
        return {
            exportName: fallbackExportName,
            href: entryId,
        };
    }
    if (hashIndex !== -1) {
        let exportName = entryId.slice(hashIndex + 1) || fallbackExportName;
        if (exportName) {
            return {
                exportName,
                href: entryId.slice(0, hashIndex),
            };
        }
    }
    throw new Error(`clientEntry() requires either an export name in the entry ID (e.g., "/js/module.js#ComponentName"), a named component function, or a resolveClientEntry hook that resolves one. Received "${entryId}".`);
}
async function resolveClientEntries(context, resolveClientEntry) {
    if (context.unresolvedHydrationData.size === 0)
        return;
    let resolvedEntries = new Map();
    for (let [hydrationId, unresolvedHydrationData] of context.unresolvedHydrationData) {
        let { entryId, component, props } = unresolvedHydrationData;
        let resolvedEntry = resolvedEntries.get(component);
        if (!resolvedEntry) {
            resolvedEntry = resolveClientEntry
                ? await Promise.resolve(resolveClientEntry(entryId, component))
                : resolveDefaultClientEntry(entryId, component);
            validateResolvedClientEntry(entryId, resolvedEntry);
            resolvedEntries.set(component, resolvedEntry);
            collectResolvedClientEntryResources(context.clientEntryHeadResources, resolvedEntry);
        }
        context.hydrationData.set(hydrationId, {
            exportName: resolvedEntry.exportName,
            moduleUrl: resolvedEntry.href,
            props,
        });
    }
    context.unresolvedHydrationData.clear();
}
function collectResolvedClientEntryResources(resources, resolvedEntry) {
    for (let preload of resolvedEntry.preloads ?? []) {
        resources.modulePreloadTags.add(createModulePreloadTag(preload));
    }
    if (resolvedEntry.importMap) {
        mergeImportMap(resources, resolvedEntry.importMap);
    }
}
function validateResolvedClientEntry(entryId, resolvedEntry) {
    if (!resolvedEntry || typeof resolvedEntry !== 'object') {
        throw new Error(`resolveClientEntry must return an object with href and exportName. Received "${entryId}".`);
    }
    if (!resolvedEntry.href) {
        throw new Error(`resolveClientEntry must return a non-empty href. Received "${entryId}".`);
    }
    if (!resolvedEntry.exportName) {
        throw new Error(`resolveClientEntry must return a non-empty exportName. Received "${entryId}".`);
    }
    if (resolvedEntry.preloads !== undefined) {
        if (!Array.isArray(resolvedEntry.preloads)) {
            throw new Error(`resolveClientEntry preloads must be an array. Received "${entryId}".`);
        }
        for (let preload of resolvedEntry.preloads) {
            if (typeof preload !== 'string' || preload.length === 0) {
                throw new Error(`resolveClientEntry preloads must contain non-empty strings. Received "${entryId}".`);
            }
        }
    }
    if (resolvedEntry.importMap !== undefined && !isImportMap(resolvedEntry.importMap)) {
        throw new Error(`resolveClientEntry importMap must be a valid import map. Received "${entryId}".`);
    }
}
function validateClientEntriesForHydration(context) {
    if (context.unresolvedHydrationData.size > 0) {
        let [hydrationId, unresolvedHydrationData] = context.unresolvedHydrationData.entries().next()
            .value;
        throw new Error(`Client entry was not resolved for hydration. Received "${unresolvedHydrationData.entryId}" (${hydrationId}).`);
    }
}
// Resolve all blocking frame content once
async function resolveBlocking(segment) {
    if (segment.kind === 'frame') {
        if (segment.pending) {
            await segment.pending;
            segment.pending = undefined;
        }
        if (segment.content)
            await resolveBlocking(segment.content);
        return;
    }
    if (segment.kind === 'composite') {
        for (let part of segment.parts) {
            await resolveBlocking(part);
        }
    }
}
// Serialize the segment tree to HTML
function serializeSegment(seg) {
    if (seg.kind === 'static')
        return seg.html;
    if (seg.kind === 'composite')
        return seg.parts.map(serializeSegment).join('');
    // frame
    let inner = seg.content ? serializeSegment(seg.content) : '';
    let start = `<!-- rmx:f:${seg.frameId} -->`;
    let end = `<!-- /rmx:f -->`;
    return start + inner + end;
}
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeTextContent(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeTemplateContent(html) {
    return html.replace(/<\/template/gi, '<\\/template');
}
const SCRIPT_TAG_PATTERN = /(<\/|<)(s)(cript)/gi;
function escapeScriptTextContent(value) {
    return value.replace(SCRIPT_TAG_PATTERN, (_match, prefix, firstLetter, suffix) => `${prefix}${firstLetter === 's' ? '\\u0073' : '\\u0053'}${suffix}`);
}
function transformAttributeName(name, isSvg) {
    return normalizeAttributeName(name, isSvg).attr;
}
function finalizeHtml(html, context) {
    let hasHtmlRoot = context.flushKind === 'document';
    let preloads = collectModulePreloadTags(context.clientEntryHeadResources);
    let styles = collectStyleTags(context);
    let importMapScript = collectImportMapScript(context, context.clientEntryHeadResources);
    let headContent = importMapScript + preloads + styles;
    if (hasHtmlRoot && headContent) {
        let headCloseIndex = html.indexOf('</head>');
        if (headCloseIndex !== -1) {
            html = html.slice(0, headCloseIndex) + headContent + html.slice(headCloseIndex);
        }
        else {
            let htmlOpenMatch = html.match(/<html[^>]*>/);
            if (htmlOpenMatch) {
                let insertIndex = htmlOpenMatch.index + htmlOpenMatch[0].length;
                html = html.slice(0, insertIndex) + `<head>${headContent}</head>` + html.slice(insertIndex);
            }
            else {
                html = headContent + html;
            }
        }
    }
    if (!hasHtmlRoot && headContent) {
        html = `<head>${headContent}</head>${html}`;
    }
    // Append aggregated hydration/frame data script at the end
    let rmxData = buildRmxDataScript(context);
    if (rmxData) {
        if (hasHtmlRoot) {
            // Insert before </body> if present, otherwise before </html>
            let bodyCloseIndex = html.indexOf('</body>');
            if (bodyCloseIndex !== -1) {
                html = html.slice(0, bodyCloseIndex) + rmxData + html.slice(bodyCloseIndex);
            }
            else {
                let htmlCloseIndex = html.indexOf('</html>');
                if (htmlCloseIndex !== -1) {
                    html = html.slice(0, htmlCloseIndex) + rmxData + html.slice(htmlCloseIndex);
                }
                else {
                    html += rmxData;
                }
            }
        }
        else {
            html += rmxData;
        }
    }
    return html;
}
const FRAME_HEAD_OPEN_TAG = '<head>';
const FRAME_HEAD_CLOSE_TAG = '</head>';
const MARKED_MODULE_PRELOAD_START = '<link data-rmx-module-preload rel="modulepreload" href="';
const MODULE_PRELOAD_END = '" />';
const MANAGED_IMPORT_MAP_START = '<script data-rmx-import-map type="importmap">';
const IMPORT_MAP_SCRIPT_END = '</script>';
function createModulePreloadTag(href) {
    return `${MARKED_MODULE_PRELOAD_START}${escapeHtml(href)}${MODULE_PRELOAD_END}`;
}
function collectModulePreloadTags(resources) {
    return Array.from(resources.modulePreloadTags).join('');
}
function hoistClientEntryResourcesFromFrameHead(html, resources) {
    if (!html.startsWith(FRAME_HEAD_OPEN_TAG))
        return html;
    let headClose = html.indexOf(FRAME_HEAD_CLOSE_TAG, FRAME_HEAD_OPEN_TAG.length);
    if (headClose === -1)
        return html;
    let preloadTags = [];
    let importMaps = [];
    let cursor = FRAME_HEAD_OPEN_TAG.length;
    if (html.startsWith(MANAGED_IMPORT_MAP_START, cursor)) {
        let contentStart = cursor + MANAGED_IMPORT_MAP_START.length;
        let scriptEnd = html.indexOf(IMPORT_MAP_SCRIPT_END, contentStart);
        if (scriptEnd === -1 || scriptEnd >= headClose)
            return html;
        importMaps.push(parseFrameworkImportMap(html.slice(contentStart, scriptEnd)));
        cursor = scriptEnd + IMPORT_MAP_SCRIPT_END.length;
    }
    while (html.startsWith(MARKED_MODULE_PRELOAD_START, cursor)) {
        let tagEnd = html.indexOf(MODULE_PRELOAD_END, cursor + MARKED_MODULE_PRELOAD_START.length);
        if (tagEnd === -1 || tagEnd >= headClose)
            return html;
        tagEnd += MODULE_PRELOAD_END.length;
        preloadTags.push(html.slice(cursor, tagEnd));
        cursor = tagEnd;
    }
    if (preloadTags.length === 0 && importMaps.length === 0)
        return html;
    for (let tag of preloadTags) {
        resources.modulePreloadTags.add(tag);
    }
    for (let importMap of importMaps) {
        mergeImportMap(resources, importMap);
    }
    let remainingHeadHtml = html.slice(cursor, headClose);
    let contentAfterHead = html.slice(headClose + FRAME_HEAD_CLOSE_TAG.length);
    if (!remainingHeadHtml)
        return contentAfterHead;
    return `${FRAME_HEAD_OPEN_TAG}${remainingHeadHtml}${FRAME_HEAD_CLOSE_TAG}${contentAfterHead}`;
}
function processStyleProps(props) {
    let processedProps = { ...props };
    let classAttr = typeof props.class === 'string' ? props.class : '';
    let className = typeof props.className === 'string' ? props.className : '';
    let mergedClassName = [classAttr, className].filter(Boolean).join(' ');
    if (mergedClassName) {
        processedProps.className = mergedClassName;
        delete processedProps.class;
    }
    if (typeof props.style === 'object') {
        processedProps.style = serializeStyleObject(props.style);
    }
    return processedProps;
}
function collectStyleTags(context) {
    if (context.styleCache.size === 0)
        return '';
    let tags = [];
    for (let { selector, css } of context.styleCache.values()) {
        let tag = renderStyleTag(selector, css);
        if (tag)
            tags.push(tag);
    }
    return tags.join('');
}
function wrapStyleForLayer(selector, css, layer = REMIX_UI_STYLE_LAYER) {
    let trimmed = css.trim();
    if (!trimmed)
        return '';
    return `@layer ${getStyleLayerName(selector, layer)} { ${trimmed} }`;
}
function renderStyleTag(selector, css, layer = REMIX_UI_STYLE_LAYER) {
    let wrappedCss = wrapStyleForLayer(selector, css, layer);
    if (!wrappedCss)
        return '';
    return `<style data-rmx-style="${escapeHtml(selector)}">${escapeStyleText(wrappedCss)}</style>`;
}
function escapeStyleText(css) {
    // A literal "</style" closes an HTML style element even when it appears inside a CSS string.
    return css.replace(/</g, '\\3C ');
}
function buildRmxDataScript(context) {
    if (context.hydrationData.size === 0 && context.frameData.size === 0) {
        return '';
    }
    let data = {};
    if (context.hydrationData.size > 0) {
        data.h = Object.fromEntries(context.hydrationData);
    }
    if (context.frameData.size > 0) {
        data.f = Object.fromEntries(context.frameData);
    }
    let serializedData = escapeScriptJson(JSON.stringify(data));
    return `<script type="application/json" id="rmx-data">${serializedData}</script>`;
}
function buildImportMapScript(importMap) {
    let serializedData = escapeScriptJson(JSON.stringify(importMap));
    return `<script data-rmx-import-map type="importmap">${serializedData}</script>`;
}
function collectImportMapScript(context, resources) {
    let importMap = getImportMapDelta(context, resources.importMap);
    return importMap ? buildImportMapScript(importMap) : '';
}
function getImportMapDelta(context, importMap) {
    if (!importMap)
        return null;
    let imports = importMap.imports
        ? getImportMapImportsDelta(context.authoredImportMapImports, importMap.imports)
        : undefined;
    let scopes = {};
    for (let [scope, scopedImports] of Object.entries(importMap.scopes ?? {})) {
        let authoredImports = context.authoredImportMapScopes.get(scope)?.imports ?? new Map();
        let importsDelta = getImportMapImportsDelta(authoredImports, scopedImports, scope);
        if (importsDelta)
            scopes[scope] = importsDelta;
    }
    if (!imports && Object.keys(scopes).length === 0)
        return null;
    return {
        ...(imports ? { imports } : null),
        ...(Object.keys(scopes).length > 0 ? { scopes } : null),
    };
}
function getImportMapImportsDelta(authoredImports, discoveredImports, scope) {
    let delta = {};
    for (let [specifier, address] of Object.entries(discoveredImports)) {
        if (!authoredImports.has(specifier)) {
            delta[specifier] = address;
            continue;
        }
        let authoredAddress = authoredImports.get(specifier);
        if (authoredAddress === address)
            continue;
        let scopeDescription = scope ? ` in scope "${scope}"` : '';
        console.warn(`[remix] Ignoring conflicting import map entry for "${specifier}"${scopeDescription}: ` +
            `${formatImportMapAddress(authoredAddress)} is already authored, but the discovered map points to ${formatImportMapAddress(address)}`);
    }
    return Object.keys(delta).length > 0 ? delta : undefined;
}
function parseAuthoredImportMap(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch {
        return null;
    }
    if (!isObjectRecord(value))
        return null;
    let importMap = {};
    if (value.imports !== undefined) {
        if (!isObjectRecord(value.imports))
            return null;
        importMap.imports = parseAuthoredImportMapImports(value.imports);
    }
    if (value.scopes !== undefined) {
        if (!isObjectRecord(value.scopes))
            return null;
        let scopes = [];
        for (let [scope, imports] of Object.entries(value.scopes)) {
            if (!isObjectRecord(imports))
                continue;
            scopes.push([scope, parseAuthoredImportMapImports(imports)]);
        }
        importMap.scopes = Object.fromEntries(scopes);
    }
    return importMap;
}
function parseAuthoredImportMapImports(value) {
    return Object.fromEntries(Object.entries(value).map(([specifier, address]) => [
        specifier,
        address === null || typeof address === 'string' ? address : null,
    ]));
}
function parseFrameworkImportMap(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch {
        throw new Error('Invalid framework-owned import map in frame head');
    }
    if (!isImportMap(value)) {
        throw new Error('Invalid framework-owned import map in frame head');
    }
    return value;
}
function isImportMap(value) {
    if (!isObjectRecord(value))
        return false;
    if (value.imports !== undefined && !isImportMapImports(value.imports))
        return false;
    if (value.scopes !== undefined) {
        if (!isObjectRecord(value.scopes))
            return false;
        for (let imports of Object.values(value.scopes)) {
            if (!isImportMapImports(imports))
                return false;
        }
    }
    return true;
}
function isImportMapImports(value) {
    if (!isObjectRecord(value))
        return false;
    return Object.values(value).every((address) => address === null || typeof address === 'string');
}
function isObjectRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function mergeImportMap(resources, source) {
    let target = (resources.importMap ??= {});
    if (source.imports) {
        target.imports ??= {};
        mergeImportMapImports(target.imports, source.imports);
    }
    if (source.scopes) {
        target.scopes ??= {};
        for (let [scope, imports] of Object.entries(source.scopes)) {
            let targetImports = (target.scopes[scope] ??= {});
            mergeImportMapImports(targetImports, imports, scope);
        }
    }
}
function mergeImportMapImports(target, source, scope) {
    for (let [specifier, address] of Object.entries(source)) {
        if (!Object.hasOwn(target, specifier)) {
            target[specifier] = address;
            continue;
        }
        if (target[specifier] !== address) {
            let scopeDescription = scope ? ` in scope "${scope}"` : '';
            throw new Error(`Conflicting framework import map entry for "${specifier}"${scopeDescription}`);
        }
    }
}
function escapeScriptJson(json) {
    // Avoid prematurely closing the script tag when serialized data contains "</script>".
    return json.replace(/</g, '\\u003c');
}
function formatImportMapAddress(address) {
    return address === null ? 'null' : `"${address}"`;
}
// Frame styles work end-to-end when frame handlers use their own `renderToStream`:
// the handler's `finalizeHtml` emits selector-addressed `<style>` tags in its HTML, and on the client,
// the `adoptServerStyleTag` MutationObserver (stylesheet.ts) picks it up anywhere in the
// document and adopts the CSS into an adopted stylesheet.
//
// Style tags are intentionally NOT deduped across frame boundaries: each frame
// owns its style rules independently on the client (per-frame refcounted
// adoption), so every frame's HTML must carry the full set of style tags its
// content references — even when a sibling frame or the enclosing document
// already emitted the same selector.
async function streamPendingFrames(context, controller, encoder) {
    let processedFrames = new Set();
    while (true) {
        if (context.signal.aborted)
            break;
        let batch = context.pendingFrames.filter(({ frameId }) => !processedFrames.has(frameId));
        if (batch.length === 0)
            break;
        await Promise.all(batch.map(async ({ frameId, promise }) => {
            if (context.signal.aborted)
                return;
            processedFrames.add(frameId);
            try {
                let { html, tail } = await promise;
                if (context.signal.aborted)
                    return;
                // Stream as a template element (first chunk only)
                let templateHtml = `<template id="${frameId}">${escapeTemplateContent(html)}</template>`;
                if (context.signal.aborted)
                    return;
                controller.enqueue(encoder.encode(templateHtml));
                // Forward any additional chunks from a stream-valued resolveFrame result.
                if (tail) {
                    await streamByteStreams([tail], controller, context);
                }
            }
            catch (error) {
                if (!isSignalAbortError(context.signal, error)) {
                    context.onError(error);
                }
            }
        }));
    }
}
async function streamByteStreams(streams, controller, context) {
    await Promise.all(streams.map(async (stream) => {
        let reader = stream.getReader();
        try {
            while (true) {
                if (context.signal.aborted)
                    break;
                let { done, value } = await reader.read();
                if (done)
                    break;
                if (context.signal.aborted)
                    break;
                controller.enqueue(value);
            }
        }
        catch (error) {
            if (!isSignalAbortError(context.signal, error)) {
                context.onError(error);
            }
        }
        finally {
            reader.releaseLock();
        }
    }));
}
async function drain(stream) {
    let reader = stream.getReader();
    let decoder = new TextDecoder();
    let html = '';
    while (true) {
        let { done, value } = await reader.read();
        if (done)
            break;
        html += decoder.decode(value);
    }
    return html;
}
/**
 * Renders a node tree to a complete HTML string.
 *
 * @param node Node tree to render.
 * @returns Rendered HTML.
 */
export async function renderToString(node) {
    return stripFlushMarkers(await drain(renderToStream(node, {
        onError(error) {
            throw error;
        },
    })));
}
//# sourceMappingURL=stream.js.map