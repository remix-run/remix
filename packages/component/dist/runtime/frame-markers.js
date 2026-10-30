import { invariant } from './invariant.js';
export function isCommentNode(node) {
    return node?.nodeType === Node.COMMENT_NODE;
}
export function isFrameStart(node) {
    return isCommentNode(node) && node.data.trim().startsWith('rmx:f:');
}
export function isFrameEnd(node) {
    return isCommentNode(node) && node.data.trim() === '/rmx:f';
}
export function isHydrationStart(node) {
    return isCommentNode(node) && node.data.trim().startsWith('rmx:h:');
}
export function isHydrationEnd(node) {
    return isCommentNode(node) && node.data.trim() === '/rmx:h';
}
export function getFrameId(start) {
    let trimmed = start.data.trim();
    invariant(trimmed.startsWith('rmx:f:'), 'Invalid frame start marker');
    return trimmed.slice('rmx:f:'.length);
}
export function findEndMarker(start, isStart, isEnd, message = 'End marker not found') {
    let node = start.nextSibling;
    let depth = 1;
    while (node) {
        if (isStart(node))
            depth++;
        else if (isEnd(node)) {
            depth--;
            if (depth === 0)
                return node;
        }
        node = node.nextSibling;
    }
    throw new Error(message);
}
export function collectNodesBetween(start, end) {
    let nodes = [];
    let node = start.nextSibling;
    while (node && node !== end) {
        nodes.push(node);
        node = node.nextSibling;
    }
    return nodes;
}
//# sourceMappingURL=frame-markers.js.map