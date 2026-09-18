const FLUSH_MARKER_PATTERN = /<!--\s*rmx:flush\s+(document|fragment)\s*-->/g;
export function appendFlushMarker(html, kind) {
    return `${html}<!-- rmx:flush ${kind} -->`;
}
export function stripFlushMarkers(html) {
    FLUSH_MARKER_PATTERN.lastIndex = 0;
    return html.replace(FLUSH_MARKER_PATTERN, '');
}
export function findFlushMarker(html, startIndex) {
    FLUSH_MARKER_PATTERN.lastIndex = startIndex;
    let match = FLUSH_MARKER_PATTERN.exec(html);
    if (!match)
        return undefined;
    return {
        index: match.index,
        endIndex: FLUSH_MARKER_PATTERN.lastIndex,
        kind: match[1],
    };
}
//# sourceMappingURL=stream-protocol.js.map