const SCOPED_PROTOCOL = 'remix-node-tsx://';
const NAMESPACE_QUERY_PARAMETER = 'remix-node-tsx-namespace';
export function appendNamespaceToUrl(url, namespace) {
    let parsedUrl = new URL(url);
    parsedUrl.searchParams.set(NAMESPACE_QUERY_PARAMETER, namespace);
    return parsedUrl.toString();
}
export function createScopedSpecifier(request) {
    return `${SCOPED_PROTOCOL}${encodeURIComponent(JSON.stringify(request))}`;
}
export function getNamespace(url) {
    if (url == null || !url.includes(`${NAMESPACE_QUERY_PARAMETER}=`)) {
        return undefined;
    }
    return new URL(url).searchParams.get(NAMESPACE_QUERY_PARAMETER) ?? undefined;
}
export function parseScopedSpecifier(specifier) {
    if (!specifier.startsWith(SCOPED_PROTOCOL)) {
        return undefined;
    }
    return JSON.parse(decodeURIComponent(specifier.slice(SCOPED_PROTOCOL.length)));
}
