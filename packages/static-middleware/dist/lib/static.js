import * as path from 'node:path';
import { promises as fsp } from 'node:fs';
import { openLazyFile } from '@remix-run/fs';
import { detectMimeType } from '@remix-run/mime';
import { createFileResponse as sendFile } from '@remix-run/response/file';
import { generateDirectoryListing } from './directory-listing.js';
/**
 * Creates a middleware that serves static files from the filesystem.
 *
 * Resolves files from the percent-decoded URL pathname relative to `root`, so `/my%20file.txt`
 * serves `my file.txt`. Requests with malformed escapes, or with segments that decode to `/`,
 * `\`, a null byte, `.`, or `..`, are not served.
 * The middleware always falls through to the handler if the file is not found or an error occurs.
 *
 * @param root The root directory to serve files from (absolute or relative to cwd)
 * @param options Configuration for file responses
 * @returns The static files middleware
 */
export function staticFiles(root, options = {}) {
    // Ensure root is an absolute path
    root = path.resolve(root);
    let { acceptRanges, filter, index: indexOption, listFiles, ...fileOptions } = options;
    // Normalize index option
    let index;
    if (indexOption === false) {
        index = [];
    }
    else if (indexOption === true || indexOption === undefined) {
        index = ['index.html', 'index.htm'];
    }
    else {
        index = indexOption;
    }
    return async (context, next) => {
        if (context.method !== 'GET' && context.method !== 'HEAD') {
            return next();
        }
        let decodedPathname = decodePathname(context.url.pathname);
        if (decodedPathname == null) {
            return next();
        }
        let relativePath = decodedPathname.replace(/^\/+/, '');
        if (filter && !filter(relativePath)) {
            return next();
        }
        let rootRealPath;
        try {
            rootRealPath = await fsp.realpath(root);
        }
        catch {
            return next();
        }
        let targetPath = path.join(root, relativePath);
        let containedTargetPath = await resolveContainedPath(rootRealPath, targetPath);
        if (containedTargetPath == null) {
            return next();
        }
        let file;
        try {
            let stats = await fsp.stat(containedTargetPath);
            if (stats.isFile()) {
                file = {
                    realPath: containedTargetPath,
                    requestedPath: targetPath,
                };
            }
            else if (stats.isDirectory()) {
                // Try each index file in turn
                for (let indexFile of index) {
                    let indexPath = path.join(targetPath, indexFile);
                    let containedIndexPath = await resolveContainedPath(rootRealPath, indexPath);
                    if (containedIndexPath == null) {
                        continue;
                    }
                    try {
                        let indexStats = await fsp.stat(containedIndexPath);
                        if (indexStats.isFile()) {
                            file = {
                                realPath: containedIndexPath,
                                requestedPath: indexPath,
                            };
                            break;
                        }
                    }
                    catch {
                        // Index file doesn't exist, continue to next
                    }
                }
                // If no index file found and listFiles is enabled, show directory listing
                if (!file && listFiles) {
                    return generateDirectoryListing(containedTargetPath, context.url.pathname, decodedPathname);
                }
            }
        }
        catch {
            // Path doesn't exist or isn't accessible, fall through
        }
        if (file) {
            let fileName = path.relative(root, file.requestedPath);
            let lazyFile = openLazyFile(file.realPath, {
                name: fileName,
                type: detectMimeType(file.requestedPath) ?? '',
            });
            let finalFileOptions = { ...fileOptions };
            // If acceptRanges is a function, evaluate it with the lazyFile
            // Otherwise, pass it directly to sendFile
            if (typeof acceptRanges === 'function') {
                finalFileOptions.acceptRanges = acceptRanges(lazyFile);
            }
            else if (acceptRanges !== undefined) {
                finalFileOptions.acceptRanges = acceptRanges;
            }
            return sendFile(lazyFile, context.request, finalFileOptions);
        }
        return next();
    };
}
// Decodes each pathname segment independently. Returns null for malformed escapes and for
// segments that decode to a path separator, a null byte, or a dot segment, since those would
// address a different path than the URL's segments describe.
function decodePathname(pathname) {
    let segments = pathname.split('/');
    let decodedSegments = [];
    for (let segment of segments) {
        let decodedSegment;
        try {
            decodedSegment = decodeURIComponent(segment);
        }
        catch {
            return null;
        }
        if (decodedSegment === '.' || decodedSegment === '..' || /[/\\\0]/.test(decodedSegment)) {
            return null;
        }
        decodedSegments.push(decodedSegment);
    }
    return decodedSegments.join('/');
}
async function resolveContainedPath(rootRealPath, targetPath) {
    try {
        let realPath = await fsp.realpath(targetPath);
        return isContainedPath(rootRealPath, realPath) ? realPath : null;
    }
    catch {
        return null;
    }
}
function isContainedPath(rootPath, targetPath) {
    let relativePath = path.relative(rootPath, targetPath);
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
