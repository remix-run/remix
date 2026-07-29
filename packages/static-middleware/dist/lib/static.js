import * as path from 'node:path';
import * as fsp from 'node:fs/promises';
import { openLazyFile } from '@remix-run/fs';
import { detectMimeType } from '@remix-run/mime';
import { createFileResponse as sendFile } from '@remix-run/response/file';
import { generateDirectoryListing } from "./directory-listing.js";
/**
 * Creates a middleware that serves static files from the filesystem.
 *
 * Uses the URL pathname to resolve files, removing the leading slash to make it a relative path.
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
        let relativePath = context.url.pathname.replace(/^\/+/, '');
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
                    return generateDirectoryListing(containedTargetPath, context.url.pathname);
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
