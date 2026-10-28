import { safeDecodeURIComponent } from './paths.js';
// Emitted URLs use `.~` because `~` is unreserved in RFC 3986 and left alone by
// `encodeURIComponent`, so hosts that canonicalize paths per segment (e.g. Cloudflare
// Workers Static Assets) serve them without redirecting. `.@` is still accepted so URLs
// emitted by earlier versions keep resolving.
const fingerprintSeparator = '.~';
const fingerprintedExtensionRE = /^(.+)\.[~@]([A-Za-z0-9_-]+)(\.[^./]+)$/;
const fingerprintedBasenameRE = /^(.+)\.[~@]([A-Za-z0-9_-]+)$/;
export async function hashContent(content) {
    let bytes = typeof content === 'string'
        ? new TextEncoder().encode(content)
        : content.buffer instanceof ArrayBuffer
            ? new Uint8Array(content.buffer, content.byteOffset, content.byteLength)
            : new Uint8Array(content);
    let hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return Buffer.from(hashBuffer).toString('base64url').slice(0, 6);
}
export function parseFingerprintSuffix(pathname) {
    let lastSlashIndex = pathname.lastIndexOf('/');
    let directory = lastSlashIndex >= 0 ? pathname.slice(0, lastSlashIndex + 1) : '';
    let encodedBasename = lastSlashIndex >= 0 ? pathname.slice(lastSlashIndex + 1) : pathname;
    let basename = safeDecodeURIComponent(encodedBasename);
    let match = basename === null
        ? null
        : (basename.match(fingerprintedExtensionRE) ?? basename.match(fingerprintedBasenameRE));
    if (!match) {
        return {
            pathname,
            requestedFingerprint: null,
        };
    }
    let stem = match[1];
    if (stem === '.' || stem === '..') {
        return {
            pathname,
            requestedFingerprint: null,
        };
    }
    return {
        pathname: `${directory}${encodeURIComponent(`${stem}${match[3] ?? ''}`)}`,
        requestedFingerprint: match[2],
    };
}
export function formatFingerprintedPathname(pathname, fingerprint) {
    if (fingerprint === null)
        return pathname;
    let lastSlashIndex = pathname.lastIndexOf('/');
    let directory = lastSlashIndex >= 0 ? pathname.slice(0, lastSlashIndex + 1) : '';
    let basename = lastSlashIndex >= 0 ? pathname.slice(lastSlashIndex + 1) : pathname;
    let lastDotIndex = basename.lastIndexOf('.');
    if (lastDotIndex <= 0) {
        return `${pathname}${fingerprintSeparator}${fingerprint}`;
    }
    return `${directory}${basename.slice(0, lastDotIndex)}${fingerprintSeparator}${fingerprint}${basename.slice(lastDotIndex)}`;
}
export function getFingerprintRequestCacheControl(requestedFingerprint) {
    return requestedFingerprint === null ? 'no-cache' : 'public, max-age=31536000, immutable';
}
