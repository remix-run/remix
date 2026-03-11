import { createComponent, Frame } from "./component.js";
import { isCommittedComponentNode, isComponentNode, isCommittedHostNode, isCommittedTextNode, isFragmentNode, isHostNode, isTextNode, findContextFromAncestry, } from "./vnode.js";
import { invariant } from "./invariant.js";
import { diffHostProps } from "./diff-props.js";
import { getCanonicalHostChildren, getHostContentMode } from "./host-content-mode.js";
import { skipComments, logHydrationMismatch } from "./client-entries.js";
import { domRangeContainsNode, findFirstDomAnchor, findLastDomAnchor, moveDomRange, shouldDispatchInlineMixinLifecycle, } from "./reconcile-anchors.js";
import { disposeFrameResources, getFrameName, getFrameRuntime, getFrameSrc, insertFrame, removeFrameDomRange, resolveClientFrame, skipCommentsExceptFrameStart, } from "./reconcile-frame.js";
import { toVNode } from "./to-vnode.js";
import { bindMixinRuntime, cancelPendingMixinRemoval, dispatchMixinBeforeUpdate, dispatchMixinCommit, getMixinRuntimeSignal, prepareMixinRemoval, resolveMixedProps, teardownMixins, } from "./mixin.js";
const SVG_NS = 'http://www.w3.org/2000/svg';
// Internal diffing flags (modeled after Preact)
const INSERT_VNODE = 1 << 0;
const MATCHED = 1 << 1;
let idCounter = 0;
let persistedRemovalToken = 0;
let persistedMixinNodes = new Set();
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
    let resolved = resolveMixedProps({
        hostType: node.type,
        frame,
        scheduler,
        props: node.props,
        state,
    });
    node._mixState = resolved.state;
    node._mixedProps = resolved.props;
    return resolved.props;
}
function bindNodeMixRuntime(node, frame, scheduler, styles, reclaimed = false, parent) {
    let state = node._mixState;
    bindMixinRuntime(state, {
        node: node._dom,
        parent: parent ?? node._dom.parentNode,
        key: node.key,
        enqueueUpdate(done) {
            scheduler.enqueueTasks([
                () => {
                    if (state?.aborted) {
                        done(getMixinRuntimeSignal(state));
                        return;
                    }
                    dispatchMixinBeforeUpdate(state);
                    let prevProps = getHostProps(node);
                    let nextProps = resolveNodeMixProps(node, frame, scheduler, state);
                    diffHostProps(prevProps, nextProps, node._dom);
                    dispatchMixinCommit(state);
                    done(state ? getMixinRuntimeSignal(state) : AbortSignal.abort());
                },
            ]);
        },
    }, { dispatchReclaimed: reclaimed });
}
function isHeadHostNode(node) {
    return node.type.toLowerCase() === 'head';
}
function isHeadManagedHostNode(node) {
    let tag = node.type.toLowerCase();
    if (tag === 'title' || tag === 'meta' || tag === 'link' || tag === 'style') {
        return true;
    }
    if (tag === 'script') {
        let props = getHostProps(node);
        return props.type === 'application/ld+json';
    }
    return false;
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
        diffChildren(curr._children, next._children, domParent, frame, scheduler, styles, vParent, rootTarget, undefined, anchor);
        return rootCursor;
    }
    if (curr.type === Frame && next.type === Frame) {
        diffFrame(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor);
        return rootCursor;
    }
    invariant(false, 'Unexpected diff case');
}
function replace(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor) {
    // Use curr's DOM position (most accurate) when it belongs to this parent.
    // Hoisted head nodes live under document.head and cannot be used as anchors
    // for body/range insertions.
    let currAnchor = findFirstDomAnchor(curr);
    if (currAnchor && currAnchor.parentNode === domParent) {
        anchor = currAnchor;
    }
    insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor);
    remove(curr, domParent, scheduler, styles);
}
function diffHost(curr, next, frame, scheduler, styles, vParent, rootTarget) {
    let mixState = curr._mixState;
    let currProps = getHostProps(curr);
    let nextProps = resolveNodeMixProps(next, frame, scheduler, mixState);
    let nextContentMode = getHostContentMode(nextProps);
    let nextChildren = getCanonicalHostChildren(nextContentMode, next._children);
    let currContentMode = getHostContentMode(currProps);
    if (shouldDispatchInlineMixinLifecycle(curr._dom)) {
        dispatchMixinBeforeUpdate(next._mixState);
    }
    if (nextContentMode === 'innerHTML') {
        if (currProps.innerHTML !== nextProps.innerHTML) {
            curr._dom.innerHTML = nextProps.innerHTML;
        }
        if (curr._children.length > 0) {
            for (let child of curr._children) {
                cleanupDescendants(child, scheduler, styles);
            }
        }
    }
    else {
        if (currContentMode === 'innerHTML') {
            curr._dom.innerHTML = '';
        }
        diffChildren(curr._children, nextChildren, curr._dom, frame, scheduler, styles, next, rootTarget);
    }
    diffHostProps(currProps, nextProps, curr._dom);
    next._dom = curr._dom;
    next._parent = vParent;
    next._children = nextChildren;
    next._controller = curr._controller;
    next._controlledState = curr._controlledState;
    ensureControlledReflection(next, scheduler);
    syncControlledReflection(next, nextProps);
    bindNodeMixRuntime(next, frame, scheduler, styles);
    if (shouldDispatchInlineMixinLifecycle(curr._dom)) {
        scheduler.enqueueTasks([
            () => dispatchMixinCommit(next._mixState),
        ]);
    }
    return;
}
function setupHostNode(node, dom, scheduler) {
    node._dom = dom;
    let props = getHostProps(node);
    let committedNode = node;
    ensureControlledReflection(committedNode, scheduler);
    syncControlledReflection(committedNode, props);
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
        let contentMode = getHostContentMode(hostProps);
        let nextChildren = getCanonicalHostChildren(contentMode, node._children);
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
                diffChildren(null, nextChildren, targetHead, frame, scheduler, styles, node, rootTarget, childCursor);
                diffHostProps({}, hostProps, targetHead);
                setupHostNode(node, targetHead, scheduler);
                node._children = nextChildren;
                bindNodeMixRuntime(node, frame, scheduler, styles);
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
                diffHostProps({}, hostProps, cursor);
                if (contentMode === 'innerHTML') {
                    cursor.innerHTML = hostProps.innerHTML;
                }
                else {
                    let childCursor = cursor.firstChild;
                    // Ignore excess nodes - browser extensions may inject content
                    diffChildren(null, nextChildren, cursor, frame, scheduler, styles, node, rootTarget, childCursor);
                }
                setupHostNode(node, cursor, scheduler);
                node._children = nextChildren;
                bindNodeMixRuntime(node, frame, scheduler, styles);
                if (isHeadManagedHostNode(node)) {
                    let targetHead = getDocumentHead(domParent);
                    if (targetHead && cursor.parentNode !== targetHead) {
                        targetHead.appendChild(cursor);
                    }
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
                        diffHostProps({}, hostProps, nextSibling);
                        if (contentMode === 'innerHTML') {
                            nextSibling.innerHTML = hostProps.innerHTML;
                        }
                        else {
                            let childCursor = nextSibling.firstChild;
                            diffChildren(null, nextChildren, nextSibling, frame, scheduler, styles, node, rootTarget, childCursor);
                        }
                        setupHostNode(node, nextSibling, scheduler);
                        node._children = nextChildren;
                        bindNodeMixRuntime(node, frame, scheduler, styles);
                        if (isHeadManagedHostNode(node)) {
                            let targetHead = getDocumentHead(domParent);
                            if (targetHead && nextSibling.parentNode !== targetHead) {
                                targetHead.appendChild(nextSibling);
                            }
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
        diffHostProps({}, hostProps, dom);
        if (contentMode === 'innerHTML') {
            dom.innerHTML = hostProps.innerHTML;
        }
        else {
            diffChildren(null, nextChildren, dom, frame, scheduler, styles, node, rootTarget);
        }
        setupHostNode(node, dom, scheduler);
        node._children = nextChildren;
        bindNodeMixRuntime(node, frame, scheduler, styles, false, domParent);
        if (isHeadManagedHostNode(node)) {
            let targetHead = getDocumentHead(domParent);
            if (targetHead) {
                targetHead.appendChild(dom);
            }
            else {
                doInsert(dom);
            }
        }
        else {
            doInsert(dom);
        }
        return cursor;
    }
    if (isFragmentNode(node)) {
        // Insert fragment children in order before the same anchor
        for (let child of node._children) {
            cursor = insert(child, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor);
        }
        return cursor;
    }
    if (isComponentNode(node)) {
        return diffComponent(null, node, frame, scheduler, styles, domParent, vParent, rootTarget, anchor, cursor);
    }
    if (node.type === Frame) {
        return insertFrame(node, domParent, frame, styles, vParent, anchor, cursor);
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
export function renderComponent(handle, currContent, next, domParent, frame, scheduler, styles, rootTarget, vParent, anchor, cursor) {
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
    teardownNode(node, 'cleanup', document.body ?? document, scheduler, styles);
}
export function remove(node, domParent, scheduler, styles) {
    teardownNode(node, 'remove', domParent, scheduler, styles);
}
function teardownNode(node, mode, domParent, scheduler, styles) {
    if (isCommittedTextNode(node)) {
        if (mode === 'remove') {
            node._dom.parentNode?.removeChild(node._dom);
        }
        return;
    }
    if (isCommittedHostNode(node)) {
        teardownHostNode(node, mode, domParent, scheduler, styles);
        return;
    }
    if (isFragmentNode(node)) {
        for (let child of node._children) {
            teardownNode(child, mode, domParent, scheduler, styles);
        }
        return;
    }
    if (isCommittedComponentNode(node)) {
        teardownNode(node._content, mode, domParent, scheduler, styles);
        let tasks = node._handle.remove();
        scheduler.enqueueTasks(tasks);
        return;
    }
    if (node.type === Frame) {
        disposeFrameResources(node);
        if (mode === 'remove') {
            removeFrameDomRange(node, domParent);
        }
        return;
    }
}
function teardownHostNode(node, mode, domParent, scheduler, styles) {
    if (mode === 'remove') {
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
                finalizeHostNodeTeardown(node, 'remove', scheduler, styles);
            });
            return;
        }
    }
    finalizeHostNodeTeardown(node, mode, scheduler, styles);
}
function finalizeHostNodeTeardown(node, mode, scheduler, styles) {
    if (isHeadHostNode(node)) {
        let childMode = mode === 'remove' ? 'remove' : 'cleanup';
        for (let child of node._children) {
            teardownNode(child, childMode, node._dom, scheduler, styles);
        }
    }
    else {
        for (let child of node._children) {
            teardownNode(child, 'cleanup', node._dom, scheduler, styles);
        }
    }
    teardownMixins(node._mixState);
    teardownControlledReflection(node);
    if (mode === 'remove' && !isHeadHostNode(node)) {
        node._dom.parentNode?.removeChild(node._dom);
    }
    if (node._controller)
        node._controller.abort();
}
function diffChildren(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, cursor, anchor) {
    let nextLength = next.length;
    // Warn when duplicate keys are present among siblings. Duplicate keys are
    // still processed (last one wins), but they make keyed diffing ambiguous.
    let hasKeys = false;
    let seenKeys = new Set();
    let duplicateKeys = new Set();
    for (let i = 0; i < nextLength; i++) {
        let node = next[i];
        if (node && node.key != null) {
            hasKeys = true;
            if (seenKeys.has(node.key)) {
                duplicateKeys.add(node.key);
            }
            else {
                seenKeys.add(node.key);
            }
        }
    }
    if (duplicateKeys.size > 0) {
        let quotedKeys = Array.from(duplicateKeys, (key) => `"${key}"`);
        console.warn(`Duplicate keys detected in siblings: ${quotedKeys.join(', ')}. Keys should be unique.`);
    }
    // Initial mount / hydration: delegate to insert() for each child so that
    // hydration cursors and creation logic remain centralized there.
    if (curr === null) {
        for (let node of next) {
            cursor = insert(node, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor);
        }
        vParent._children = next;
        return cursor;
    }
    let currLength = curr.length;
    // Detect if any keys are present in the new children. If not, we can fall
    // back to the simpler index-based diff which is cheaper and matches
    // pre-existing behavior.
    if (!hasKeys) {
        for (let i = 0; i < nextLength; i++) {
            let currentNode = i < currLength ? curr[i] : null;
            diffVNodes(currentNode, next[i], domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor);
        }
        if (currLength > nextLength) {
            for (let i = nextLength; i < currLength; i++) {
                let node = curr[i];
                if (node)
                    remove(node, domParent, scheduler, styles);
            }
        }
        vParent._children = next;
        return;
    }
    // --- O(n + m) keyed diff with Map-based lookup ------------------------------
    let oldChildren = curr;
    let oldChildrenLength = currLength;
    let remainingOldChildren = oldChildrenLength;
    // Build key → index map for O(1) lookup: O(m)
    let oldKeyMap = new Map();
    for (let i = 0; i < oldChildrenLength; i++) {
        let c = oldChildren[i];
        if (c) {
            c._flags = 0;
            if (c.key != null) {
                oldKeyMap.set(c.key, i);
            }
        }
    }
    let skew = 0;
    let newChildren = new Array(nextLength);
    // First pass: match new children to old ones using Map lookup: O(n)
    for (let i = 0; i < nextLength; i++) {
        let childVNode = next[i];
        if (!childVNode) {
            newChildren[i] = childVNode;
            continue;
        }
        newChildren[i] = childVNode;
        childVNode._parent = vParent;
        let skewedIndex = i + skew;
        let matchingIndex = -1;
        let key = childVNode.key;
        let type = childVNode.type;
        if (key != null) {
            // O(1) Map lookup for keyed children
            let mapIndex = oldKeyMap.get(key);
            if (mapIndex !== undefined) {
                let candidate = oldChildren[mapIndex];
                let candidateFlags = candidate?._flags ?? 0;
                if (candidate && (candidateFlags & MATCHED) === 0 && candidate.type === type) {
                    matchingIndex = mapIndex;
                }
            }
        }
        else {
            // Non-keyed children use positional identity only - no searching
            let searchVNode = oldChildren[skewedIndex];
            let searchFlags = searchVNode?._flags ?? 0;
            let available = searchVNode != null && (searchFlags & MATCHED) === 0;
            if (available && searchVNode.key == null && type === searchVNode.type) {
                matchingIndex = skewedIndex;
            }
        }
        childVNode._index = matchingIndex;
        let matchedOldVNode = null;
        if (matchingIndex !== -1) {
            matchedOldVNode = oldChildren[matchingIndex];
            remainingOldChildren--;
            if (matchedOldVNode) {
                matchedOldVNode._flags = (matchedOldVNode._flags ?? 0) | MATCHED;
            }
        }
        // Determine whether this is a mount vs move and mark INSERT_VNODE
        let oldDom = matchedOldVNode && findFirstDomAnchor(matchedOldVNode);
        let isMounting = !matchedOldVNode || !oldDom;
        if (isMounting) {
            if (matchingIndex === -1) {
                // Adjust skew similar to Preact when lengths differ
                if (nextLength > oldChildrenLength) {
                    skew--;
                }
                else if (nextLength < oldChildrenLength) {
                    skew++;
                }
            }
            childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE;
        }
        else if (matchingIndex !== i + skew) {
            if (matchingIndex === i + skew - 1) {
                skew--;
            }
            else if (matchingIndex === i + skew + 1) {
                skew++;
            }
            else {
                if (matchingIndex > i + skew)
                    skew--;
                else
                    skew++;
                childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE;
            }
        }
    }
    // Unmount any old children that weren't matched
    if (remainingOldChildren) {
        for (let i = 0; i < oldChildrenLength; i++) {
            let oldVNode = oldChildren[i];
            if (oldVNode && ((oldVNode._flags ?? 0) & MATCHED) === 0) {
                remove(oldVNode, domParent, scheduler, styles);
            }
        }
    }
    // Second pass: diff matched pairs and place/move DOM nodes in the correct
    // order, similar to Preact's diffChildren + insert.
    vParent._children = newChildren;
    let lastPlaced = null;
    for (let i = 0; i < nextLength; i++) {
        let childVNode = newChildren[i];
        if (!childVNode)
            continue;
        let idx = childVNode._index ?? -1;
        let oldVNode = idx >= 0 ? oldChildren[idx] : null;
        diffVNodes(oldVNode, childVNode, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor);
        let shouldPlace = (childVNode._flags ?? 0) & INSERT_VNODE;
        let firstDom = findFirstDomAnchor(childVNode);
        let lastDom = firstDom ? findLastDomAnchor(childVNode) : null;
        if (shouldPlace && firstDom && lastDom && firstDom.parentNode === domParent) {
            let target;
            if (lastPlaced === null) {
                if (vParent._rangeStart && vParent._rangeStart.parentNode === domParent) {
                    target = vParent._rangeStart.nextSibling;
                }
                else {
                    target = domParent.firstChild;
                }
            }
            else {
                target = lastPlaced.nextSibling;
            }
            if (target === null && anchor)
                target = anchor;
            // If target lies within the range we're moving, skip the move.
            if (target && domRangeContainsNode(firstDom, lastDom, target)) {
                // no-op
            }
            else if (firstDom !== target) {
                moveDomRange(domParent, firstDom, lastDom, target);
            }
        }
        if (lastDom)
            lastPlaced = lastDom;
        // Clear internal flags for next diff
        childVNode._flags = 0;
        childVNode._index = undefined;
    }
    return;
}
function reclaimPersistedMixinNode(persistedNode, newNode, frame, scheduler, styles, vParent, rootTarget) {
    cancelPendingMixinRemoval(persistedNode._mixState);
    unmarkNodePersistedByMixins(persistedNode);
    newNode._dom = persistedNode._dom;
    newNode._parent = vParent;
    newNode._controller = persistedNode._controller;
    newNode._mixState = persistedNode._mixState;
    newNode._controlledState = persistedNode._controlledState;
    let prevProps = getHostProps(persistedNode);
    let nextProps = resolveNodeMixProps(newNode, frame, scheduler, newNode._mixState);
    let prevContentMode = getHostContentMode(prevProps);
    let nextContentMode = getHostContentMode(nextProps);
    let nextChildren = getCanonicalHostChildren(nextContentMode, newNode._children);
    if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
        dispatchMixinBeforeUpdate(newNode._mixState);
    }
    if (nextContentMode === 'innerHTML') {
        if (prevProps.innerHTML !== nextProps.innerHTML) {
            persistedNode._dom.innerHTML = nextProps.innerHTML;
        }
        if (persistedNode._children.length > 0) {
            for (let child of persistedNode._children) {
                cleanupDescendants(child, scheduler, styles);
            }
        }
    }
    else {
        if (prevContentMode === 'innerHTML') {
            persistedNode._dom.innerHTML = '';
        }
        diffChildren(persistedNode._children, nextChildren, persistedNode._dom, frame, scheduler, styles, newNode, rootTarget);
    }
    diffHostProps(prevProps, nextProps, persistedNode._dom);
    ensureControlledReflection(newNode, scheduler);
    syncControlledReflection(newNode, nextProps);
    newNode._children = nextChildren;
    bindNodeMixRuntime(newNode, frame, scheduler, styles, true);
    if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
        scheduler.enqueueTasks([
            () => dispatchMixinCommit(newNode._mixState),
        ]);
    }
}
//# sourceMappingURL=reconcile.js.map