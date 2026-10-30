import { Fragment, createComponent, createFrameHandle, Frame } from '../runtime/component.js';
import { isEntry } from '../runtime/client-entries.js';
import { FRAMEWORK_PROPS as RUNTIME_FRAMEWORK_PROPS, SELF_CLOSING_TAGS, isAllowedHostPropName, normalizeAttributeName, sanitizeUrlAttribute, serializeStyleObject, shouldStringifyBooleanAttribute, } from '../runtime/core/attributes.js';
import { appendFlushMarker, DOCUMENT_NONCE_META_NAME, FRAME_TEMPLATE_END_MARKER, stripFlushMarkers, } from '../runtime/stream-protocol.js';
import { composeMixedProps, isBrowserOnlyMixinDescriptor } from '../runtime/core/mix.js';
import { REMIX_UI_STYLE_LAYER } from '../style/layers.js';
import { invariant } from '../runtime/invariant.js';
import { normalizeUnsafeHTMLProps } from '../runtime/unsafe-html.js';
/**
 * Creates a server renderer node record from an element type and props.
 *
 * Application components normally use JSX or `createElement` from `remix/component` instead.
 *
 * @param type Host tag, component, or fragment to render.
 * @param props Props passed to the element.
 * @param key Optional reconciliation key.
 * @returns A node record used by the server renderer.
 */
export function createVNode(type, props, key) {
    return { type, props, key };
}
/**
 * Renders the document import map and merges maps from server-resolved client entries.
 *
 * @param handle Server component handle containing the initial import map and script attributes.
 * @returns This component is handled directly by the server renderer.
 */
export function ImportMap(handle) {
    void handle;
    return () => null;
}
const MAX_BUFFERED_HTML_LENGTH = 64 * 1024;
// UTF-8 needs at most three bytes per UTF-16 code unit.
const htmlEncodingBuffer = new Uint8Array(MAX_BUFFERED_HTML_LENGTH * 3);
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
        blockingFrames: [],
        hydrationData: new Map(),
        unresolvedHydrationData: new Map(),
        authoredImportMapImports: new Map(),
        authoredImportMapScopes: new Map(),
        authoredImportMapIntegrity: new Map(),
        managedImportMaps: [],
        frameData: new Map(),
        clientEntryHeadResources: { modulePreloadTags: new Set() },
        blockingFrameTails: [],
        signal: renderAbortController.signal,
        flushKind: 'fragment',
        serverIdScope: crypto.randomUUID().slice(0, 8),
        serverIdCounter: 0,
        nonce: options?.nonce,
    };
    function cancel(reason) {
        signal?.removeEventListener('abort', onAbort);
        if (!renderAbortController.signal.aborted) {
            renderAbortController.abort(reason);
        }
    }
    let signal = options?.signal;
    function onAbort() {
        cancel(signal?.reason);
    }
    if (signal?.aborted) {
        cancel(signal.reason);
    }
    else {
        signal?.addEventListener('abort', onAbort, { once: true });
    }
    return new ReadableStream({
        async start(controller) {
            try {
                let root = buildSegment(node, context, rootFrameState);
                // Await in document order so the first rejecting frame determines the error.
                for (let frame of context.blockingFrames)
                    await frame;
                if (closeIfCancelled(controller, context))
                    return;
                await resolveClientEntries(context, options?.resolveClientEntry);
                if (closeIfCancelled(controller, context))
                    return;
                validateClientEntriesForHydration(context);
                finalizeManagedImportMap(context);
                let html = serializeSegment(root);
                let finalHtml = finalizeHtml(html, context);
                let bytes = encodeHtml(appendFlushMarker(finalHtml, context.flushKind), encoder);
                if (closeIfCancelled(controller, context))
                    return;
                controller.enqueue(bytes);
                if (context.blockingFrameTails.length > 0) {
                    let tails = streamByteStreams(context.blockingFrameTails, controller, context);
                    if (context.pendingFrames.length > 0) {
                        await Promise.all([tails, streamPendingFrames(context, controller, encoder)]);
                    }
                    else {
                        await tails;
                    }
                }
                else if (context.pendingFrames.length > 0) {
                    await streamPendingFrames(context, controller, encoder);
                }
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
            finally {
                signal?.removeEventListener('abort', onAbort);
            }
        },
        cancel(reason) {
            cancel(reason);
        },
    });
}
function encodeHtml(html, encoder) {
    if (html.length > MAX_BUFFERED_HTML_LENGTH)
        return encoder.encode(html);
    // Encoding is synchronous. Copy the written bytes so streams never share the scratch buffer.
    let { written } = encoder.encodeInto(html, htmlEncodingBuffer);
    return htmlEncodingBuffer.slice(0, written);
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
function getResolveFrameContext(frameState, nonce) {
    return {
        currentFrameSrc: frameState.frame.src,
        topFrameSrc: frameState.topFrame.src,
        nonce,
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
function buildSegment(node, context, frameState, output = []) {
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
        output.push(escapeTextContent(String(node)));
        return output;
    }
    if (node === null || node === undefined || typeof node === 'boolean') {
        return output;
    }
    if (Array.isArray(node)) {
        for (let child of node)
            buildSegment(child, context, frameState, output);
        return output;
    }
    if (isRemixElement(node)) {
        let type = node.type;
        let props = node.props;
        if (type === Fragment) {
            let children = props.children;
            if (children != null)
                buildSegment(children, context, frameState, output);
            return output;
        }
        if (typeof type === 'string') {
            let tag = type;
            if (tag === 'html') {
                context.flushKind = 'document';
            }
            if (tag === 'head') {
                buildHeadElementSegment(tag, props, context, frameState, output);
            }
            else {
                buildElementSegment(tag, props, context, frameState, output);
            }
            return output;
        }
        if (isElementFunction(type)) {
            if (type === ImportMap) {
                output.push(buildImportMapSegment(props, context));
            }
            else if (type === Frame) {
                output.push(buildFrameSegment(node, context, frameState));
            }
            else if (isEntry(type)) {
                buildEntrySegment(type, props, context, frameState, output);
            }
            else {
                buildComponentSegment(type, props, context, createServerComponentId(context), frameState, output);
            }
        }
    }
    return output;
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
    let resolveFrameContext = getResolveFrameContext(frameState, context.nonce);
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
        let framePromise = Promise.resolve(context.resolveFrame(props.src, props.name, resolveFrameContext)).then(async (resolved) => {
            let { html, tail } = await resolveFrameHtml(resolved);
            html = hoistClientEntryResourcesFromFrameHead(html, context.clientEntryHeadResources);
            seg.content = html;
            if (tail) {
                context.blockingFrameTails.push(tail);
            }
        });
        // An earlier blocking frame may reject before this promise is awaited.
        framePromise.catch(() => { });
        context.blockingFrames.push(framePromise);
    }
    return seg;
}
function buildElementSegment(tag, props, context, frameState, output) {
    let normalizedProps = normalizeUnsafeHTMLProps(props);
    let innerHTML = normalizedProps.innerHTML;
    let mixedProps = resolveSsrMixedProps(tag, normalizedProps, context, frameState);
    let processedProps = processStyleProps(mixedProps);
    // Determine namespace context for the current element and its children
    let currentIsSvg = context.insideSvg || tag === 'svg';
    if (!currentIsSvg && tag === 'textarea') {
        output.push(buildTextareaElementSegment(tag, processedProps));
        return;
    }
    let attrs = !currentIsSvg && tag === 'input'
        ? renderInputAttributes(processedProps)
        : renderAttributes(tag, processedProps, currentIsSvg);
    if (SELF_CLOSING_TAGS.has(tag)) {
        output.push(`<${tag}${attrs} />`);
        return;
    }
    if (innerHTML !== undefined) {
        output.push(`<${tag}${attrs}>${innerHTML}</${tag}>`);
        return;
    }
    if (tag === 'script') {
        if (typeof props.children === 'string') {
            if (context.insideHead) {
                collectAuthoredImportMap(context, tag, processedProps, props.children);
            }
            output.push(`<${tag}${attrs}>${escapeScriptTextContent(props.children)}</${tag}>`);
            return;
        }
        if (props.children != null) {
            console.error(new Error('script elements with children must have a single string child'));
        }
        output.push(`<${tag}${attrs}></${tag}>`);
        return;
    }
    output.push(`<${tag}${attrs}>`);
    // Adjust svg context for children: foreignObject switches back to HTML
    let previousInsideSvg = context.insideSvg;
    context.insideSvg = tag === 'foreignObject' ? false : currentIsSvg;
    if (props.children != null)
        buildSegment(props.children, context, frameState, output);
    context.insideSvg = previousInsideSvg;
    output.push(`</${tag}>`);
}
function buildTextareaElementSegment(tag, props) {
    let attrs = renderAttributes(tag, props, false, TEXTAREA_VALUE_PROPS);
    let value = props.value ?? props.defaultValue ?? '';
    return `<${tag}${attrs}>${escapeTextContent(String(value))}</${tag}>`;
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
    if (importMap.integrity) {
        for (let [url, integrity] of Object.entries(importMap.integrity)) {
            if (!context.authoredImportMapIntegrity.has(url)) {
                context.authoredImportMapIntegrity.set(url, integrity);
            }
        }
    }
}
function collectAuthoredImportMapEntries(target, source) {
    for (let [specifier, address] of Object.entries(source)) {
        if (!target.has(specifier))
            target.set(specifier, address);
    }
}
function buildImportMapSegment(props, context) {
    if (context.flushKind !== 'document' || !context.insideHead) {
        throw new Error('ImportMap must be rendered inside a document head');
    }
    if (context.managedImportMaps.length > 0) {
        throw new Error('Only one ImportMap can be rendered per document');
    }
    let value = props.value;
    if (!isImportMap(value)) {
        throw new TypeError('ImportMap value must be a valid import map');
    }
    let { value: _value, ...scriptProps } = props;
    if (scriptProps.nonce === undefined && context.nonce !== undefined) {
        scriptProps.nonce = context.nonce;
    }
    let attrs = renderAttributes('script', scriptProps, false);
    let segment = { kind: 'static', html: '' };
    context.managedImportMaps.push({ attrs, segment, value });
    return segment;
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
    return renderAttributes('input', inputProps, false, INPUT_DEFAULT_PROPS);
}
function buildHeadElementSegment(tag, props, context, frameState, output) {
    let processedProps = processStyleProps(props);
    let attrs = renderAttributes(tag, processedProps, false);
    output.push(`<${tag}${attrs}>`);
    let previousInsideHead = context.insideHead;
    context.insideHead = true;
    if (props.children != null)
        buildSegment(props.children, context, frameState, output);
    context.insideHead = previousInsideHead;
    output.push(`</${tag}>`);
}
function renderAttributes(tag, props, isSvg, excludedProps) {
    let attrs = '';
    for (let key in props) {
        if (SSR_OMITTED_PROPS.has(key))
            continue;
        if (excludedProps?.has(key))
            continue;
        if (!isAllowedHostPropName(key))
            continue;
        let value = props[key];
        if (value === undefined || value === null)
            continue;
        let attrName = transformAttributeName(key, isSvg);
        if (typeof value === 'boolean') {
            if (shouldStringifyBooleanAttribute(attrName)) {
                attrs += ` ${attrName}="${value}"`;
            }
            else if (value) {
                attrs += ` ${attrName}`;
            }
        }
        else {
            value = sanitizeUrlAttribute(tag, attrName, value);
            attrs += ` ${attrName}="${escapeHtml(String(value))}"`;
        }
    }
    return attrs;
}
function resolveSsrMixedProps(hostType, initialProps, context, frameState) {
    let mix = initialProps.mix;
    if (!mix)
        return initialProps;
    if (Array.isArray(mix)) {
        let hasServerMixin = false;
        for (let descriptor of mix) {
            if (descriptor && !isBrowserOnlyMixinDescriptor(descriptor)) {
                hasServerMixin = true;
                break;
            }
        }
        if (!hasServerMixin)
            return initialProps;
    }
    else if (isBrowserOnlyMixinDescriptor(mix)) {
        return initialProps;
    }
    return composeMixedProps(hostType, initialProps, (descriptor, _index, mixinProps) => {
        if (isBrowserOnlyMixinDescriptor(descriptor))
            return undefined;
        let runner = resolveSsrMixinRunner(hostType, descriptor, context, frameState);
        if (!runner)
            return undefined;
        // Unlike the client runtime, a throwing mixin is isolated here so a
        // single bad mixin cannot take down the whole stream.
        try {
            return runner(...descriptor.args, mixinProps);
        }
        catch (error) {
            console.error(error);
            return undefined;
        }
    });
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
    // Context lookups read the shared render context, so capture the parent before it moves on.
    let parentVNode = context.parentVNode;
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
                let current = parentVNode;
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
function isElementFunction(value) {
    return typeof value === 'function';
}
function buildComponentSegment(type, props, context, componentId, frameState, output) {
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
    let previousParentVNode = context.parentVNode;
    context.parentVNode = vnode;
    buildSegment(renderedNode, context, frameState, output);
    context.parentVNode = previousParentVNode;
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
        // Fragment renders null and relies on the reconciler to render its
        // children, so it can't go through the component branch below.
        if (type === Fragment) {
            return {
                $rmxFragment: true,
                props: transformProps(props),
                key: serializeKey(element.key),
            };
        }
        // If it's a DOM tag, return a serializable shape with transformed props
        if (typeof type === 'string') {
            return { $rmx: true, type, props: transformProps(props), key: serializeKey(element.key) };
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
// Other key types don't survive JSON: bigints throw, and objects are revived
// with a new identity on every render, so keyed diffs would remount them.
function serializeKey(key) {
    if (typeof key === 'string')
        return key;
    if (typeof key === 'number' && Number.isFinite(key))
        return key;
    return undefined;
}
function buildEntrySegment(type, props, context, frameState, output) {
    let instanceId = randomId('h');
    output.push(`<!-- rmx:h:${instanceId} -->`);
    buildComponentSegment(type, props, context, instanceId, frameState, output);
    // Store hydration data in context for aggregation
    let replacer = createHydrationPropsReplacer(context, frameState);
    let propsJson = JSON.stringify(props, replacer);
    if (propsJson === undefined)
        throw new TypeError('Client entry props must serialize to JSON');
    context.unresolvedHydrationData.set(instanceId, {
        entryId: type.$entryId,
        component: type,
        propsJson,
    });
    output.push('<!-- /rmx:h -->');
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
        let { entryId, component, propsJson } = unresolvedHydrationData;
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
            propsJson,
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
// Joining once avoids building a deep rope of thousands of small strings, which raises RSS.
function serializeSegment(segments) {
    let parts = [];
    for (let seg of segments) {
        if (typeof seg === 'string') {
            parts.push(seg);
        }
        else if (seg.kind === 'static') {
            parts.push(seg.html);
        }
        else {
            parts.push(`<!-- rmx:f:${seg.frameId} -->`);
            if (typeof seg.content === 'string')
                parts.push(seg.content);
            else if (seg.content)
                parts.push(serializeSegment(seg.content));
            parts.push('<!-- /rmx:f -->');
        }
    }
    return parts.join('');
}
function escapeHtml(str) {
    if (!/[&<>"']/.test(str))
        return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeTextContent(str) {
    if (!/[&<>]/.test(str))
        return str;
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
    let preloads = collectModulePreloadTags(context.clientEntryHeadResources, context.nonce);
    let styles = collectStyleTags(context);
    let importMapScript = collectImportMapScript(context, context.clientEntryHeadResources);
    let nonceMeta = context.flushKind === 'document' && context.nonce !== undefined
        ? `<meta name="${DOCUMENT_NONCE_META_NAME}" content=""${renderNonceAttribute(context.nonce)}>`
        : '';
    let headContent = nonceMeta + importMapScript + preloads + styles;
    let rmxData = buildRmxDataScript(context);
    if (context.flushKind !== 'document') {
        return (headContent ? `<head>${headContent}</head>` : '') + html + rmxData;
    }
    if (!headContent && !rmxData)
        return html;
    // Both insertion points are found in the rendered document before either insertion.
    let headIndex = headContent ? html.indexOf('</head>') : -1;
    if (headContent && headIndex === -1) {
        let htmlOpenMatch = html.match(/<html[^>]*>/);
        headIndex = htmlOpenMatch ? htmlOpenMatch.index + htmlOpenMatch[0].length : 0;
        if (htmlOpenMatch)
            headContent = `<head>${headContent}</head>`;
    }
    let dataIndex = html.length;
    if (rmxData) {
        dataIndex = html.indexOf('</body>');
        if (dataIndex === -1)
            dataIndex = html.indexOf('</html>');
        if (dataIndex === -1)
            dataIndex = html.length;
    }
    if (!headContent)
        return html.slice(0, dataIndex) + rmxData + html.slice(dataIndex);
    if (dataIndex < headIndex) {
        return (html.slice(0, dataIndex) +
            rmxData +
            html.slice(dataIndex, headIndex) +
            headContent +
            html.slice(headIndex));
    }
    return (html.slice(0, headIndex) +
        headContent +
        html.slice(headIndex, dataIndex) +
        rmxData +
        html.slice(dataIndex));
}
const FRAME_HEAD_OPEN_TAG = '<head>';
const FRAME_HEAD_CLOSE_TAG = '</head>';
const MARKED_MODULE_PRELOAD_START = '<link data-rmx-module-preload rel="modulepreload" href="';
const MODULE_PRELOAD_END = '" />';
const MANAGED_IMPORT_MAP_OPEN_TAG = /^<script data-rmx-import-map type="importmap"(?: nonce="[^"]*")?>/;
const IMPORT_MAP_SCRIPT_END = '</script>';
function createModulePreloadTag(href) {
    return `${MARKED_MODULE_PRELOAD_START}${escapeHtml(href)}${MODULE_PRELOAD_END}`;
}
function collectModulePreloadTags(resources, nonce) {
    return Array.from(resources.modulePreloadTags, (tag) => tag.replace(' />', () => `${renderNonceAttribute(nonce)} />`)).join('');
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
    let importMapOpenTag = html.slice(cursor).match(MANAGED_IMPORT_MAP_OPEN_TAG);
    if (importMapOpenTag) {
        let contentStart = cursor + importMapOpenTag[0].length;
        let scriptEnd = html.indexOf(IMPORT_MAP_SCRIPT_END, contentStart);
        if (scriptEnd === -1 || scriptEnd >= headClose)
            return html;
        importMaps.push(parseFrameworkImportMap(html.slice(contentStart, scriptEnd)));
        cursor = scriptEnd + IMPORT_MAP_SCRIPT_END.length;
    }
    while (html.startsWith(MARKED_MODULE_PRELOAD_START, cursor)) {
        let hrefStart = cursor + MARKED_MODULE_PRELOAD_START.length;
        let hrefEnd = html.indexOf('"', hrefStart);
        if (hrefEnd === -1 || hrefEnd >= headClose)
            return html;
        let tagEnd = html.indexOf(MODULE_PRELOAD_END, hrefEnd);
        if (tagEnd === -1)
            return html;
        tagEnd += MODULE_PRELOAD_END.length;
        if (tagEnd > headClose)
            return html;
        // Preserve the escaped href and discard the child response's nonce.
        // The enclosing render applies its nonce when serializing the head.
        preloadTags.push(html.slice(cursor, hrefEnd) + MODULE_PRELOAD_END);
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
    if (!('class' in props) &&
        typeof props.style !== 'object' &&
        Object.getPrototypeOf(props) === Object.prototype) {
        return props;
    }
    let classAttr = typeof props.class === 'string' ? props.class : '';
    let className = typeof props.className === 'string' ? props.className : '';
    let mergedClassName = classAttr;
    if (className)
        mergedClassName = classAttr ? `${classAttr} ${className}` : className;
    let processedProps;
    if (mergedClassName) {
        // Copy without `delete`, which would leave the props object in slow dictionary mode.
        processedProps = {};
        for (let key of Object.keys(props)) {
            if (key !== 'class')
                processedProps[key] = props[key];
        }
        processedProps.className = mergedClassName;
    }
    else {
        processedProps = { ...props };
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
        let tag = renderStyleTag(selector, css, context.nonce);
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
function renderStyleTag(selector, css, nonce, layer = REMIX_UI_STYLE_LAYER) {
    let wrappedCss = wrapStyleForLayer(selector, css, layer);
    if (!wrappedCss)
        return '';
    return `<style data-rmx-style="${escapeHtml(selector)}"${renderNonceAttribute(nonce)}>${escapeStyleText(wrappedCss)}</style>`;
}
function renderNonceAttribute(nonce) {
    return nonce === undefined ? '' : ` nonce="${escapeHtml(nonce)}"`;
}
function escapeStyleText(css) {
    // Only neutralize literal style end tags. Escaping every '<' breaks valid range media queries.
    return css.replace(/<\/style/gi, '\\3C/style');
}
function buildRmxDataScript(context) {
    if (context.hydrationData.size === 0 && context.frameData.size === 0) {
        return '';
    }
    let fields = [];
    if (context.hydrationData.size > 0) {
        let entries = [];
        for (let [id, { exportName, moduleUrl, propsJson }] of context.hydrationData) {
            entries.push(`${JSON.stringify(id)}:{"exportName":${JSON.stringify(exportName)},"moduleUrl":${JSON.stringify(moduleUrl)},"props":${propsJson}}`);
        }
        fields.push(`"h":{${entries.join(',')}}`);
    }
    if (context.frameData.size > 0) {
        fields.push(`"f":${JSON.stringify(Object.fromEntries(context.frameData))}`);
    }
    let serializedData = escapeScriptJson(`{${fields.join(',')}}`);
    return `<script type="application/json" id="rmx-data">${serializedData}</script>`;
}
function buildImportMapScript(importMap, attrs = '') {
    let serializedData = escapeScriptJson(JSON.stringify(importMap));
    return `<script data-rmx-import-map type="importmap"${attrs}>${serializedData}</script>`;
}
function collectImportMapScript(context, resources) {
    let importMap = getImportMapDelta(context, resources.importMap);
    return importMap ? buildImportMapScript(importMap, renderNonceAttribute(context.nonce)) : '';
}
function finalizeManagedImportMap(context) {
    let managed = context.managedImportMaps[0];
    if (!managed)
        return;
    let resources = { modulePreloadTags: new Set() };
    mergeImportMap(resources, managed.value);
    if (context.clientEntryHeadResources.importMap) {
        mergeImportMap(resources, context.clientEntryHeadResources.importMap);
    }
    managed.segment.html = buildImportMapScript(resources.importMap ?? {}, managed.attrs);
    context.clientEntryHeadResources.importMap = undefined;
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
    let integrity = importMap.integrity
        ? getImportMapIntegrityDelta(context.authoredImportMapIntegrity, importMap.integrity)
        : undefined;
    if (!imports && Object.keys(scopes).length === 0 && !integrity)
        return null;
    return {
        ...(imports ? { imports } : null),
        ...(Object.keys(scopes).length > 0 ? { scopes } : null),
        ...(integrity ? { integrity } : null),
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
function getImportMapIntegrityDelta(authoredIntegrity, discoveredIntegrity) {
    let delta = {};
    for (let [url, integrity] of Object.entries(discoveredIntegrity)) {
        if (!authoredIntegrity.has(url)) {
            delta[url] = integrity;
            continue;
        }
        let authoredIntegrityValue = authoredIntegrity.get(url);
        if (authoredIntegrityValue === integrity)
            continue;
        console.warn(`[remix] Ignoring conflicting import map integrity entry for "${url}": ` +
            `"${authoredIntegrityValue}" is already authored, but the discovered map points to "${integrity}"`);
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
    if (value.integrity !== undefined) {
        if (!isObjectRecord(value.integrity))
            return null;
        importMap.integrity = Object.fromEntries(Object.entries(value.integrity).filter((entry) => typeof entry[1] === 'string'));
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
    if (value.integrity !== undefined && !isImportMapIntegrity(value.integrity))
        return false;
    return true;
}
function isImportMapImports(value) {
    if (!isObjectRecord(value))
        return false;
    return Object.values(value).every((address) => address === null || typeof address === 'string');
}
function isImportMapIntegrity(value) {
    if (!isObjectRecord(value))
        return false;
    return Object.values(value).every((integrity) => typeof integrity === 'string');
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
    if (source.integrity) {
        target.integrity ??= {};
        mergeImportMapIntegrity(target.integrity, source.integrity);
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
function mergeImportMapIntegrity(target, source) {
    for (let [url, integrity] of Object.entries(source)) {
        if (!Object.hasOwn(target, url)) {
            target[url] = integrity;
            continue;
        }
        if (target[url] !== integrity) {
            throw new Error(`Conflicting framework import map integrity entry for "${url}"`);
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
                let templateHtml = `<template id="${frameId}">${escapeTemplateContent(html)}<!--${FRAME_TEMPLATE_END_MARKER}--></template>`;
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
 * Render errors reject the returned promise.
 *
 * @param node Node tree to render.
 * @param options Rendering options.
 * @returns Rendered HTML.
 */
export async function renderToString(node, options) {
    return stripFlushMarkers(await drain(renderToStream(node, {
        nonce: options?.nonce,
        onError(error) {
            throw error;
        },
    })));
}
//# sourceMappingURL=stream.js.map