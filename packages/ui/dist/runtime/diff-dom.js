import { invariant } from './invariant.js';
import { disposeClientEntryBoundary, getClientEntryBoundaryOwner } from './client-entry-boundary.js';
import { findFrameEndMarkerIndex, findHydrationEndMarkerIndex, getFrameEndMarker, getFrameMarkerId, getHydrationEndMarker, getHydrationMarkerId, isCommentNode, isFrameEndMarker, isFrameStartMarker, isHydrationEndMarker, isHydrationStartMarker, } from './core/markers.js';
const REMIX_PRESERVE_DOM_ATTRIBUTE = 'data-rmx-preserve-dom';
export function diffNodes(curr, next, context) {
    let parent = curr[0]?.parentNode ?? context.regionParent ?? null;
    invariant(parent, 'Parent node not found');
    // When diffing a bounded region (e.g. between frame comments), we should insert new
    // nodes before the region tail ref rather than appending to the parent.
    let regionTailRef = context.regionTailRef ??
        (curr.length > 0 ? curr[curr.length - 1].nextSibling : null);
    diffSiblingUnits(curr, next, parent, regionTailRef, context);
}
function diffNode(current, next, context) {
    // Text -> Text
    if (isTextNode(current) && isTextNode(next)) {
        let newText = next.textContent || '';
        if (current.textContent !== newText)
            current.textContent = newText;
        return;
    }
    // Hydration marker range -> Hydration marker range
    if (isHydrationStartMarker(current) && isHydrationStartMarker(next)) {
        let nextData = next.data;
        if (current.data !== nextData) {
            current.data = nextData;
        }
        let end = getHydrationEndMarker(next);
        // Fast-forward across this hydrated region.
        return end;
    }
    // Comment -> Comment
    if (isCommentNode(current) && isCommentNode(next) && markerKindsMatch(current, next)) {
        let newData = next.data;
        let updated = false;
        if (isFrameStartMarker(current)) {
            if (shouldPreserveFrameStartMarker(current, next, context)) {
                if (current.data !== newData) {
                    current.data = newData;
                }
                updated = true;
                let frame = context.frameInstances.get(current);
                let nextMarkerData = getFrameMarkerData(next, context);
                if (frame && nextMarkerData) {
                    if (nextMarkerData.status === 'resolved') {
                        let nextEnd = getFrameEndMarker(next);
                        let nextContent = collectFrameContentFragment(current.ownerDocument, next, nextEnd);
                        let render = frame.renderMarkerContent({ ...nextMarkerData, id: getFrameMarkerId(next) }, nextContent, {
                            data: context.data,
                            signal: context.signal,
                            reconciliationTracker: context.reconciliationTracker,
                        });
                        if (context.reconciliationTracker)
                            context.reconciliationTracker.waitFor(render);
                        else
                            void render;
                        return nextEnd;
                    }
                    if (frame.isDisplayingResolvedContent()) {
                        return getFrameEndMarker(next);
                    }
                }
            }
            else if (current.data !== newData) {
                disposeFrameStartMarker(current, context);
                current.data = newData;
                updated = true;
            }
        }
        if (!updated && current.data !== newData) {
            current.data = newData;
        }
        return;
    }
    // Element -> Element
    if (isElement(current) && isElement(next)) {
        // Different tags: replace
        if (current.tagName !== next.tagName) {
            let parent = current.parentNode;
            if (parent) {
                parent.insertBefore(next, current);
                removeNode(current, parent, context);
            }
            return;
        }
        // Same tag: update attributes then children
        if (shouldPreserveDomElement(current, next))
            return;
        diffElementAttributes(current, next);
        if (shouldPreserveElementChildren(current, next))
            return;
        diffElementChildren(current, next, context);
        return;
    }
    // Type mismatch: replace
    let parent = current.parentNode;
    if (parent) {
        parent.insertBefore(next, current);
        removeNode(current, parent, context);
    }
}
function diffElementAttributes(current, next) {
    let prevAttrNames = current.getAttributeNames();
    let nextAttrNames = next.getAttributeNames();
    let nextNameSet = new Set(nextAttrNames);
    // Removals
    for (let name of prevAttrNames) {
        if (!nextNameSet.has(name)) {
            if (shouldPreserveLiveAttribute(current, next, name))
                continue;
            current.removeAttribute(name);
        }
    }
    // Additions/updates
    for (let name of nextAttrNames) {
        let prevVal = current.getAttribute(name);
        let nextVal = next.getAttribute(name);
        if (prevVal !== nextVal) {
            if (shouldPreserveLiveAttribute(current, next, name))
                continue;
            current.setAttribute(name, nextVal == null ? '' : String(nextVal));
        }
    }
}
function shouldPreserveDomElement(current, next) {
    if (!next.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE))
        return false;
    if (!current.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE)) {
        current.setAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE, '');
    }
    return true;
}
function shouldPreserveLiveAttribute(current, next, name) {
    if (name === 'open') {
        if (current instanceof HTMLDetailsElement && next instanceof HTMLDetailsElement) {
            return current.open !== next.open;
        }
        if (current instanceof HTMLDialogElement && next instanceof HTMLDialogElement) {
            return current.open !== next.open;
        }
    }
    if (name === 'checked') {
        if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
            return current.checked !== next.checked;
        }
    }
    if (name === 'value') {
        if (current instanceof HTMLInputElement &&
            next instanceof HTMLInputElement &&
            shouldPreserveInputValue(current)) {
            return current.value !== next.value;
        }
    }
    if (name === 'selected') {
        if (current instanceof HTMLOptionElement && next instanceof HTMLOptionElement) {
            return current.selected !== next.selected;
        }
    }
    if (name === 'popover') {
        return isPopoverOpen(current) !== isPopoverOpen(next);
    }
    return false;
}
function shouldPreserveElementChildren(current, next) {
    if (current instanceof HTMLTextAreaElement && next instanceof HTMLTextAreaElement) {
        return current.value !== next.value;
    }
    return false;
}
function shouldPreserveInputValue(input) {
    return (input.type !== 'button' &&
        input.type !== 'checkbox' &&
        input.type !== 'hidden' &&
        input.type !== 'image' &&
        input.type !== 'radio' &&
        input.type !== 'reset' &&
        input.type !== 'submit');
}
function isPopoverOpen(element) {
    try {
        return element.matches(':popover-open');
    }
    catch {
        return false;
    }
}
function diffElementChildren(current, next, context) {
    let currentChildren;
    // Allow actively managed preload link tags in the head to stay in the document
    // during diffing rather than removing them which aborts the preload in Safari
    if (context.isActiveModulePreload && current === current.ownerDocument.head) {
        currentChildren = [];
        for (let node of current.childNodes) {
            if (!context.isActiveModulePreload(node))
                currentChildren.push(node);
        }
    }
    else {
        currentChildren = Array.from(current.childNodes);
    }
    let nextChildren = Array.from(next.childNodes);
    diffSiblingUnits(currentChildren, nextChildren, current, null, context);
}
function diffSiblingUnits(currentNodes, nextNodes, parent, regionTailRef, context) {
    let currentUnits = parseSiblingUnits(currentNodes);
    let nextUnits = parseSiblingUnits(nextNodes);
    let keyToIndex = new Map();
    for (let i = 0; i < currentUnits.length; i++) {
        let key = getSiblingUnitKey(currentUnits[i]);
        if (key !== undefined)
            keyToIndex.set(key, i);
    }
    let used = new Array(currentUnits.length).fill(false);
    let matchIndexForNext = new Array(nextUnits.length).fill(-1);
    // Reserve globally matched keyed elements and semantic boundaries before
    // positionally pairing the remaining ordinary siblings.
    for (let i = 0; i < nextUnits.length; i++) {
        let nextUnit = nextUnits[i];
        let matchIndex = -1;
        let key = getSiblingUnitKey(nextUnit);
        if (key !== undefined) {
            let keyedIndex = keyToIndex.get(key);
            if (keyedIndex !== undefined &&
                !used[keyedIndex] &&
                siblingUnitsComparable(currentUnits[keyedIndex], nextUnit)) {
                matchIndex = keyedIndex;
            }
        }
        // Boundary identities behave like implicit keys. Repeated boundaries with
        // the same identity are paired in source order because server markers do
        // not carry a separate application key.
        if (matchIndex === -1 && nextUnit.kind !== 'node') {
            for (let j = 0; j < currentUnits.length; j++) {
                let currentUnit = currentUnits[j];
                if (used[j] || currentUnit.kind !== nextUnit.kind)
                    continue;
                if (shouldPreserveBoundaryUnit(currentUnit, nextUnit, context)) {
                    matchIndex = j;
                    break;
                }
            }
        }
        if (matchIndex !== -1)
            used[matchIndex] = true;
        matchIndexForNext[i] = matchIndex;
    }
    let remainingCurrentIndexes = [];
    for (let i = 0; i < currentUnits.length; i++) {
        if (!used[i])
            remainingCurrentIndexes.push(i);
    }
    let remainingNextIndexes = [];
    for (let i = 0; i < nextUnits.length; i++) {
        if (matchIndexForNext[i] === -1)
            remainingNextIndexes.push(i);
    }
    let remainingLength = Math.min(remainingCurrentIndexes.length, remainingNextIndexes.length);
    for (let i = 0; i < remainingLength; i++) {
        let currentIndex = remainingCurrentIndexes[i];
        let nextIndex = remainingNextIndexes[i];
        let currentUnit = currentUnits[currentIndex];
        let nextUnit = nextUnits[nextIndex];
        if (currentUnit.kind !== 'node' ||
            nextUnit.kind !== 'node' ||
            getSiblingUnitKey(currentUnit) !== undefined ||
            getSiblingUnitKey(nextUnit) !== undefined ||
            !siblingUnitsComparable(currentUnit, nextUnit)) {
            continue;
        }
        used[currentIndex] = true;
        matchIndexForNext[nextIndex] = currentIndex;
    }
    let committed = new Array(nextUnits.length);
    for (let i = 0; i < nextUnits.length; i++) {
        let matchIndex = matchIndexForNext[i];
        let nextUnit = nextUnits[i];
        if (matchIndex === -1) {
            committed[i] = nextUnit;
            continue;
        }
        let currentUnit = currentUnits[matchIndex];
        if (currentUnit.kind === 'node' && nextUnit.kind === 'node') {
            diffNode(currentUnit.node, nextUnit.node, context);
            committed[i] = currentUnit;
            continue;
        }
        invariant(currentUnit.kind !== 'node' && nextUnit.kind !== 'node', 'Expected boundaries');
        let replacement = getCommentMarkerRangeReplacement(currentUnit.start, nextUnit.start, currentNodes, nextNodes, currentUnit.startIndex, nextUnit.startIndex, context);
        if (replacement) {
            replaceCommentMarkerRange(replacement, parent, context);
            committed[i] = nextUnit;
            continue;
        }
        let cursor = diffNode(currentUnit.start, nextUnit.start, context);
        if (!cursor && currentUnit.kind === 'frame' && nextUnit.kind === 'frame') {
            diffNodes(collectNodesBetween(currentUnit.start, currentUnit.end), nextNodes.slice(nextUnit.startIndex + 1, nextUnit.endIndex), {
                ...context,
                regionParent: parent,
                regionTailRef: currentUnit.end,
            });
        }
        committed[i] = currentUnit;
    }
    let anchor = regionTailRef;
    for (let i = committed.length - 1; i >= 0; i--) {
        let unit = committed[i];
        let first = getSiblingUnitFirstNode(unit);
        let ref = anchor?.parentNode === parent ? anchor : null;
        if (unit.kind === 'node' &&
            isPreservedDomElement(unit.node) &&
            unit.node.parentNode === parent) {
            anchor = unit.node;
            continue;
        }
        placeSiblingUnitBefore(unit, parent, ref);
        if (first.parentNode === parent)
            anchor = first;
    }
    for (let i = 0; i < currentUnits.length; i++) {
        if (!used[i])
            removeSiblingUnit(currentUnits[i], parent, context);
    }
}
function parseSiblingUnits(nodes) {
    let units = [];
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        if (isHydrationStartMarker(node)) {
            let endIndex = findHydrationEndMarkerIndex(nodes, i);
            invariant(endIndex > i, 'Hydration end marker not found');
            let end = nodes[endIndex];
            invariant(isHydrationEndMarker(end), 'Expected hydration end marker');
            units.push({ kind: 'hydration', start: node, end, startIndex: i, endIndex });
            i = endIndex;
            continue;
        }
        if (isFrameStartMarker(node)) {
            let endIndex = findFrameEndMarkerIndex(nodes, i);
            invariant(endIndex > i, 'Frame end marker not found');
            let end = nodes[endIndex];
            invariant(isFrameEndMarker(end), 'Expected frame end marker');
            units.push({ kind: 'frame', start: node, end, startIndex: i, endIndex });
            i = endIndex;
            continue;
        }
        invariant(!isHydrationEndMarker(node), 'Unexpected hydration end marker');
        invariant(!isFrameEndMarker(node), 'Unexpected frame end marker');
        units.push({ kind: 'node', node, startIndex: i, endIndex: i });
    }
    return units;
}
function getSiblingUnitKey(unit) {
    if (unit.kind !== 'node' || !isElement(unit.node))
        return;
    return unit.node.getAttribute('data-rmx-key') ?? undefined;
}
function siblingUnitsComparable(current, next) {
    if (current.kind !== next.kind)
        return false;
    if (current.kind !== 'node' || next.kind !== 'node')
        return true;
    return nodeTypesComparable(current.node, next.node);
}
function shouldPreserveBoundaryUnit(current, next, context) {
    if (current.kind !== next.kind)
        return false;
    return current.kind === 'frame'
        ? shouldPreserveFrameStartMarker(current.start, next.start, context)
        : shouldPreserveHydrationStartMarker(current.start, next.start, context);
}
function getSiblingUnitFirstNode(unit) {
    return unit.kind === 'node' ? unit.node : unit.start;
}
function placeSiblingUnitBefore(unit, parent, ref) {
    if (unit.kind === 'node') {
        if (unit.node.parentNode !== parent || unit.node.nextSibling !== ref) {
            parent.insertBefore(unit.node, ref);
        }
        return;
    }
    let nodes = collectNodeRange(unit.start, unit.end);
    if (unit.start.parentNode === parent && unit.end.nextSibling === ref)
        return;
    let fragment = unit.start.ownerDocument.createDocumentFragment();
    for (let node of nodes)
        fragment.appendChild(node);
    parent.insertBefore(fragment, ref);
}
function removeSiblingUnit(unit, parent, context) {
    if (unit.kind === 'node') {
        removeNode(unit.node, parent, context);
        return;
    }
    for (let node of collectNodeRange(unit.start, unit.end)) {
        removeNode(node, parent, context);
    }
}
function collectNodesBetween(start, end) {
    let nodes = [];
    let node = start.nextSibling;
    while (node && node !== end) {
        nodes.push(node);
        node = node.nextSibling;
    }
    return nodes;
}
function isPreservedDomElement(node) {
    return isElement(node) && node.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE);
}
function nodeTypesComparable(a, b) {
    if (isTextNode(a) && isTextNode(b))
        return true;
    if (isElement(a) && isElement(b))
        return a.tagName === b.tagName;
    if (isCommentNode(a) && isCommentNode(b))
        return markerKindsMatch(a, b);
    return false;
}
function getMarkerKind(node) {
    if (!isCommentNode(node))
        return undefined;
    if (isFrameStartMarker(node))
        return 'frame-start';
    if (isFrameEndMarker(node))
        return 'frame-end';
    if (isHydrationStartMarker(node))
        return 'hydration-start';
    if (isHydrationEndMarker(node))
        return 'hydration-end';
    return undefined;
}
function markerKindsMatch(a, b) {
    return getMarkerKind(a) === getMarkerKind(b);
}
function isTextNode(node) {
    return node.nodeType === Node.TEXT_NODE;
}
function isElement(node) {
    return node.nodeType === Node.ELEMENT_NODE;
}
function shouldPreserveFrameStartMarker(current, next, context) {
    if (!isFrameStartMarker(next))
        return false;
    let nextData = getFrameMarkerData(next, context);
    let currentFrame = context.frameInstances.get(current);
    return (currentFrame !== undefined &&
        nextData !== undefined &&
        currentFrame.matchesIdentity(nextData.src, nextData.name));
}
function shouldPreserveHydrationStartMarker(current, next, context) {
    if (!isHydrationStartMarker(next))
        return false;
    let currentOwner = getClientEntryBoundaryOwner(current);
    let nextData = getHydrationMarkerData(next, context);
    return (currentOwner !== undefined &&
        nextData !== undefined &&
        currentOwner.identity.moduleUrl === nextData.moduleUrl &&
        currentOwner.identity.exportName === nextData.exportName);
}
function getCommentMarkerRangeReplacement(current, next, currentNodes, nextNodes, currentIndex, nextIndex, context) {
    // Comment markers can represent owned DOM ranges, not standalone comments. If
    // the incoming range no longer has the same identity, replace the whole range
    // before regular node diffing mutates either marker.
    if (isFrameStartMarker(current) &&
        isFrameStartMarker(next) &&
        !shouldPreserveFrameStartMarker(current, next, context)) {
        return {
            currentStart: current,
            nextStart: next,
            currentEndIndex: findFrameEndMarkerIndex(currentNodes, currentIndex),
            nextEndIndex: findFrameEndMarkerIndex(nextNodes, nextIndex),
        };
    }
    if (isHydrationStartMarker(current) &&
        isHydrationStartMarker(next) &&
        !shouldPreserveHydrationStartMarker(current, next, context)) {
        return {
            currentStart: current,
            nextStart: next,
            currentEndIndex: findHydrationEndMarkerIndex(currentNodes, currentIndex),
            nextEndIndex: findHydrationEndMarkerIndex(nextNodes, nextIndex),
        };
    }
}
function getHydrationMarkerData(marker, context) {
    let id = getHydrationMarkerId(marker);
    return context.data.h?.[id];
}
function getFrameMarkerData(marker, context) {
    let id = getFrameMarkerId(marker);
    return context.data.f?.[id];
}
function replaceCommentMarkerRange(replacement, parent, context) {
    let currentEnd = findCommentMarkerRangeEnd(replacement.currentStart);
    let nextEnd = findCommentMarkerRangeEnd(replacement.nextStart);
    let nextNodes = collectNodeRange(replacement.nextStart, nextEnd);
    let currentNodes = collectNodeRange(replacement.currentStart, currentEnd);
    for (let node of nextNodes) {
        parent.insertBefore(node, replacement.currentStart);
    }
    for (let node of currentNodes) {
        removeNode(node, parent, context);
    }
}
function findCommentMarkerRangeEnd(start) {
    if (isFrameStartMarker(start))
        return getFrameEndMarker(start);
    if (isHydrationStartMarker(start))
        return getHydrationEndMarker(start);
    throw new Error('Comment marker range start not found');
}
function collectNodeRange(start, end) {
    let nodes = [];
    let node = start;
    while (node) {
        nodes.push(node);
        if (node === end)
            break;
        node = node.nextSibling;
    }
    return nodes;
}
function collectFrameContentFragment(doc, start, end) {
    let fragment = doc.createDocumentFragment();
    let node = start.nextSibling;
    while (node && node !== end) {
        let next = node.nextSibling;
        fragment.appendChild(node);
        node = next;
    }
    return fragment;
}
function removeNode(node, parent, context) {
    disposeRemovedVirtualRoots(node);
    disposeRemovedSubFrames(node, context);
    if (node.parentNode === parent) {
        parent.removeChild(node);
    }
}
function disposeRemovedVirtualRoots(node) {
    let stack = [node];
    while (stack.length > 0) {
        let next = stack.pop();
        if (!next)
            continue;
        if (isHydrationStartMarker(next) && disposeClientEntryBoundary(next)) {
            continue;
        }
        for (let child of Array.from(next.childNodes)) {
            stack.push(child);
        }
    }
}
function disposeRemovedSubFrames(node, context) {
    let stack = [node];
    while (stack.length > 0) {
        let next = stack.pop();
        if (!next)
            continue;
        if (isFrameStartMarker(next)) {
            disposeFrameStartMarker(next, context);
        }
        for (let child of Array.from(next.childNodes)) {
            stack.push(child);
        }
    }
}
function disposeFrameStartMarker(marker, context) {
    let subFrame = context.frameInstances.get(marker);
    if (subFrame) {
        subFrame.dispose();
        context.frameInstances.delete(marker);
    }
}
//# sourceMappingURL=diff-dom.js.map