const HMR_TIMESTAMP_QUERY_SEGMENT_PATTERN = /^t=\d{13}$/;
export function getClientEntryKey(identity) {
    return JSON.stringify([getClientEntryComparisonUrl(identity.moduleUrl), identity.exportName]);
}
function getHmrTimestampQuerySegmentIndex(querySegments) {
    let timestampIndex = -1;
    for (let index = 0; index < querySegments.length; index++) {
        if (!HMR_TIMESTAMP_QUERY_SEGMENT_PATTERN.test(querySegments[index]))
            continue;
        if (timestampIndex !== -1)
            return null;
        timestampIndex = index;
    }
    return timestampIndex === -1 ? null : timestampIndex;
}
function getClientEntryComparisonUrl(moduleUrl) {
    let hashIndex = moduleUrl.indexOf('#');
    let urlWithoutHash = hashIndex === -1 ? moduleUrl : moduleUrl.slice(0, hashIndex);
    let hash = hashIndex === -1 ? '' : moduleUrl.slice(hashIndex);
    let queryIndex = urlWithoutHash.indexOf('?');
    if (queryIndex === -1)
        return moduleUrl;
    let pathname = urlWithoutHash.slice(0, queryIndex);
    let query = urlWithoutHash.slice(queryIndex + 1);
    let querySegments = query.split('&');
    let timestampIndex = getHmrTimestampQuerySegmentIndex(querySegments);
    if (timestampIndex === null)
        return moduleUrl;
    querySegments.splice(timestampIndex, 1);
    let comparisonQuery = querySegments.length > 0 ? `?${querySegments.join('&')}` : '';
    return `${pathname}${comparisonQuery}${hash}`;
}
const CLIENT_ENTRY_BOUNDARY_OWNER = Symbol('ClientEntryBoundaryOwner');
export function getClientEntryBoundaryOwner(marker) {
    return marker[CLIENT_ENTRY_BOUNDARY_OWNER];
}
export function setClientEntryBoundaryOwner(marker, end, identity, root) {
    let owner = { end, identity, root };
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