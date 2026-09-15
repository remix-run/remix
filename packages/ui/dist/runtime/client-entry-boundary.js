export function getClientEntryKey(identity) {
    return `${getClientEntryComparisonUrl(identity.moduleUrl)}#${identity.exportName}`;
}
function getClientEntryComparisonUrl(moduleUrl) {
    // remix/assets and other dev servers append millisecond timestamps to updated modules without changing their identity.
    return moduleUrl.replace(/^([^?#]*)\?t=\d{13,}$/, '$1');
}
const CLIENT_ENTRY_BOUNDARY_OWNER = Symbol('ClientEntryBoundaryOwner');
export function getClientEntryBoundaryOwner(marker) {
    return marker[CLIENT_ENTRY_BOUNDARY_OWNER];
}
export function setClientEntryBoundaryOwner(marker, identity, root) {
    let owner = { identity, root };
    Object.defineProperties(marker, {
        [CLIENT_ENTRY_BOUNDARY_OWNER]: {
            configurable: true,
            value: owner,
        },
        $rmx: {
            configurable: true,
            value: root,
        },
    });
    return owner;
}
export function disposeClientEntryBoundary(marker) {
    let boundaryMarker = marker;
    let owner = boundaryMarker[CLIENT_ENTRY_BOUNDARY_OWNER];
    if (!owner)
        return false;
    delete boundaryMarker[CLIENT_ENTRY_BOUNDARY_OWNER];
    delete boundaryMarker.$rmx;
    owner.root.dispose();
    return true;
}
//# sourceMappingURL=client-entry-boundary.js.map