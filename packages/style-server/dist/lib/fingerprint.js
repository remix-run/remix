const fingerprintedExtensionRE = /^(.+)\.@([A-Za-z0-9_-]+)(\.[^./]+)$/;
const fingerprintedBasenameRE = /^(.+)\.@([A-Za-z0-9_-]+)$/;
export async function hashBytes(bytes) {
    let hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return Buffer.from(hashBuffer).toString('base64url').slice(0, 6);
}
export async function hashContent(content) {
    return hashBytes(new TextEncoder().encode(content));
}
export async function generateFingerprint(options) {
    let buildIdBytes = new TextEncoder().encode(options.buildId);
    let contentBytes = typeof options.content === 'string'
        ? new TextEncoder().encode(options.content)
        : options.content;
    let bytes = new Uint8Array(buildIdBytes.length + 1 + contentBytes.length);
    bytes.set(buildIdBytes, 0);
    bytes.set([0], buildIdBytes.length);
    bytes.set(contentBytes, buildIdBytes.length + 1);
    return hashBytes(bytes);
}
export function parseFingerprintSuffix(pathname) {
    let lastSlashIndex = pathname.lastIndexOf('/');
    let directory = lastSlashIndex >= 0 ? pathname.slice(0, lastSlashIndex + 1) : '';
    let basename = lastSlashIndex >= 0 ? pathname.slice(lastSlashIndex + 1) : pathname;
    let extensionMatch = basename.match(fingerprintedExtensionRE);
    if (extensionMatch) {
        return {
            pathname: `${directory}${extensionMatch[1]}${extensionMatch[3]}`,
            requestedFingerprint: extensionMatch[2],
        };
    }
    let basenameMatch = basename.match(fingerprintedBasenameRE);
    if (basenameMatch) {
        return {
            pathname: `${directory}${basenameMatch[1]}`,
            requestedFingerprint: basenameMatch[2],
        };
    }
    return {
        pathname,
        requestedFingerprint: null,
    };
}
export function parseHrefFingerprint(href) {
    return parseFingerprintSuffix(new URL(href, 'http://remix.run').pathname).requestedFingerprint;
}
export function formatFingerprintedPathname(pathname, fingerprint) {
    if (fingerprint === null)
        return pathname;
    let lastSlashIndex = pathname.lastIndexOf('/');
    let directory = lastSlashIndex >= 0 ? pathname.slice(0, lastSlashIndex + 1) : '';
    let basename = lastSlashIndex >= 0 ? pathname.slice(lastSlashIndex + 1) : pathname;
    let lastDotIndex = basename.lastIndexOf('.');
    if (lastDotIndex <= 0) {
        return `${pathname}.@${fingerprint}`;
    }
    return `${directory}${basename.slice(0, lastDotIndex)}.@${fingerprint}${basename.slice(lastDotIndex)}`;
}
export function getFingerprintRequestCacheControl(requestedFingerprint) {
    return requestedFingerprint === null ? 'no-cache' : 'public, max-age=31536000, immutable';
}
