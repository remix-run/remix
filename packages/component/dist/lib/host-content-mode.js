export function getHostContentMode(props) {
    return props.innerHTML != null ? 'innerHTML' : 'children';
}
export function getCanonicalHostChildren(mode, children) {
    return mode === 'innerHTML' ? [] : children;
}
//# sourceMappingURL=host-content-mode.js.map