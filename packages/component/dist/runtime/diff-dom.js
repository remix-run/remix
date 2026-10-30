import { invariant } from './invariant.js';
import { disposeClientEntryBoundary, getClientEntryBoundaryOwner, getClientEntryKey, } from './client-entry-boundary.js';
const REMIX_PRESERVE_DOM_ATTRIBUTE = 'data-rmx-preserve-dom';
export function diffNodes(curr, next, context) {
    let parent = curr[0]?.parentNode ?? context.regionParent ?? null;
    invariant(parent, 'Parent node not found');
    // When diffing a bounded region (e.g. between frame comments), we should insert new
    // nodes before the region tail ref rather than appending to the parent.
    let regionTailRef = context.regionTailRef ??
        (curr.length > 0 ? curr[curr.length - 1].nextSibling : null);
    // Frame regions rendered inside the head still hold head resources.
    if (isDocumentHead(parent))
        diffHeadUnits(curr, next, parent, regionTailRef, context);
    else
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
    if (isVirtualRootStartMarker(current) && isVirtualRootStartMarker(next)) {
        let nextData = next.data;
        if (current.data !== nextData) {
            current.data = nextData;
        }
        let end = findHydrationEndMarker(next);
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
                        let nextEnd = findFrameEndMarker(next);
                        let nextContent = collectFrameContentFragment(current.ownerDocument, next, nextEnd);
                        let render = frame.renderMarkerContent({ ...nextMarkerData, id: getFrameId(next) }, nextContent, {
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
                        return findFrameEndMarker(next);
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
export function diffElementAttributes(current, next) {
    let prevAttrNames = current.getAttributeNames();
    let nextAttrNames = next.getAttributeNames();
    let preservedNames = next.getAttribute('data-rmx-preserve-attrs')?.split(/[\t\n\f\r ]+/);
    let nextNameSet = new Set(nextAttrNames);
    // Removals
    for (let name of prevAttrNames) {
        if (preservedNames?.includes(name))
            continue;
        if (!nextNameSet.has(name)) {
            if (shouldPreserveLiveAttribute(current, next, name))
                continue;
            current.removeAttribute(name);
        }
    }
    // Additions/updates
    for (let name of nextAttrNames) {
        if (preservedNames?.includes(name))
            continue;
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
    if (isDocumentHead(current)) {
        diffHeadChildren(current, next, context);
        return;
    }
    diffSiblingUnits(Array.from(current.childNodes), Array.from(next.childNodes), current, null, context);
}
function diffHeadChildren(head, next, context) {
    let shouldPreserveHeadNode = context.shouldPreserveHeadNode;
    let regionTailRef = null;
    let currentChildren = Array.from(head.childNodes);
    if (shouldPreserveHeadNode) {
        // Only preserved nodes after every diffed child can anchor the diff. Using a
        // leading one would move every diffed node in front of it.
        let lastDiffedIndex = currentChildren.findLastIndex((node) => !shouldPreserveHeadNode(node));
        regionTailRef = currentChildren[lastDiffedIndex + 1] ?? null;
        currentChildren = currentChildren.filter((node) => !shouldPreserveHeadNode(node));
    }
    diffHeadUnits(currentChildren, Array.from(next.childNodes), head, regionTailRef, context);
}
function diffHeadUnits(currentNodes, nextNodes, head, regionTailRef, context) {
    let diff = createSiblingDiff(currentNodes, nextNodes, head);
    matchKeyedSiblingUnits(diff, context);
    matchPositionalSiblingUnits(diff);
    matchShiftedHeadUnits(diff);
    let committed = commitSiblingUnits(diff, context);
    removeUnusedSiblingUnits(diff, context);
    placeSiblingUnits(diff, committed, regionTailRef);
}
function diffSiblingUnits(currentNodes, nextNodes, parent, regionTailRef, context) {
    let diff = createSiblingDiff(currentNodes, nextNodes, parent);
    matchKeyedSiblingUnits(diff, context);
    matchPositionalSiblingUnits(diff);
    let committed = commitSiblingUnits(diff, context);
    removeUnusedSiblingUnits(diff, context);
    placeSiblingUnits(diff, committed, regionTailRef);
}
function createSiblingDiff(currentNodes, nextNodes, parent) {
    let currentUnits = parseSiblingUnits(currentNodes);
    let nextUnits = parseSiblingUnits(nextNodes);
    return {
        parent,
        currentNodes,
        nextNodes,
        currentUnits,
        nextUnits,
        used: new Array(currentUnits.length).fill(false),
        matchIndexForNext: new Array(nextUnits.length).fill(-1),
    };
}
// Reserve globally matched keyed elements and semantic boundaries before
// positionally pairing the remaining ordinary siblings.
function matchKeyedSiblingUnits(diff, context) {
    let { currentUnits, nextUnits, used, matchIndexForNext } = diff;
    let keyToIndex = new Map();
    for (let i = 0; i < currentUnits.length; i++) {
        let key = getSiblingUnitKey(currentUnits[i]);
        if (key !== undefined)
            keyToIndex.set(key, i);
    }
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
}
function matchPositionalSiblingUnits(diff) {
    let { currentUnits, nextUnits, used, matchIndexForNext } = diff;
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
            getSiblingUnitKey(nextUnit) !== undefined) {
            continue;
        }
        let identity = getUnkeyedNodeIdentity(currentUnit.node);
        if (identity === undefined || identity !== getUnkeyedNodeIdentity(nextUnit.node))
            continue;
        used[currentIndex] = true;
        matchIndexForNext[nextIndex] = currentIndex;
    }
}
// Head resources are routinely added or removed ahead of shared ones, which
// shifts the shared ones out of positional pairing. Pair what is left in order
// within each identity so they are reused instead of recreated. Outside the
// head this could hand one element's live state, like typed input, to another.
function matchShiftedHeadUnits(diff) {
    let { currentUnits, nextUnits, used, matchIndexForNext } = diff;
    let currentIndexesByIdentity = new Map();
    for (let i = 0; i < currentUnits.length; i++) {
        let currentUnit = currentUnits[i];
        if (used[i] || currentUnit.kind !== 'node' || getSiblingUnitKey(currentUnit) !== undefined) {
            continue;
        }
        let identity = getUnkeyedNodeIdentity(currentUnit.node);
        if (identity === undefined)
            continue;
        let indexes = currentIndexesByIdentity.get(identity);
        if (indexes)
            indexes.push(i);
        else
            currentIndexesByIdentity.set(identity, [i]);
    }
    for (let i = 0; i < nextUnits.length; i++) {
        let nextUnit = nextUnits[i];
        if (matchIndexForNext[i] !== -1 ||
            nextUnit.kind !== 'node' ||
            getSiblingUnitKey(nextUnit) !== undefined) {
            continue;
        }
        let identity = getUnkeyedNodeIdentity(nextUnit.node);
        if (identity === undefined)
            continue;
        let currentIndex = currentIndexesByIdentity.get(identity)?.shift();
        if (currentIndex === undefined)
            continue;
        used[currentIndex] = true;
        matchIndexForNext[i] = currentIndex;
    }
}
// Patches each matched current unit from its next unit and returns the units
// that will occupy each next position.
function commitSiblingUnits(diff, context) {
    let { parent, currentNodes, nextNodes, currentUnits, nextUnits, matchIndexForNext } = diff;
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
    return committed;
}
// Remove obsolete siblings before placement so they do not force surviving
// nodes to move and lose focus.
function removeUnusedSiblingUnits(diff, context) {
    let { parent, currentUnits, used } = diff;
    for (let i = 0; i < currentUnits.length; i++) {
        if (!used[i])
            removeSiblingUnit(currentUnits[i], parent, context);
    }
}
// Moving a node detaches it, which reloads stylesheets, restarts iframes and
// drops focus, so keep the longest run of reused units that are already in
// order where they are and only move the rest around them.
function placeSiblingUnits(diff, committed, regionTailRef) {
    let { parent } = diff;
    let stable = getStableCommittedIndexes(diff, committed);
    let anchor = regionTailRef;
    for (let i = committed.length - 1; i >= 0; i--) {
        let unit = committed[i];
        let first = getSiblingUnitFirstNode(unit);
        let ref = anchor?.parentNode === parent ? anchor : null;
        if ((stable.has(i) || (unit.kind === 'node' && isPreservedDomElement(unit.node))) &&
            first.parentNode === parent) {
            anchor = first;
            continue;
        }
        placeSiblingUnitBefore(unit, parent, ref);
        if (first.parentNode === parent)
            anchor = first;
    }
}
function isDocumentHead(node) {
    return isElement(node) && node === node.ownerDocument.head;
}
function getStableCommittedIndexes(diff, committed) {
    let { parent, currentUnits, matchIndexForNext } = diff;
    let committedIndexes = [];
    let currentIndexes = [];
    for (let i = 0; i < committed.length; i++) {
        let matchIndex = matchIndexForNext[i];
        if (matchIndex === -1 || committed[i] !== currentUnits[matchIndex])
            continue;
        let first = getSiblingUnitFirstNode(committed[i]);
        if (first.parentNode !== parent)
            continue;
        committedIndexes.push(i);
        currentIndexes.push(matchIndex);
    }
    let stable = new Set();
    for (let index of getLongestIncreasingSubsequence(currentIndexes)) {
        stable.add(committedIndexes[index]);
    }
    return stable;
}
// Returns the positions in `values` that form one longest strictly increasing
// subsequence, in O(n log n).
function getLongestIncreasingSubsequence(values) {
    let tails = [];
    let previous = new Array(values.length).fill(-1);
    for (let i = 0; i < values.length; i++) {
        let low = 0;
        let high = tails.length;
        while (low < high) {
            let middle = (low + high) >> 1;
            if (values[tails[middle]] < values[i])
                low = middle + 1;
            else
                high = middle;
        }
        if (low > 0)
            previous[i] = tails[low - 1];
        tails[low] = i;
    }
    let result = new Array(tails.length);
    let index = tails.length > 0 ? tails[tails.length - 1] : -1;
    for (let i = tails.length - 1; i >= 0; i--) {
        result[i] = index;
        index = previous[index];
    }
    return result;
}
function getUnkeyedNodeIdentity(node) {
    if (isTextNode(node))
        return '#text';
    if (isCommentNode(node))
        return `#comment:${getMarkerKind(node) ?? ''}`;
    if (!isElement(node))
        return undefined;
    // A link's rel and href identify the resource it loads, and a meta tag's name
    // identifies what it describes. Morphing one into another would swap
    // stylesheets or start unrelated requests, so they are never paired.
    switch (node.tagName) {
        case 'LINK': {
            let rel = node.getAttribute('rel')?.trim().toLowerCase() ?? '';
            return `LINK:${rel}:${node.getAttribute('href') ?? ''}`;
        }
        case 'META': {
            let name = node.getAttribute('name') ??
                node.getAttribute('property') ??
                node.getAttribute('http-equiv') ??
                (node.hasAttribute('charset') ? 'charset' : '');
            return `META:${name.toLowerCase()}`;
        }
        default:
            return node.tagName;
    }
}
function parseSiblingUnits(nodes) {
    let units = [];
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        if (isVirtualRootStartMarker(node)) {
            let endIndex = findHydrationEndIndex(nodes, i);
            invariant(endIndex > i, 'Hydration end marker not found');
            let end = nodes[endIndex];
            invariant(isVirtualRootEndMarker(end), 'Expected hydration end marker');
            units.push({ kind: 'hydration', start: node, end, startIndex: i, endIndex });
            i = endIndex;
            continue;
        }
        if (isFrameStartMarker(node)) {
            let endIndex = findFrameEndIndex(nodes, i);
            invariant(endIndex > i, 'Frame end marker not found');
            let end = nodes[endIndex];
            invariant(isFrameEndMarker(end), 'Expected frame end marker');
            units.push({ kind: 'frame', start: node, end, startIndex: i, endIndex });
            i = endIndex;
            continue;
        }
        invariant(!isVirtualRootEndMarker(node), 'Unexpected hydration end marker');
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
    if (isVirtualRootStartMarker(node))
        return 'virtual-root-start';
    if (isVirtualRootEndMarker(node))
        return 'virtual-root-end';
    return undefined;
}
function markerKindsMatch(a, b) {
    return getMarkerKind(a) === getMarkerKind(b);
}
function isHydrationEndComment(node) {
    return isCommentNode(node) && node.data.trim() === '/rmx:h';
}
function findHydrationEndMarker(start) {
    let node = start.nextSibling;
    let depth = 1;
    while (node) {
        if (isCommentNode(node)) {
            if (isVirtualRootStartMarker(node))
                depth++;
            if (isVirtualRootEndMarker(node)) {
                depth--;
                if (depth === 0)
                    return node;
            }
        }
        node = node.nextSibling;
    }
    throw new Error('Hydration end marker not found');
}
function findHydrationEndIndex(nodes, startIdx) {
    let depth = 1;
    for (let j = startIdx + 1; j < nodes.length; j++) {
        let node = nodes[j];
        if (isVirtualRootStartMarker(node))
            depth++;
        if (isHydrationEndComment(node)) {
            depth--;
            if (depth === 0)
                return j;
        }
    }
    return startIdx;
}
function findFrameEndMarker(start) {
    let node = start.nextSibling;
    let depth = 1;
    while (node) {
        if (isFrameStartMarker(node))
            depth++;
        if (isFrameEndMarker(node)) {
            depth--;
            if (depth === 0)
                return node;
        }
        node = node.nextSibling;
    }
    throw new Error('Frame end marker not found');
}
function findFrameEndIndex(nodes, startIdx) {
    let depth = 1;
    for (let j = startIdx + 1; j < nodes.length; j++) {
        let node = nodes[j];
        if (isFrameStartMarker(node))
            depth++;
        if (isFrameEndMarker(node)) {
            depth--;
            if (depth === 0)
                return j;
        }
    }
    return startIdx;
}
function isTextNode(node) {
    return node.nodeType === Node.TEXT_NODE;
}
function isElement(node) {
    return node.nodeType === Node.ELEMENT_NODE;
}
function isCommentNode(node) {
    return node.nodeType === Node.COMMENT_NODE;
}
function isFrameStartMarker(node) {
    return node instanceof Comment && node.data.trim().startsWith('rmx:f:');
}
function isFrameEndMarker(node) {
    return node instanceof Comment && node.data.trim() === '/rmx:f';
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
    if (!isVirtualRootStartMarker(next))
        return false;
    let currentOwner = getClientEntryBoundaryOwner(current);
    let nextData = getHydrationMarkerData(next, context);
    return (currentOwner !== undefined &&
        nextData !== undefined &&
        getClientEntryKey(currentOwner.identity) ===
            getClientEntryKey({ moduleUrl: nextData.moduleUrl, exportName: nextData.exportName }));
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
            currentEndIndex: findFrameEndIndex(currentNodes, currentIndex),
            nextEndIndex: findFrameEndIndex(nextNodes, nextIndex),
        };
    }
    if (isVirtualRootStartMarker(current) &&
        isVirtualRootStartMarker(next) &&
        !shouldPreserveHydrationStartMarker(current, next, context)) {
        return {
            currentStart: current,
            nextStart: next,
            currentEndIndex: findHydrationEndIndex(currentNodes, currentIndex),
            nextEndIndex: findHydrationEndIndex(nextNodes, nextIndex),
        };
    }
}
function getHydrationMarkerData(marker, context) {
    let id = getHydrationId(marker);
    return context.data.h?.[id];
}
function getHydrationId(marker) {
    let trimmed = marker.data.trim();
    invariant(trimmed.startsWith('rmx:h:'), 'Invalid hydration start marker');
    return trimmed.slice('rmx:h:'.length);
}
function getFrameMarkerData(marker, context) {
    let id = getFrameId(marker);
    return context.data.f?.[id];
}
function getFrameId(marker) {
    let trimmed = marker.data.trim();
    invariant(trimmed.startsWith('rmx:f:'), 'Invalid frame start marker');
    return trimmed.slice('rmx:f:'.length);
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
        return findFrameEndMarker(start);
    if (isVirtualRootStartMarker(start))
        return findHydrationEndMarker(start);
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
        if (isVirtualRootStartMarker(next) && disposeClientEntryBoundary(next)) {
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
function isVirtualRootStartMarker(node) {
    return isCommentNode(node) && node.data.trim().startsWith('rmx:h:');
}
function isVirtualRootEndMarker(node) {
    return isCommentNode(node) && node.data.trim() === '/rmx:h';
}
//# sourceMappingURL=diff-dom.js.map