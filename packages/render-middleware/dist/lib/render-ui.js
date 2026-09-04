import { createHtmlResponse } from '@remix-run/response/html';
import { renderToStream } from '@remix-run/ui/server';
import { renderWith } from './render.js';
const FRAME_HEADER = 'X-Remix-Frame';
const FRAME_TARGET_HEADER = 'X-Remix-Target';
const TOP_FRAME_SRC_HEADER = 'X-Remix-Top-Frame-Src';
const MAX_FRAME_REDIRECTS = 20;
const FRAME_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const FRAME_REQUEST_HEADERS_TO_REMOVE = [
    'Connection',
    'Content-Encoding',
    'Content-Language',
    'Content-Length',
    'Content-Location',
    'Content-Type',
    'Expect',
    'Host',
    'If-Match',
    'If-Modified-Since',
    'If-None-Match',
    'If-Range',
    'If-Unmodified-Since',
    'Keep-Alive',
    'Range',
    'TE',
    'Trailer',
    'Transfer-Encoding',
    'Upgrade',
];
// The top frame src header is omitted so cross-origin frames never receive the
// outer request URL, which may contain private paths or query parameters.
const CROSS_ORIGIN_FRAME_HEADERS = [
    'Accept',
    'Accept-Encoding',
    FRAME_HEADER,
    FRAME_TARGET_HEADER,
];
/**
 * Adds the standard Remix UI renderer to request context.
 *
 * @param options Rendering integration options.
 * @returns Middleware that installs `context.render(node, init)` for the current request.
 */
export function render(options = {}) {
    return renderWith((context) => {
        let request = context.request;
        let topFrameSrc = getTopFrameSrc(request);
        let onError = request.headers.get(FRAME_HEADER) === 'true' ? () => { } : options.onError;
        return function render(node, init) {
            let stream = renderToStream(node, {
                frameSrc: request.url,
                topFrameSrc,
                signal: request.signal,
                onError,
                resolveFrame: (src, target, frameContext) => resolveFrame(context, src, target, frameContext),
                resolveClientEntry: (entryId, component) => resolveClientEntry(options.assets, entryId, component),
            });
            return createHtmlResponse(stream, init);
        };
    });
}
function getTopFrameSrc(request) {
    if (request.headers.get(FRAME_HEADER) !== 'true')
        return request.url;
    return request.headers.get(TOP_FRAME_SRC_HEADER) ?? request.url;
}
async function resolveFrame(context, src, target, frameContext) {
    let currentFrameSrc = frameContext?.currentFrameSrc ?? context.request.url;
    let topFrameSrc = frameContext?.topFrameSrc ?? getTopFrameSrc(context.request);
    let frameUrl = new URL(src, currentFrameSrc);
    let headers = createFrameRequestHeaders(context.headers, target, topFrameSrc);
    let response = await followFrameRedirects(context, frameUrl, headers);
    if (!isHtmlResponse(response)) {
        throw new Error('Frame response must be HTML');
    }
    if (response.body != null) {
        return response.body.pipeThrough(new TransformStream(), {
            signal: context.request.signal,
        });
    }
    if (response.ok)
        return '';
    throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd());
}
function createFrameRequestHeaders(requestHeaders, target, topFrameSrc) {
    let headers = new Headers(requestHeaders);
    for (let name of FRAME_REQUEST_HEADERS_TO_REMOVE) {
        headers.delete(name);
    }
    for (let name of [...headers.keys()]) {
        if (name.startsWith('sec-fetch-'))
            headers.delete(name);
    }
    headers.set('Accept', 'text/html');
    headers.set('Accept-Encoding', 'identity');
    headers.set(FRAME_HEADER, 'true');
    headers.set(TOP_FRAME_SRC_HEADER, topFrameSrc);
    if (target == null) {
        headers.delete(FRAME_TARGET_HEADER);
    }
    else {
        headers.set(FRAME_TARGET_HEADER, target);
    }
    return headers;
}
async function followFrameRedirects(context, initialUrl, headers) {
    let url = initialUrl;
    for (let redirectCount = 0; redirectCount <= MAX_FRAME_REDIRECTS; redirectCount++) {
        if (url.origin !== context.url.origin) {
            headers = createCrossOriginFrameHeaders(headers);
        }
        let response = await context.router.fetch(new Request(url, {
            method: 'GET',
            headers,
            signal: context.request.signal,
        }));
        let location = response.headers.get('Location');
        if (location == null || !FRAME_REDIRECT_STATUSES.has(response.status)) {
            return response;
        }
        if (redirectCount === MAX_FRAME_REDIRECTS) {
            throw new Error(`Too many frame redirects while resolving ${initialUrl.href}`);
        }
        await response.body?.cancel();
        url = new URL(location, url);
    }
    throw new Error(`Too many frame redirects while resolving ${initialUrl.href}`);
}
function createCrossOriginFrameHeaders(headers) {
    let crossOriginHeaders = new Headers();
    for (let name of CROSS_ORIGIN_FRAME_HEADERS) {
        let value = headers.get(name);
        if (value != null)
            crossOriginHeaders.set(name, value);
    }
    return crossOriginHeaders;
}
async function resolveClientEntry(assets, entryId, component) {
    let hashIndex = entryId.lastIndexOf('#');
    let sourceId = hashIndex === -1 ? entryId : entryId.slice(0, hashIndex);
    let explicitExportName = hashIndex === -1 ? '' : entryId.slice(hashIndex + 1);
    let exportName = explicitExportName || component.name;
    if (sourceId.startsWith('file:')) {
        if (assets == null) {
            throw new Error('clientEntry() cannot use a file: source entry ID without an asset server. Pass the asset server to render({ assets }).');
        }
        if (!exportName)
            throw createMissingExportNameError(entryId, true);
        let [href, preloads] = await Promise.all([
            assets.getHref(sourceId),
            assets.getPreloads(sourceId),
        ]);
        return { href, exportName, preloads };
    }
    if (!exportName)
        throw createMissingExportNameError(entryId, assets != null);
    return { href: sourceId, exportName };
}
function createMissingExportNameError(entryId, hasAssets) {
    let example = hasAssets ? 'import.meta.url + "#ExportName"' : '"/js/module.js#ExportName"';
    return new Error(`clientEntry() requires either an export name in the entry ID (e.g., ${example}) or a named component function. Received "${entryId}".`);
}
function isHtmlResponse(response) {
    return (response.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase() === 'text/html');
}
