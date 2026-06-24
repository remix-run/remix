import { createComponent, Frame } from "./component.js";
import { createFrame } from "./frame.js";
import { createRangeRoot } from "./vdom.js";
import { isCommittedComponentNode, isComponentNode, isCommittedHostNode, isCommittedTextNode, isFragmentNode, isHostNode, isNonRenderNode, isTextNode, findContextFromAncestry, } from "./vnode.js";
import { invariant } from "./invariant.js";
import { patchHostProps } from "./core/props.js";
import { skipComments, logHydrationMismatch } from "./client-entries.js";
import { toVNode } from "./to-vnode.js";
import { bindMixinRuntime, cancelPendingMixinRemoval, dispatchMixinBeforeUpdate, dispatchMixinCommit, getMixinRuntimeSignal, prepareMixinRemoval, resolveMixedProps, teardownMixins, } from "./mixins/mixin.js";
import { isOnMixinDescriptor } from "./mixins/on-mixin.js";
const SVG_NS = 'http://www.w3.org/2000/svg';
let idCounter = 0;
let persistedRemovalToken = 0;
const persistedMixinNodes = new Set();
let activeSchedulerUpdateParents;
// Compute SVG context for a node based on its parent and type.
// Returns true if the node is within an SVG subtree, false otherwise.
function getSvgContext(vParent, nodeType) {
    // Only host elements (strings) can affect SVG context
    if (typeof nodeType === 'string') {
        // svg element creates SVG context
        if (nodeType === 'svg')
            return true;
        // foreignObject switches back to HTML context
        if (nodeType === 'foreignObject')
            return false;
    }
    // Otherwise inherit from parent
    return vParent._svg ?? false;
}
function getHostProps(node) {
    return node._mixedProps ?? node.props;
}
function markNodePersistedByMixins(node, domParent, token) {
    node._persistedByMixins = true;
    node._persistedParentByMixins = domParent;
    node._persistedRemovalToken = token;
    persistedMixinNodes.add(node);
    bindMixinRuntime(node._mixState, undefined);
}
function unmarkNodePersistedByMixins(node) {
    node._persistedByMixins = false;
    node._persistedParentByMixins = undefined;
    node._persistedRemovalToken = undefined;
    persistedMixinNodes.delete(node);
}
function findMatchingPersistedMixinNode(type, key, domParent) {
    if (key == null)
        return null;
    for (let node of persistedMixinNodes) {
        if (node._persistedParentByMixins !== domParent)
            continue;
        if (node.type !== type)
            continue;
        if (node.key !== key)
            continue;
        return node;
    }
    return null;
}
const EMPTY_DIRECT_EVENT_DESCRIPTORS = [];
function shouldRestoreControlledReflectionOnInput(node, state) {
    // Some controls dispatch `input` before `change` for the same interaction.
    // When checked/value state is typically handled on `change`, restoring on the
    // earlier `input` can race and clobber the value observed by app handlers.
    if (state.hasControlledChecked)
        return false;
    if (node.type === 'select')
        return false;
    return true;
}
function ensureControlledReflection(node, scheduler) {
    let existing = node._controlledState;
    if (existing)
        return existing;
    let state = {
        disposed: false,
        listenersAttached: false,
        pendingRestoreVersion: 0,
        managesValue: false,
        managesChecked: false,
        hasControlledValue: false,
        controlledValue: undefined,
        hasControlledChecked: false,
        controlledChecked: undefined,
        onInput: () => {
            if (!shouldRestoreControlledReflectionOnInput(node, state))
                return;
            scheduleControlledRestore(node, state);
        },
        onChange: () => {
            scheduleControlledRestore(node, state);
        },
    };
    node._controlledState = state;
    scheduler.enqueueTasks([
        () => {
            if (state.disposed)
                return;
            node._dom.addEventListener('input', state.onInput);
            node._dom.addEventListener('change', state.onChange);
            state.listenersAttached = true;
        },
    ]);
    return state;
}
function syncControlledReflection(node, props) {
    let state = node._controlledState;
    if (!state || state.disposed)
        return;
    state.managesValue = canManageValue(node.type, node._dom);
    state.managesChecked = canReflectProperty(node._dom, 'checked');
    state.hasControlledValue = state.managesValue && hasControlledValueProp(props);
    state.controlledValue = props.value;
    state.hasControlledChecked = state.managesChecked && hasControlledCheckedProp(props);
    state.controlledChecked = props.checked;
    state.pendingRestoreVersion++;
}
function shouldTrackControlledReflection(props) {
    return hasControlledValueProp(props) || hasControlledCheckedProp(props);
}
function scheduleControlledRestore(node, state) {
    if (state.disposed)
        return;
    let version = ++state.pendingRestoreVersion;
    queueMicrotask(() => {
        if (state.disposed)
            return;
        if (state.pendingRestoreVersion !== version)
            return;
        restoreControlledReflections(node, state);
    });
}
function restoreControlledReflections(node, state) {
    let element = node._dom;
    if (state.hasControlledValue && readDomProp(element, 'value') !== state.controlledValue) {
        setPropertyReflection(element, 'value', state.controlledValue);
    }
    if (state.hasControlledChecked && readDomProp(element, 'checked') !== state.controlledChecked) {
        setPropertyReflection(element, 'checked', state.controlledChecked);
    }
}
function teardownControlledReflection(node) {
    let state = node._controlledState;
    if (!state)
        return;
    state.disposed = true;
    state.pendingRestoreVersion++;
    if (state.listenersAttached) {
        node._dom.removeEventListener('input', state.onInput);
        node._dom.removeEventListener('change', state.onChange);
        state.listenersAttached = false;
    }
}
function canManageValue(type, element) {
    if (type === 'progress')
        return false;
    return canReflectProperty(element, 'value');
}
function hasControlledValueProp(props) {
    return 'value' in props && props.value !== undefined;
}
function hasControlledCheckedProp(props) {
    return 'checked' in props && props.checked !== undefined;
}
function canReflectProperty(element, key) {
    return key in element && !key.includes('-');
}
function readDomProp(element, key) {
    if (!canReflectProperty(element, key))
        return undefined;
    return element[key];
}
function setPropertyReflection(element, key, value) {
    if (!canReflectProperty(element, key))
        return;
    element[key] = value == null ? '' : value;
}
function resolveNodeMixProps(node, frame, scheduler, state) {
    let mix = node.props.mix;
    let directEventDescriptors = resolveDirectEventDescriptors(mix);
    if (directEventDescriptors) {
        if (state) {
            teardownMixins(state);
        }
        node._mixState = undefined;
        node._mixedProps = node.props;
        node._directEventDescriptors = directEventDescriptors;
        return node.props;
    }
    node._directEventDescriptors = undefined;
    if (state == null && (mix == null || (Array.isArray(mix) && mix.length === 0))) {
        node._mixState = undefined;
        node._mixedProps = node.props;
        return node.props;
    }
    let resolved = resolveMixedProps({
        hostType: node.type,
        frame,
        scheduler,
        getContext: (type) => {
            if (typeof type !== 'function') {
                return undefined;
            }
            return findContextFromAncestry(node, type);
        },
        props: node.props,
        state,
    });
    node._mixState = resolved.state;
    node._mixedProps = resolved.props;
    return resolved.props;
}
function resolveDirectEventDescriptors(mix) {
    if (!mix)
        return EMPTY_DIRECT_EVENT_DESCRIPTORS;
    if (!Array.isArray(mix)) {
        return isOnMixinDescriptor(mix) ? [mix] : null;
    }
    return areOnMixinDescriptors(mix) ? mix : null;
}
function areOnMixinDescriptors(descriptors) {
    for (let item of descriptors) {
        if (!isOnMixinDescriptor(item))
            return false;
    }
    return true;
}
function enqueueMixinBindingUpdate(done) {
    let node = this.target;
    let state = node._mixState;
    this.scheduler.enqueueWork([
        () => {
            if (state?.aborted) {
                done(getMixinRuntimeSignal(state));
                return;
            }
            dispatchMixinBeforeUpdate(state);
            let prevProps = getHostProps(node);
            let nextProps = resolveNodeMixProps(node, this.frame, this.scheduler, state);
            patchHostProps(prevProps, nextProps, this.node);
            dispatchMixinCommit(state);
            done(state ? getMixinRuntimeSignal(state) : AbortSignal.abort());
        },
    ]);
}
function bindNodeMixRuntime(node, frame, scheduler, styles, reclaimed = false, parent) {
    let state = node._mixState;
    bindMixinRuntime(state, {
        node: node._dom,
        parent: parent ?? node._dom.parentNode,
        key: node.key,
        target: node,
        frame,
        scheduler,
        enqueueUpdate: enqueueMixinBindingUpdate,
    }, { dispatchReclaimed: reclaimed });
}
function isHeadHostNode(node) {
    if (node.type === 'head')
        return true;
    if (node.type.length !== 4)
        return false;
    return node.type.toLowerCase() === 'head';
}
function getDocumentHead(domParent) {
    if (domParent instanceof Document) {
        return domParent.head;
    }
    if (domParent instanceof Node) {
        return domParent.ownerDocument?.head ?? null;
    }
    return null;
}
export function diffVNodes(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, rootCursor) {
    next._parent = vParent; // set parent for initial render context lookups
    next._svg = getSvgContext(vParent, next.type);
    // new
    if (curr === null) {
        return insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, rootCursor);
    }
    if (curr.type !== next.type) {
        replace(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor);
        return rootCursor;
    }
    if (isNonRenderNode(curr) && isNonRenderNode(next)) {
        return rootCursor;
    }
    if (isCommittedTextNode(curr) && isTextNode(next)) {
        diffText(curr, next, vParent);
        return rootCursor;
    }
    if (isCommittedHostNode(curr) && isHostNode(next)) {
        diffHost(curr, next, frame, scheduler, styles, vParent, rootTarget);
        return rootCursor;
    }
    if (isCommittedComponentNode(curr) && isComponentNode(next)) {
        diffComponent(curr, next, frame, scheduler, styles, domParent, vParent, rootTarget);
        return rootCursor;
    }
    if (isFragmentNode(curr) && isFragmentNode(next)) {
        diffChildren(curr._children, next._children, domParent, frame, scheduler, styles, next, rootTarget, undefined, anchor);
        return rootCursor;
    }
    if (curr.type === Frame && next.type === Frame) {
        diffFrame(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor);
        return rootCursor;
    }
    invariant(false, 'Unexpected diff case');
}
function replace(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor) {
    let currAnchor = findFirstDomAnchor(curr);
    if (currAnchor && currAnchor.parentNode === domParent) {
        let replacementAnchor = document.createComment('rmx:replace');
        domParent.insertBefore(replacementAnchor, currAnchor);
        try {
            remove(curr, domParent, scheduler, styles);
            insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, replacementAnchor);
        }
        finally {
            replacementAnchor.parentNode?.removeChild(replacementAnchor);
        }
        return;
    }
    let replacementAnchor = findNextSiblingDomAnchor(curr) ?? anchor;
    remove(curr, domParent, scheduler, styles);
    insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, replacementAnchor);
}
function diffHost(curr, next, frame, scheduler, styles, vParent, rootTarget) {
    let mixState = curr._mixState;
    let currProps = getHostProps(curr);
    let nextProps = resolveNodeMixProps(next, frame, scheduler, mixState);
    let nextMixState = next._mixState;
    let shouldDispatchMixinLifecycle = (nextMixState?.runners.length ?? 0) > 0 && shouldDispatchInlineMixinLifecycle(curr._dom);
    if (shouldDispatchMixinLifecycle) {
        dispatchMixinBeforeUpdate(nextMixState);
    }
    // Handle innerHTML prop BEFORE diffChildren to avoid clearing children
    if (nextProps.innerHTML != null) {
        // innerHTML is set, update it if changed
        if (currProps.innerHTML !== nextProps.innerHTML) {
            curr._dom.innerHTML = nextProps.innerHTML;
        }
    }
    else if (currProps.innerHTML != null) {
        // innerHTML was removed, clear it before adding children
        curr._dom.innerHTML = '';
    }
    diffChildren(curr._children, next._children, curr._dom, frame, scheduler, styles, next, rootTarget);
    patchHostProps(currProps, nextProps, curr._dom);
    next._dom = curr._dom;
    next._parent = vParent;
    next._controller = curr._controller;
    next._directEventState = curr._directEventState;
    next._controlledState = curr._controlledState;
    syncDirectEventListeners(next);
    if (next._controlledState || shouldTrackControlledReflection(nextProps)) {
        ensureControlledReflection(next, scheduler);
        syncControlledReflection(next, nextProps);
    }
    if (next._mixState) {
        bindNodeMixRuntime(next, frame, scheduler, styles);
    }
    if (shouldDispatchMixinLifecycle) {
        scheduler.enqueueCommitPhase([() => dispatchMixinCommit(nextMixState)]);
    }
    return;
}
function setupHostNode(node, dom, scheduler) {
    node._dom = dom;
    let props = getHostProps(node);
    let committedNode = node;
    syncDirectEventListeners(committedNode);
    if (shouldTrackControlledReflection(props)) {
        ensureControlledReflection(committedNode, scheduler);
        syncControlledReflection(committedNode, props);
    }
}
function syncDirectEventListeners(node) {
    let descriptors = node._directEventDescriptors;
    if (!descriptors) {
        teardownDirectEventListeners(node);
        return;
    }
    if (descriptors.length === 0) {
        teardownDirectEventListeners(node);
        return;
    }
    let state = node._directEventState;
    if (!state) {
        state = { bindings: [] };
        node._directEventState = state;
    }
    let bindings = state.bindings;
    for (let index = 0; index < descriptors.length; index++) {
        let descriptor = descriptors[index];
        let [type, handler, captureBoolean = false] = descriptor.args;
        let binding = bindings[index];
        if (!binding) {
            binding = createDirectEventBinding(type, handler, captureBoolean);
            bindings[index] = binding;
            attachDirectEventBinding(node._dom, binding);
            continue;
        }
        if (binding.type !== type || binding.capture !== captureBoolean) {
            removeDirectEventBinding(node._dom, binding);
            binding.type = type;
            binding.capture = captureBoolean;
            attachDirectEventBinding(node._dom, binding);
        }
        binding.handler = handler;
    }
    for (let index = descriptors.length; index < bindings.length; index++) {
        removeDirectEventBinding(node._dom, bindings[index]);
    }
    bindings.length = descriptors.length;
}
function createDirectEventBinding(type, handler, capture) {
    let binding = {
        type,
        handler,
        capture,
        reentry: null,
        stableHandler: null,
    };
    return binding;
}
function getStableDirectEventHandler(binding) {
    if (binding.stableHandler)
        return binding.stableHandler;
    binding.stableHandler = (event) => {
        invokeDirectEventBinding(binding, event);
    };
    return binding.stableHandler;
}
function attachDirectEventBinding(dom, binding) {
    dom.addEventListener(binding.type, getStableDirectEventHandler(binding), binding.capture);
}
function removeDirectEventBinding(dom, binding) {
    if (binding.stableHandler) {
        dom.removeEventListener(binding.type, binding.stableHandler, binding.capture);
    }
    binding.reentry?.abort(new DOMException('', 'AbortError'));
    binding.reentry = null;
}
function teardownDirectEventListeners(node) {
    let state = node._directEventState;
    if (!state)
        return;
    for (let binding of state.bindings) {
        removeDirectEventBinding(node._dom, binding);
    }
    state.bindings.length = 0;
    node._directEventState = undefined;
}
function invokeDirectEventBinding(binding, event) {
    binding.reentry?.abort(new DOMException('', 'EventReentry'));
    binding.reentry = new AbortController();
    void binding.handler(event, binding.reentry.signal);
}
function diffText(curr, next, vParent) {
    if (curr._text !== next._text) {
        curr._dom.textContent = next._text;
    }
    next._dom = curr._dom;
    next._parent = vParent;
}
function insert(node, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor) {
    node._parent = vParent; // set parent for initial render context lookups
    node._svg = getSvgContext(vParent, node.type);
    // Stop hydration if cursor has reached the anchor (end boundary)
    // Check BEFORE skipComments to prevent escaping range root markers
    if (cursor && anchor && cursor === anchor) {
        cursor = null;
    }
    cursor =
        node.type === Frame
            ? skipCommentsExceptFrameStart(cursor ?? null)
            : skipComments(cursor ?? null);
    // Also check after skipComments in case we skipped past the anchor
    if (cursor && anchor && cursor === anchor) {
        cursor = null;
    }
    let doInsert = anchor
        ? (dom) => domParent.insertBefore(dom, anchor)
        : (dom) => domParent.appendChild(dom);
    if (isNonRenderNode(node)) {
        return cursor;
    }
    if (isTextNode(node)) {
        if (cursor instanceof Text) {
            node._parent = vParent;
            // Handle text node consolidation: server renders adjacent text as single node
            // e.g., <span>Hello {world}</span> → server: "Hello world", client: ["Hello ", "world"]
            if (cursor.data !== node._text) {
                if (cursor.data.startsWith(node._text) && node._text.length < cursor.data.length) {
                    // Consolidation case: split the text node at the boundary
                    // cursor becomes the first part (node._text), remainder is returned for next vnode
                    let remainder = cursor.splitText(node._text.length);
                    node._dom = cursor;
                    return remainder;
                }
                // Genuine mismatch - correct it
                logHydrationMismatch('text mismatch', cursor.data, node._text);
                cursor.data = node._text;
            }
            node._dom = cursor;
            return cursor.nextSibling;
        }
        let dom = document.createTextNode(node._text);
        node._dom = dom;
        node._parent = vParent;
        doInsert(dom);
        return cursor;
    }
    if (isHostNode(node)) {
        let hostProps = resolveNodeMixProps(node, frame, scheduler);
        if (isHeadHostNode(node)) {
            let targetHead = getDocumentHead(domParent);
            if (targetHead) {
                let childCursor = cursor;
                if (cursor instanceof Element && cursor.tagName.toLowerCase() === 'head') {
                    childCursor = cursor.firstChild;
                    let nextCursor = cursor.nextSibling;
                    if (cursor !== targetHead) {
                        while (cursor.firstChild) {
                            targetHead.appendChild(cursor.firstChild);
                        }
                        cursor.remove();
                    }
                    cursor = nextCursor;
                }
                // Render explicit <head> children directly into document.head.
                diffChildren(null, node._children, targetHead, frame, scheduler, styles, node, rootTarget, childCursor);
                patchHostProps({}, hostProps, targetHead);
                setupHostNode(node, targetHead, scheduler);
                if (node._mixState) {
                    bindNodeMixRuntime(node, frame, scheduler, styles);
                }
                return cursor;
            }
        }
        // Check for matching mixin-persisted node that can be reclaimed
        let persistedNode = findMatchingPersistedMixinNode(node.type, node.key, domParent);
        if (persistedNode) {
            reclaimPersistedMixinNode(persistedNode, node, frame, scheduler, styles, vParent, rootTarget);
            return cursor;
        }
        if (cursor instanceof Element) {
            // SVG elements have case-sensitive tag names (e.g. linearGradient, clipPath)
            // HTML elements are case-insensitive, so we lowercase for comparison
            let cursorTag = node._svg ? cursor.tagName : cursor.tagName.toLowerCase();
            if (cursorTag === node.type) {
                let nextCursor = cursor.nextSibling;
                patchHostProps({}, hostProps, cursor);
                // Handle innerHTML prop
                if (hostProps.innerHTML != null) {
                    cursor.innerHTML = hostProps.innerHTML;
                }
                else {
                    let childCursor = cursor.firstChild;
                    // Ignore excess nodes - browser extensions may inject content
                    diffChildren(null, node._children, cursor, frame, scheduler, styles, node, rootTarget, childCursor);
                }
                setupHostNode(node, cursor, scheduler);
                if (node._mixState) {
                    bindNodeMixRuntime(node, frame, scheduler, styles);
                }
                return nextCursor;
            }
            else {
                // Type mismatch - try single-advance retry to handle browser extension injections
                // at the start of containers. Skip this node and try the next sibling once.
                let nextSibling = skipComments(cursor.nextSibling);
                if (nextSibling instanceof Element) {
                    let nextTag = node._svg ? nextSibling.tagName : nextSibling.tagName.toLowerCase();
                    if (nextTag === node.type) {
                        let nextCursor = nextSibling.nextSibling;
                        // Found a match after skipping - adopt it and leave skipped node in place
                        patchHostProps({}, hostProps, nextSibling);
                        if (hostProps.innerHTML != null) {
                            nextSibling.innerHTML = hostProps.innerHTML;
                        }
                        else {
                            let childCursor = nextSibling.firstChild;
                            diffChildren(null, node._children, nextSibling, frame, scheduler, styles, node, rootTarget, childCursor);
                        }
                        setupHostNode(node, nextSibling, scheduler);
                        if (node._mixState) {
                            bindNodeMixRuntime(node, frame, scheduler, styles);
                        }
                        return nextCursor;
                    }
                }
                // Retry failed - log mismatch and create new element (don't remove mismatched nodes)
                logHydrationMismatch('tag', cursorTag, node.type);
                cursor = undefined; // stop hydration for this tree
            }
        }
        let dom = node._svg
            ? document.createElementNS(SVG_NS, node.type)
            : document.createElement(node.type);
        patchHostProps({}, hostProps, dom);
        // Handle innerHTML prop
        if (hostProps.innerHTML != null) {
            dom.innerHTML = hostProps.innerHTML;
        }
        else {
            diffChildren(null, node._children, dom, frame, scheduler, styles, node, rootTarget);
        }
        setupHostNode(node, dom, scheduler);
        if (node._mixState) {
            bindNodeMixRuntime(node, frame, scheduler, styles, false, domParent);
        }
        doInsert(dom);
        return cursor;
    }
    if (isFragmentNode(node)) {
        // Insert fragment children in order before the same anchor
        for (let child of node._children) {
            cursor = insert(child, domParent, frame, scheduler, styles, node, rootTarget, anchor, cursor);
        }
        return cursor;
    }
    if (isComponentNode(node)) {
        return diffComponent(null, node, frame, scheduler, styles, domParent, vParent, rootTarget, anchor, cursor);
    }
    if (node.type === Frame) {
        return insertFrame(node, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor);
    }
    invariant(false, 'Unexpected node type');
}
function diffFrame(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor) {
    let currSrc = getFrameSrc(curr);
    let nextSrc = getFrameSrc(next);
    let currName = getFrameName(curr);
    let nextName = getFrameName(next);
    if (currName !== nextName) {
        let replaceAnchor = curr._rangeEnd?.nextSibling ?? anchor;
        remove(curr, domParent, scheduler, styles);
        insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, replaceAnchor);
        return;
    }
    // If the frame hasn't resolved yet, preserve existing cancel/remount behavior
    // so pending streams from the old src cannot take over the new src.
    if (currSrc !== nextSrc && !curr._frameResolved) {
        let replaceAnchor = curr._rangeEnd?.nextSibling ?? anchor;
        remove(curr, domParent, scheduler, styles);
        insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, replaceAnchor);
        return;
    }
    next._rangeStart = curr._rangeStart;
    next._rangeEnd = curr._rangeEnd;
    next._frameInstance = curr._frameInstance;
    next._frameFallbackRoot = curr._frameFallbackRoot;
    next._frameResolveToken = curr._frameResolveToken;
    next._frameResolved = curr._frameResolved;
    next._parent = vParent;
    if (currSrc !== nextSrc) {
        let frameInstance = next._frameInstance;
        if (frameInstance) {
            frameInstance.handle.src = nextSrc;
        }
        let runtime = getFrameRuntime(frame);
        if (runtime) {
            resolveClientFrame(next, runtime);
        }
    }
    if (!next._frameResolved && next._frameFallbackRoot) {
        next._frameFallbackRoot.render(next.props?.fallback ?? null);
    }
}
function insertFrame(node, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor) {
    let runtime = getFrameRuntime(frame);
    if (!runtime || runtime.canResolveFrames === false) {
        throw new Error('Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.');
    }
    // Hydration path: adopt server-rendered frame markers and reuse the existing
    // frame instance created during createSubFrames().
    if (isFrameStartComment(cursor)) {
        let start = cursor;
        let end = findFrameEndComment(start);
        if (end) {
            node._rangeStart = start;
            node._rangeEnd = end;
            node._parent = vParent;
            node._frameResolveToken = 0;
            node._frameResolveController = undefined;
            node._frameFallbackRoot = undefined;
            node._frameResolved = true;
            let frameId = getFrameIdFromComment(start);
            let marker = frameId ? runtime.data.f?.[frameId] : undefined;
            let src = marker?.src ?? getFrameSrc(node);
            let instance = runtime.frameInstances.get(start);
            if (!instance) {
                instance = createFrame([start, end], {
                    name: getFrameName(node),
                    src,
                    marker: frameId && marker ? { ...marker, id: frameId } : undefined,
                    errorTarget: runtime.errorTarget,
                    loadModule: runtime.loadModule,
                    resolveFrame: runtime.resolveFrame,
                    pendingClientEntries: runtime.pendingClientEntries,
                    scheduler: runtime.scheduler,
                    data: runtime.data,
                    moduleCache: runtime.moduleCache,
                    moduleLoads: runtime.moduleLoads,
                    frameInstances: runtime.frameInstances,
                    namedFrames: runtime.namedFrames,
                });
                runtime.frameInstances.set(start, instance);
            }
            node._frameInstance = instance;
            return end.nextSibling;
        }
    }
    let start = document.createComment(` rmx:f:${randomFrameId()} `);
    let end = document.createComment(' /rmx:f ');
    let doInsert = anchor
        ? (dom) => domParent.insertBefore(dom, anchor)
        : (dom) => domParent.appendChild(dom);
    doInsert(start);
    doInsert(end);
    node._rangeStart = start;
    node._rangeEnd = end;
    node._parent = vParent;
    let fallbackRoot = createRangeRoot([start, end], {
        frame,
        styleManager: styles,
    });
    fallbackRoot.render(node.props?.fallback ?? null);
    node._frameFallbackRoot = fallbackRoot;
    node._frameResolved = false;
    node._frameResolveToken = 0;
    let instance = createFrame([start, end], {
        name: getFrameName(node),
        src: getFrameSrc(node),
        errorTarget: runtime.errorTarget,
        loadModule: runtime.loadModule,
        resolveFrame: runtime.resolveFrame,
        pendingClientEntries: runtime.pendingClientEntries,
        scheduler: runtime.scheduler,
        data: runtime.data,
        moduleCache: runtime.moduleCache,
        moduleLoads: runtime.moduleLoads,
        frameInstances: runtime.frameInstances,
        namedFrames: runtime.namedFrames,
    });
    node._frameInstance = instance;
    runtime.frameInstances.set(start, instance);
    resolveClientFrame(node, runtime);
    return cursor;
}
function resolveClientFrame(node, runtime) {
    let frameSrc = getFrameSrc(node);
    let instance = node._frameInstance;
    if (!instance)
        return;
    let token = (node._frameResolveToken ?? 0) + 1;
    node._frameResolveToken = token;
    node._frameResolveController?.abort();
    let resolveController = new AbortController();
    node._frameResolveController = resolveController;
    Promise.resolve(runtime.resolveFrame(frameSrc, resolveController.signal))
        .then(async (content) => {
        if (node._frameResolveToken !== token || resolveController.signal.aborted)
            return;
        node._frameFallbackRoot?.dispose();
        node._frameFallbackRoot = undefined;
        let nextContent = asAbortableFrameContent(content, resolveController.signal);
        await instance.render(nextContent, { signal: resolveController.signal });
        if (node._frameResolveToken !== token || resolveController.signal.aborted)
            return;
        node._frameResolved = true;
    })
        .catch(() => { })
        .finally(() => {
        if (node._frameResolveController === resolveController) {
            node._frameResolveController = undefined;
        }
    });
}
function disposeFrameResources(node) {
    node._frameResolveToken = (node._frameResolveToken ?? 0) + 1;
    node._frameResolveController?.abort();
    node._frameResolveController = undefined;
    node._frameFallbackRoot?.dispose();
    node._frameFallbackRoot = undefined;
    let frameInstance = node._frameInstance;
    if (frameInstance) {
        frameInstance.dispose();
        node._frameInstance = undefined;
    }
}
function asAbortableFrameContent(content, signal) {
    if (!(content instanceof ReadableStream))
        return content;
    return createAbortableReadableStream(content, signal);
}
function createAbortableReadableStream(source, signal) {
    let reader = source.getReader();
    let aborted = false;
    let onAbort = () => {
        aborted = true;
        void reader.cancel(signal.reason);
    };
    if (signal.aborted)
        onAbort();
    else
        signal.addEventListener('abort', onAbort, { once: true });
    return new ReadableStream({
        async pull(controller) {
            if (aborted) {
                controller.close();
                return;
            }
            let removeAbortReadListener;
            let abortRead = new Promise((resolve) => {
                if (signal.aborted) {
                    resolve({ done: true, value: undefined });
                    return;
                }
                let onAbortRead = () => {
                    resolve({ done: true, value: undefined });
                };
                removeAbortReadListener = () => signal.removeEventListener('abort', onAbortRead);
                signal.addEventListener('abort', onAbortRead, { once: true });
            });
            let { done, value } = await Promise.race([reader.read(), abortRead]);
            removeAbortReadListener?.();
            if (done) {
                controller.close();
                return;
            }
            controller.enqueue(value);
        },
        cancel(reason) {
            signal.removeEventListener('abort', onAbort);
            return reader.cancel(reason);
        },
    });
}
function removeFrameDomRange(node, domParent) {
    let start = node._rangeStart;
    let end = node._rangeEnd;
    if (!(start instanceof Comment) || !(end instanceof Comment))
        return;
    let cursor = start;
    while (cursor) {
        let nextSibling = cursor.nextSibling;
        if (cursor.parentNode === domParent) {
            domParent.removeChild(cursor);
        }
        if (cursor === end)
            break;
        cursor = nextSibling;
    }
    node._rangeStart = undefined;
    node._rangeEnd = undefined;
}
function getFrameRuntime(frame) {
    return frame.$runtime;
}
function getFrameSrc(node) {
    let src = node.props?.src;
    invariant(typeof src === 'string' && src.length > 0, '<Frame /> requires a src prop');
    return src;
}
function getFrameName(node) {
    let name = node.props?.name;
    return typeof name === 'string' && name.length > 0 ? name : undefined;
}
function randomFrameId() {
    return `f${crypto.randomUUID().slice(0, 8)}`;
}
function skipCommentsExceptFrameStart(cursor) {
    while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
        if (isFrameStartComment(cursor))
            return cursor;
        cursor = cursor.nextSibling;
    }
    return cursor;
}
function isFrameStartComment(node) {
    return node instanceof Comment && node.data.trim().startsWith('rmx:f:');
}
function isFrameEndComment(node) {
    return node instanceof Comment && node.data.trim() === '/rmx:f';
}
function getFrameIdFromComment(comment) {
    let text = comment.data.trim();
    if (!text.startsWith('rmx:f:'))
        return undefined;
    return text.slice('rmx:f:'.length);
}
function findFrameEndComment(start) {
    let depth = 1;
    let node = start.nextSibling;
    while (node) {
        if (isFrameStartComment(node))
            depth++;
        else if (isFrameEndComment(node)) {
            depth--;
            if (depth === 0)
                return node;
        }
        node = node.nextSibling;
    }
    return null;
}
export function renderComponent(handle, currContent, next, domParent, frame, scheduler, styles, rootTarget, vParent, anchor, cursor) {
    if (handle.isRemoved())
        return cursor;
    let [element, tasks] = handle.render(next.props);
    let content = toVNode(element);
    let newCursor = diffVNodes(currContent, content, domParent, frame, scheduler, styles, next, rootTarget, anchor, cursor);
    next._content = content;
    next._handle = handle;
    next._parent = vParent;
    let committed = next;
    handle.setScheduleUpdate(() => {
        scheduler.enqueue(committed, domParent);
    });
    scheduler.enqueueTasks(tasks);
    return newCursor;
}
function diffComponent(curr, next, frame, scheduler, styles, domParent, vParent, rootTarget, anchor, cursor) {
    if (curr === null) {
        let componentId = vParent._pendingHydrationComponentId;
        if (componentId) {
            vParent._pendingHydrationComponentId = undefined;
        }
        else {
            componentId = `c${++idCounter}`;
        }
        next._handle = createComponent({
            id: componentId,
            frame,
            type: next.type,
            getContext: (type) => findContextFromAncestry(vParent, type),
            getFrameByName(name) {
                let runtime = getFrameRuntime(frame);
                return runtime?.namedFrames.get(name);
            },
            getTopFrame() {
                let runtime = getFrameRuntime(frame);
                return runtime?.topFrame;
            },
        });
        return renderComponent(next._handle, null, next, domParent, frame, scheduler, styles, rootTarget, vParent, anchor, cursor);
    }
    next._handle = curr._handle;
    let { _content, _handle } = curr;
    return renderComponent(_handle, _content, next, domParent, frame, scheduler, styles, rootTarget, vParent, anchor, cursor);
}
// Cleanup without DOM removal - used for descendants when parent DOM node is removed
function cleanupDescendants(node, scheduler, styles) {
    if (isCommittedTextNode(node)) {
        return;
    }
    if (isCommittedHostNode(node)) {
        for (let child of node._children) {
            cleanupDescendants(child, scheduler, styles);
        }
        teardownMixins(node._mixState);
        teardownDirectEventListeners(node);
        teardownControlledReflection(node);
        if (node._controller)
            node._controller.abort();
        return;
    }
    if (isFragmentNode(node)) {
        for (let child of node._children) {
            cleanupDescendants(child, scheduler, styles);
        }
        return;
    }
    if (isCommittedComponentNode(node)) {
        cleanupDescendants(node._content, scheduler, styles);
        let tasks = node._handle.remove();
        scheduler.enqueueTasks(tasks);
        return;
    }
    if (node.type === Frame) {
        disposeFrameResources(node);
        return;
    }
}
export function remove(node, domParent, scheduler, styles) {
    if (isCommittedTextNode(node)) {
        node._dom.parentNode?.removeChild(node._dom);
        return;
    }
    if (isCommittedHostNode(node)) {
        if (node._persistedByMixins)
            return;
        let persistedRemoval = prepareMixinRemoval(node._mixState);
        if (persistedRemoval) {
            let token = ++persistedRemovalToken;
            markNodePersistedByMixins(node, domParent, token);
            void persistedRemoval
                .catch(() => { })
                .finally(() => {
                if (!node._persistedByMixins)
                    return;
                if (node._persistedRemovalToken !== token)
                    return;
                unmarkNodePersistedByMixins(node);
                performHostNodeRemoval(node, domParent, scheduler, styles);
            });
            return;
        }
        performHostNodeRemoval(node, domParent, scheduler, styles);
        return;
    }
    if (isFragmentNode(node)) {
        for (let child of node._children) {
            remove(child, domParent, scheduler, styles);
        }
        return;
    }
    if (isCommittedComponentNode(node)) {
        remove(node._content, domParent, scheduler, styles);
        let tasks = node._handle.remove();
        scheduler.enqueueTasks(tasks);
        return;
    }
    if (node.type === Frame) {
        disposeFrameResources(node);
        removeFrameDomRange(node, domParent);
        return;
    }
}
// Actually remove a host node from DOM and clean up
function performHostNodeRemoval(node, domParent, scheduler, styles) {
    if (isHeadHostNode(node)) {
        for (let child of node._children) {
            remove(child, node._dom, scheduler, styles);
        }
    }
    else {
        // Clean up all descendants first (before removing DOM subtree)
        for (let child of node._children) {
            cleanupDescendants(child, scheduler, styles);
        }
    }
    teardownMixins(node._mixState);
    teardownDirectEventListeners(node);
    teardownControlledReflection(node);
    // Never remove the real document.head node when reconciling a <head> vnode.
    if (!isHeadHostNode(node)) {
        node._dom.parentNode?.removeChild(node._dom);
    }
    if (node._controller)
        node._controller.abort();
}
function diffChildren(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, cursor, anchor) {
    let hasKeys = hasKeyedChildren(next);
    if (curr === null) {
        if (hasKeys) {
            warnDuplicateKeys(next);
        }
        for (let node of next) {
            cursor = insert(node, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor);
        }
        vParent._children = next;
        return cursor;
    }
    if (next.length === 0 &&
        anchor === undefined &&
        !parentUsesInnerHTML(vParent) &&
        canBulkClearChildren(curr)) {
        for (let node of curr) {
            cleanupDescendants(node, scheduler, styles);
        }
        domParent.textContent = '';
        vParent._children = next;
        return;
    }
    if (!hasKeys) {
        for (let i = 0; i < next.length; i++) {
            let currentNode = i < curr.length ? curr[i] : null;
            diffVNodes(currentNode, next[i], domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor);
        }
        if (curr.length > next.length) {
            for (let i = next.length; i < curr.length; i++) {
                let node = curr[i];
                if (node)
                    remove(node, domParent, scheduler, styles);
            }
        }
        vParent._children = next;
        return;
    }
    patchKeyedChildren(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, cursor, anchor);
    return;
}
function parentUsesInnerHTML(parent) {
    return isHostNode(parent) && getHostProps(parent).innerHTML != null;
}
function canBulkClearChildren(children) {
    for (let child of children) {
        if (!canBulkClearNode(child))
            return false;
    }
    return true;
}
function canBulkClearNode(node) {
    if (isCommittedTextNode(node))
        return true;
    if (isCommittedHostNode(node)) {
        if (node._mixState)
            return false;
        for (let child of node._children) {
            if (!canBulkClearNode(child))
                return false;
        }
        return true;
    }
    if (isFragmentNode(node)) {
        return canBulkClearChildren(node._children);
    }
    if (isCommittedComponentNode(node)) {
        return canBulkClearNode(node._content);
    }
    return false;
}
function hasKeyedChildren(children) {
    for (let node of children) {
        if (node.key != null)
            return true;
    }
    return false;
}
function warnDuplicateKeys(children) {
    let seenKeys;
    let duplicateKeys;
    for (let node of children) {
        if (node.key == null)
            continue;
        if (!seenKeys) {
            seenKeys = new Set([node.key]);
            continue;
        }
        if (seenKeys.has(node.key)) {
            duplicateKeys ??= new Set();
            duplicateKeys.add(node.key);
        }
        else {
            seenKeys.add(node.key);
        }
    }
    if (duplicateKeys?.size) {
        let quotedKeys = Array.from(duplicateKeys, (key) => `"${key}"`);
        console.warn(`Duplicate keys detected in siblings: ${quotedKeys.join(', ')}. Keys should be unique.`);
    }
}
function patchKeyedChildren(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, cursor, anchor) {
    let matches = matchKeyedChildrenInOrder(curr, next) ??
        matchKeyedChildrenAfterSingleRemoval(curr, next) ??
        matchKeyedChildrenAfterPairSwap(curr, next);
    if (!matches) {
        warnDuplicateKeys(next);
        matches = matchKeyedChildren(curr, next);
    }
    let matchAnalysis = analyzeKeyedChildMatches(curr.length, matches);
    if (matchAnalysis.hasRemovals) {
        let usedOldIndexes = new Uint8Array(curr.length);
        for (let match of matches) {
            if (match.oldIndex >= 0) {
                usedOldIndexes[match.oldIndex] = 1;
            }
        }
        for (let oldIndex = 0; oldIndex < curr.length; oldIndex++) {
            if (usedOldIndexes[oldIndex] === 0) {
                remove(curr[oldIndex], domParent, scheduler, styles);
            }
        }
    }
    vParent._children = next;
    for (let index = 0; index < next.length; index++) {
        let match = matches[index];
        let oldNode = match.oldIndex >= 0 ? curr[match.oldIndex] : null;
        diffVNodes(oldNode, next[index], domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor);
    }
    if (matchAnalysis.canSkipPlacement) {
        return;
    }
    let stableIndexes = lisMatches(matches);
    let stableCursor = stableIndexes.length - 1;
    let placementAnchor = anchor ?? null;
    for (let index = next.length - 1; index >= 0; index--) {
        let nextNode = next[index];
        let isStable = stableIndexes[stableCursor] === index;
        if (isStable) {
            stableCursor--;
        }
        else {
            placeVNode(nextNode, domParent, placementAnchor);
        }
        placementAnchor = findFirstDomAnchor(nextNode) ?? placementAnchor;
    }
}
function matchKeyedChildren(curr, next) {
    let oldKeyMap = new Map();
    let usedOldIndexes = new Set();
    let unkeyedSearchStart = 0;
    for (let index = 0; index < curr.length; index++) {
        let key = curr[index].key;
        if (key != null)
            oldKeyMap.set(key, index);
    }
    return next.map((nextNode) => {
        let oldIndex = -1;
        if (nextNode.key != null) {
            let keyedOldIndex = oldKeyMap.get(nextNode.key);
            if (keyedOldIndex !== undefined) {
                let oldNode = curr[keyedOldIndex];
                if (!usedOldIndexes.has(keyedOldIndex) && oldNode.type === nextNode.type) {
                    oldIndex = keyedOldIndex;
                }
            }
        }
        else {
            for (let index = unkeyedSearchStart; index < curr.length; index++) {
                let oldNode = curr[index];
                if (usedOldIndexes.has(index) || oldNode.key != null || oldNode.type !== nextNode.type) {
                    continue;
                }
                oldIndex = index;
                unkeyedSearchStart = index + 1;
                break;
            }
        }
        if (oldIndex >= 0)
            usedOldIndexes.add(oldIndex);
        return { oldIndex };
    });
}
function matchKeyedChildrenInOrder(curr, next) {
    let length = Math.min(curr.length, next.length);
    let matches = [];
    for (let index = 0; index < length; index++) {
        let nextNode = next[index];
        if (nextNode.key == null)
            return null;
        let oldNode = curr[index];
        if (oldNode.key !== nextNode.key || oldNode.type !== nextNode.type) {
            return null;
        }
        matches.push({ oldIndex: index });
    }
    for (let index = length; index < next.length; index++) {
        if (next[index].key == null)
            return null;
        matches.push({ oldIndex: -1 });
    }
    return matches;
}
function matchKeyedChildrenAfterSingleRemoval(curr, next) {
    if (curr.length !== next.length + 1)
        return null;
    let matches = [];
    let oldIndex = 0;
    let skippedOldNode = false;
    for (let nextIndex = 0; nextIndex < next.length; nextIndex++) {
        let nextNode = next[nextIndex];
        if (nextNode.key == null)
            return null;
        let oldNode = curr[oldIndex];
        if (oldNode.key === nextNode.key && oldNode.type === nextNode.type) {
            matches.push({ oldIndex });
            oldIndex++;
            continue;
        }
        if (skippedOldNode)
            return null;
        skippedOldNode = true;
        oldIndex++;
        oldNode = curr[oldIndex];
        if (oldNode.key !== nextNode.key || oldNode.type !== nextNode.type) {
            return null;
        }
        matches.push({ oldIndex });
        oldIndex++;
    }
    return matches;
}
function matchKeyedChildrenAfterPairSwap(curr, next) {
    if (curr.length !== next.length)
        return null;
    let matches = [];
    let firstMismatch = -1;
    let secondMismatch = -1;
    for (let index = 0; index < next.length; index++) {
        let nextNode = next[index];
        if (nextNode.key == null)
            return null;
        let oldNode = curr[index];
        if (oldNode.key === nextNode.key && oldNode.type === nextNode.type) {
            matches.push({ oldIndex: index });
            continue;
        }
        if (firstMismatch === -1) {
            firstMismatch = index;
        }
        else if (secondMismatch === -1) {
            secondMismatch = index;
        }
        else {
            return null;
        }
        matches.push({ oldIndex: -1 });
    }
    if (firstMismatch === -1)
        return matches;
    if (secondMismatch === -1)
        return null;
    let firstOldNode = curr[firstMismatch];
    let secondOldNode = curr[secondMismatch];
    let firstNextNode = next[firstMismatch];
    let secondNextNode = next[secondMismatch];
    if (firstOldNode.key !== secondNextNode.key ||
        firstOldNode.type !== secondNextNode.type ||
        secondOldNode.key !== firstNextNode.key ||
        secondOldNode.type !== firstNextNode.type) {
        return null;
    }
    matches[firstMismatch] = { oldIndex: secondMismatch };
    matches[secondMismatch] = { oldIndex: firstMismatch };
    return matches;
}
function analyzeKeyedChildMatches(currentLength, matches) {
    let hasRemovals = matches.length !== currentLength;
    let canSkipPlacement = true;
    let lastOldIndex = -1;
    let sawNewNode = false;
    for (let match of matches) {
        if (match.oldIndex < 0) {
            hasRemovals = true;
            sawNewNode = true;
            continue;
        }
        if (sawNewNode || match.oldIndex < lastOldIndex) {
            canSkipPlacement = false;
        }
        lastOldIndex = match.oldIndex;
    }
    return { hasRemovals, canSkipPlacement };
}
function lisMatches(matches) {
    let predecessors = Array.from({ length: matches.length });
    let tails = [];
    for (let index = 0; index < matches.length; index++) {
        let value = matches[index].oldIndex + 1;
        if (value === 0)
            continue;
        let low = 0;
        let high = tails.length;
        while (low < high) {
            let middle = (low + high) >> 1;
            if (matches[tails[middle]].oldIndex + 1 < value) {
                low = middle + 1;
            }
            else {
                high = middle;
            }
        }
        predecessors[index] = low > 0 ? tails[low - 1] : -1;
        tails[low] = index;
    }
    let cursor = tails.at(-1) ?? -1;
    for (let index = tails.length - 1; index >= 0; index--) {
        tails[index] = cursor;
        cursor = predecessors[cursor] ?? -1;
    }
    return tails;
}
function placeVNode(node, domParent, anchor) {
    let firstDom = findFirstDomAnchor(node);
    if (!firstDom || firstDom.parentNode !== domParent)
        return;
    let lastDom = findLastDomAnchor(node);
    if (!lastDom)
        return;
    if (anchor && domRangeContainsNode(firstDom, lastDom, anchor))
        return;
    if (firstDom === anchor)
        return;
    moveDomRange(domParent, firstDom, lastDom, anchor);
}
export function findFirstDomAnchor(node) {
    if (!node)
        return null;
    if (isCommittedTextNode(node))
        return node._dom;
    if (isCommittedHostNode(node))
        return node._dom;
    if (isCommittedComponentNode(node))
        return findFirstDomAnchor(node._content);
    if (node.type === Frame)
        return node._rangeStart ?? null;
    if (isFragmentNode(node)) {
        for (let child of node._children) {
            let dom = findFirstDomAnchor(child);
            if (dom)
                return dom;
        }
    }
    return null;
}
export function findLastDomAnchor(node) {
    if (!node)
        return null;
    if (isCommittedTextNode(node))
        return node._dom;
    if (isCommittedHostNode(node))
        return node._dom;
    if (isCommittedComponentNode(node))
        return findLastDomAnchor(node._content);
    if (node.type === Frame)
        return node._rangeEnd ?? null;
    if (isFragmentNode(node)) {
        for (let i = node._children.length - 1; i >= 0; i--) {
            let dom = findLastDomAnchor(node._children[i]);
            if (dom)
                return dom;
        }
    }
    return null;
}
function domRangeContainsNode(first, last, node) {
    let current = first;
    while (current) {
        if (current === node)
            return true;
        if (current === last)
            break;
        current = current.nextSibling;
    }
    return false;
}
function moveDomRange(domParent, first, last, before) {
    let current = first;
    while (current) {
        let next = current === last ? null : current.nextSibling;
        domParent.insertBefore(current, before);
        if (current === last)
            break;
        current = next;
    }
}
export function setActiveSchedulerUpdateParents(parents) {
    activeSchedulerUpdateParents = parents;
}
function shouldDispatchInlineMixinLifecycle(node) {
    let parents = activeSchedulerUpdateParents;
    if (!parents?.length)
        return true;
    for (let parent of parents) {
        let parentNode = parent;
        if (parentNode === node)
            return false;
        if (parentNode.contains(node))
            return false;
    }
    return true;
}
export function findNextSiblingDomAnchor(curr) {
    let vParent = curr._parent;
    if (!vParent || !Array.isArray(vParent._children))
        return null;
    let children = vParent._children;
    if (children.length === 0)
        return findNextSiblingDomAnchor(vParent);
    let idx = children.indexOf(curr);
    if (idx === -1)
        return null;
    for (let i = idx + 1; i < children.length; i++) {
        let dom = findFirstDomAnchor(children[i]);
        if (dom)
            return dom;
    }
    if (isFragmentNode(vParent)) {
        return findNextSiblingDomAnchor(vParent);
    }
    return null;
}
function reclaimPersistedMixinNode(persistedNode, newNode, frame, scheduler, styles, vParent, rootTarget) {
    cancelPendingMixinRemoval(persistedNode._mixState);
    unmarkNodePersistedByMixins(persistedNode);
    newNode._dom = persistedNode._dom;
    newNode._parent = vParent;
    newNode._controller = persistedNode._controller;
    newNode._mixState = persistedNode._mixState;
    newNode._directEventState = persistedNode._directEventState;
    newNode._controlledState = persistedNode._controlledState;
    let prevProps = getHostProps(persistedNode);
    let nextProps = resolveNodeMixProps(newNode, frame, scheduler, newNode._mixState);
    if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
        dispatchMixinBeforeUpdate(newNode._mixState);
    }
    patchHostProps(prevProps, nextProps, persistedNode._dom);
    syncDirectEventListeners(newNode);
    ensureControlledReflection(newNode, scheduler);
    syncControlledReflection(newNode, nextProps);
    diffChildren(persistedNode._children, newNode._children, persistedNode._dom, frame, scheduler, styles, newNode, rootTarget);
    if (newNode._mixState) {
        bindNodeMixRuntime(newNode, frame, scheduler, styles, true);
    }
    if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
        scheduler.enqueueCommitPhase([
            () => dispatchMixinCommit(newNode._mixState),
        ]);
    }
}
//# sourceMappingURL=reconcile.js.map