import { processStyle } from "./style/lib/style.js";
import { Fragment, createComponent, createFrameHandle, Frame } from "./component.js";
import { isEntry } from "./client-entries.js";
export function createVNode(type, props, key) {
    return { type, props, key };
}
const HEAD_ELEMENTS = new Set(['title', 'meta', 'link', 'style']);
const SELF_CLOSING_TAGS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);
const NUMERIC_CSS_PROPS = new Set([
    'z-index',
    'opacity',
    'flex-grow',
    'flex-shrink',
    'flex-order',
    'grid-area',
    'grid-row',
    'grid-column',
    'font-weight',
    'line-height',
    'order',
    'orphans',
    'widows',
    'zoom',
    'columns',
    'column-count',
]);
const FRAMEWORK_PROPS = new Set(['children', 'innerHTML', 'on', 'key', 'css']);
export function renderToStream(node, options) {
    let encoder = new TextEncoder();
    let onError = options?.onError ?? ((error) => console.error(error));
    let context = {
        headElements: [],
        insideHead: false,
        insideSvg: false,
        onError,
        resolveFrame: options?.resolveFrame ?? defaultResolveFrame,
        styleCache: new Map(),
        pendingFrames: [],
        hydrationData: new Map(),
        frameData: new Map(),
        blockingFrameTails: [],
        serverIdScope: crypto.randomUUID().slice(0, 8),
        serverIdCounter: 0,
    };
    return new ReadableStream({
        async start(controller) {
            try {
                let root = buildSegment(node, context, '');
                await resolveBlocking(root);
                let html = serializeSegment(root);
                let finalHtml = finalizeHtml(html, context);
                let bytes = encoder.encode(finalHtml);
                controller.enqueue(bytes);
                // If we have any tails from blocking frame streams, stream them now.
                // These contain nested non-blocking frame templates (or other follow-up chunks)
                // that must come after the initial document chunk.
                let tailPromise = context.blockingFrameTails.length > 0
                    ? streamByteStreams(context.blockingFrameTails, controller, context.onError)
                    : Promise.resolve();
                // If we have pending non-blocking frames, stream them as they resolve
                let pendingPromise = context.pendingFrames.length > 0
                    ? streamPendingFrames(context, controller, encoder)
                    : Promise.resolve();
                await Promise.all([tailPromise, pendingPromise]);
                controller.close();
            }
            catch (error) {
                onError(error);
                controller.error(error);
            }
        },
    });
}
function defaultResolveFrame() {
    throw new Error('No resolveFrame provided');
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
    let { value, done } = await reader.read();
    if (done || !value) {
        reader.releaseLock();
        return {
            first: new Uint8Array(),
            tail: new ReadableStream({
                start(controller) {
                    controller.close();
                },
            }),
        };
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
    return { first: value, tail };
}
async function resolveFrameHtml(input) {
    if (typeof input === 'string')
        return { html: input };
    let decoder = new TextDecoder();
    let { first, tail } = await splitFirstChunk(input);
    return { html: decoder.decode(first), tail };
}
function isRemixElement(node) {
    return typeof node === 'object' && node !== null && '$rmx' in node;
}
function isHeadManagedElement(tag, props) {
    return HEAD_ELEMENTS.has(tag) || (tag === 'script' && props.type === 'application/ld+json');
}
function staticSeg(html) {
    return { kind: 'static', html };
}
function compositeSeg(parts) {
    return { kind: 'composite', parts };
}
function buildSegment(node, context, framePath) {
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
        return staticSeg(escapeTextContent(String(node)));
    }
    if (node === null || node === undefined || typeof node === 'boolean') {
        return staticSeg('');
    }
    if (Array.isArray(node)) {
        return compositeSeg(node.map((child) => buildSegment(child, context, framePath)));
    }
    if (isRemixElement(node)) {
        let type = node.type;
        let props = node.props;
        if (type === Fragment) {
            let children = props.children;
            return children != null ? buildSegment(children, context, framePath) : staticSeg('');
        }
        if (typeof type === 'string') {
            let tag = type;
            if (tag === 'html') {
                return buildElementSegment(tag, props, context, framePath);
            }
            if (tag === 'head') {
                return buildHeadElementSegment(tag, props, context, framePath);
            }
            if (isHeadManagedElement(tag, props) && !context.insideHead) {
                let elementSeg = buildElementSegment(tag, props, context, framePath);
                let html = serializeSegment(elementSeg);
                context.headElements.push(html);
                return staticSeg('');
            }
            return buildElementSegment(tag, props, context, framePath);
        }
        if (typeof type === 'function') {
            if (type === Frame) {
                return buildFrameSegment(props, context, framePath);
            }
            if (isEntry(type)) {
                return buildEntrySegment(type, props, context, framePath);
            }
            return buildComponentSegment(type, props, context, createServerComponentId(context), framePath);
        }
    }
    return staticSeg('');
}
function buildFrameSegment(props, context, framePath) {
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
    let nonBlocking = !!props.fallback;
    if (nonBlocking) {
        seg.content = buildSegment(props.fallback, context, framePath);
        let framePromise = Promise.resolve(context.resolveFrame(props.src)).then(async (resolved) => resolveFrameHtml(resolved));
        context.pendingFrames.push({ frameId, promise: framePromise });
    }
    else {
        seg.pending = Promise.resolve(context.resolveFrame(props.src)).then(async (resolved) => {
            let { html, tail } = await resolveFrameHtml(resolved);
            seg.content = staticSeg(html);
            if (tail) {
                context.blockingFrameTails.push(tail);
            }
        });
    }
    return seg;
}
function buildElementSegment(tag, props, context, framePath) {
    let processedProps = processStyleProps(props, context);
    // Determine namespace context for the current element and its children
    let currentIsSvg = context.insideSvg || tag === 'svg';
    let attrs = renderAttributes(processedProps, currentIsSvg);
    if (SELF_CLOSING_TAGS.has(tag)) {
        return staticSeg(`<${tag}${attrs} />`);
    }
    if (props.innerHTML) {
        return staticSeg(`<${tag}${attrs}>${props.innerHTML}</${tag}>`);
    }
    let open = staticSeg(`<${tag}${attrs}>`);
    // Adjust svg context for children: foreignObject switches back to HTML
    let previousInsideSvg = context.insideSvg;
    context.insideSvg = tag === 'foreignObject' ? false : currentIsSvg;
    let children = props.children != null ? buildSegment(props.children, context, framePath) : staticSeg('');
    context.insideSvg = previousInsideSvg;
    let close = staticSeg(`</${tag}>`);
    return compositeSeg([open, children, close]);
}
function buildHeadElementSegment(tag, props, context, framePath) {
    let processedProps = processStyleProps(props, context);
    let attrs = renderAttributes(processedProps, false);
    let previousInsideHead = context.insideHead;
    context.insideHead = true;
    let open = staticSeg(`<${tag}${attrs}>`);
    let children = props.children != null ? buildSegment(props.children, context, framePath) : staticSeg('');
    let close = staticSeg(`</${tag}>`);
    context.insideHead = previousInsideHead;
    return compositeSeg([open, children, close]);
}
function renderAttributes(props, isSvg) {
    let attrs = '';
    for (let key in props) {
        if (FRAMEWORK_PROPS.has(key))
            continue;
        let value = props[key];
        if (value === undefined || value === null || value === false)
            continue;
        let attrName = transformAttributeName(key, isSvg);
        if (value === true) {
            attrs += ` ${attrName}`;
        }
        else {
            attrs += ` ${attrName}="${escapeHtml(String(value))}"`;
        }
    }
    return attrs;
}
function buildComponentSegment(type, props, context, componentId, framePath) {
    let vnode = createVNode(type, props);
    if (context.parentVNode) {
        vnode._parent = context.parentVNode;
    }
    let handle = createComponent({
        id: componentId,
        type: type,
        frame: createFrameHandle({ src: framePath }),
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
    });
    vnode._handle = handle;
    let [renderedNode] = handle.render(props);
    let childContext = { ...context, parentVNode: vnode };
    return buildSegment(renderedNode, childContext, framePath);
}
function createHydrationPropsReplacer(context, framePath) {
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
        if (typeof type === 'function') {
            let vnode = createVNode(type, props);
            if (context.parentVNode) {
                vnode._parent = context.parentVNode;
            }
            let handle = createComponent({
                id: 'SERIALIZED',
                type: type,
                frame: createFrameHandle({ src: framePath }),
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
function buildEntrySegment(type, props, context, framePath) {
    let instanceId = randomId('h');
    let rendered = buildComponentSegment(type, props, context, instanceId, framePath);
    // Store hydration data in context for aggregation
    let replacer = createHydrationPropsReplacer(context, framePath);
    context.hydrationData.set(instanceId, {
        moduleUrl: type.$moduleUrl,
        exportName: type.$exportName,
        props: JSON.parse(JSON.stringify(props, replacer)),
    });
    let start = staticSeg(`<!-- rmx:h:${instanceId} -->`);
    let end = staticSeg('<!-- /rmx:h -->');
    return compositeSeg([start, rendered, end]);
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
function transformAttributeName(name, isSvg) {
    // aria-/data- pass through
    if (name.startsWith('aria-') || name.startsWith('data-'))
        return name;
    // Namespaced
    if (name === 'xlinkHref')
        return 'xlink:href';
    if (name === 'xmlLang')
        return 'xml:lang';
    if (name === 'xmlSpace')
        return 'xml:space';
    // HTML mappings
    if (!isSvg) {
        if (name === 'className')
            return 'class';
        if (name === 'htmlFor')
            return 'for';
        if (name === 'tabIndex')
            return 'tabindex';
        if (name === 'acceptCharset')
            return 'accept-charset';
        if (name === 'httpEquiv')
            return 'http-equiv';
        return name.toLowerCase();
    }
    // SVG preserved-case exceptions
    if (name === 'viewBox' ||
        name === 'preserveAspectRatio' ||
        name === 'gradientUnits' ||
        name === 'gradientTransform' ||
        name === 'patternUnits' ||
        name === 'patternTransform' ||
        name === 'clipPathUnits' ||
        name === 'maskUnits' ||
        name === 'maskContentUnits')
        return name;
    // General SVG: kebab-case
    return camelToKebab(name);
}
function camelToKebab(input) {
    return input
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/_/g, '-')
        .toLowerCase();
}
function finalizeHtml(html, context) {
    let hasHtmlRoot = html.trimStart().toLowerCase().startsWith('<html');
    let css = collectAllStyles(context);
    if (css) {
        context.headElements.push(`<style data-rmx-styles>${css}</style>`);
    }
    // Inject head elements if we have any
    if (context.headElements.length > 0) {
        let headContent = context.headElements.join('');
        if (hasHtmlRoot) {
            // For HTML root, inject into existing head or create one
            let headCloseIndex = html.indexOf('</head>');
            if (headCloseIndex !== -1) {
                // Inject before existing </head>
                html = html.slice(0, headCloseIndex) + headContent + html.slice(headCloseIndex);
            }
            else {
                // No existing head, inject after <html>
                let htmlOpenMatch = html.match(/<html[^>]*>/);
                if (htmlOpenMatch) {
                    let insertIndex = htmlOpenMatch.index + htmlOpenMatch[0].length;
                    html =
                        html.slice(0, insertIndex) + `<head>${headContent}</head>` + html.slice(insertIndex);
                }
            }
        }
        else {
            // No HTML root, prepend head
            html = `<head>${headContent}</head>${html}`;
        }
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
function processStyleProps(props, context) {
    let processedProps = { ...props };
    if (props.css) {
        if (typeof props.css === 'object') {
            let { selector } = processStyle(props.css, context.styleCache);
            if (selector) {
                // Style system uses data-css attribute for CSS selectors
                processedProps['data-css'] = selector;
            }
        }
        delete processedProps.css;
    }
    if (typeof props.style === 'object') {
        processedProps.style = serializeStyleObject(props.style);
    }
    return processedProps;
}
function collectAllStyles(context) {
    if (context.styleCache.size === 0)
        return '';
    let allCss = '';
    for (let { css } of context.styleCache.values()) {
        allCss += css + '\n';
    }
    return `@layer rmx { ${allCss.trim()} }`;
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
function escapeScriptJson(json) {
    // Avoid prematurely closing the script tag when serialized data contains "</script>".
    return json.replace(/</g, '\\u003c');
}
function serializeStyleObject(style) {
    let parts = [];
    for (let [key, value] of Object.entries(style)) {
        if (value == null)
            continue;
        if (typeof value === 'boolean')
            continue;
        if (typeof value === 'number' && !Number.isFinite(value))
            continue;
        // Convert camelCase to kebab-case
        let cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        // Add px to numeric values where appropriate
        let shouldAppendPx = typeof value === 'number' &&
            value !== 0 &&
            !NUMERIC_CSS_PROPS.has(cssKey) &&
            !cssKey.startsWith('--');
        let cssValue = shouldAppendPx
            ? `${value}px`
            : Array.isArray(value)
                ? value.join(', ')
                : String(value);
        parts.push(`${cssKey}: ${cssValue};`);
    }
    return parts.join(' ');
}
// Frame styles work end-to-end when frame handlers use their own `renderToStream`:
// the handler's `finalizeHtml` emits `<style data-rmx-styles>` in its HTML, and on the client,
// `hoistHeadElements` (frame.ts) moves it to `document.head` where the `adoptServerStyleTag`
// MutationObserver (stylesheet.ts) picks it up and adopts the CSS into an adopted stylesheet.
async function streamPendingFrames(context, controller, encoder) {
    let processedFrames = new Set();
    while (true) {
        let batch = context.pendingFrames.filter(({ frameId }) => !processedFrames.has(frameId));
        if (batch.length === 0)
            break;
        await Promise.all(batch.map(async ({ frameId, promise }) => {
            processedFrames.add(frameId);
            try {
                let { html, tail } = await promise;
                // Stream as a template element (first chunk only)
                let templateHtml = `<template id="${frameId}">${escapeTemplateContent(html)}</template>`;
                controller.enqueue(encoder.encode(templateHtml));
                // Forward any additional chunks from a stream-valued resolveFrame result.
                if (tail) {
                    await streamByteStreams([tail], controller, context.onError);
                }
            }
            catch (error) {
                context.onError(error);
            }
        }));
    }
}
async function streamByteStreams(streams, controller, onError) {
    await Promise.all(streams.map(async (stream) => {
        let reader = stream.getReader();
        try {
            while (true) {
                let { done, value } = await reader.read();
                if (done)
                    break;
                controller.enqueue(value);
            }
        }
        catch (error) {
            onError(error);
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
export async function renderToString(node) {
    return drain(renderToStream(node, {
        onError(error) {
            throw error;
        },
    }));
}
//# sourceMappingURL=stream.js.map