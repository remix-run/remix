import { mimeTypes } from "../generated/mime-types.js";
import { customMimeTypeByExtension } from "./define-mime-type.js";
/**
 * Detects the MIME type for a given file extension or filename.
 *
 * Custom MIME types registered via {@link import('./define-mime-type.ts').defineMimeType}
 * take precedence over built-in types.
 *
 * @param extension The file extension (e.g. "txt", ".txt") or filename (e.g. "file.txt")
 * @returns The MIME type string, or undefined if not found
 *
 * @example
 * detectMimeType('txt')           // 'text/plain'
 * detectMimeType('.txt')          // 'text/plain'
 * detectMimeType('file.txt')      // 'text/plain'
 * detectMimeType('unknown')       // undefined
 */
export function detectMimeType(extension) {
    let ext = extension.trim().toLowerCase();
    let customMimeType = detectCustomMimeType(ext);
    if (customMimeType !== undefined) {
        return customMimeType;
    }
    let idx = ext.lastIndexOf('.');
    // If no dot found (~idx === -1, so !~idx === true), use ext as-is.
    // Otherwise, skip past the dot (++idx) and extract the extension.
    // Credit to mrmime for this technique.
    ext = !~idx ? ext : ext.substring(++idx);
    return mimeTypes[ext];
}
function detectCustomMimeType(extension) {
    let customMimeTypes = customMimeTypeByExtension;
    if (!customMimeTypes)
        return undefined;
    let ext = extension.startsWith('.') ? extension.slice(1) : extension;
    let mimeType = customMimeTypes.get(ext);
    if (mimeType !== undefined) {
        return mimeType;
    }
    let slashIdx = Math.max(extension.lastIndexOf('/'), extension.lastIndexOf('\\'));
    let filename = ~slashIdx ? extension.slice(slashIdx + 1) : extension;
    if (filename.includes('.')) {
        ext = filename.startsWith('.') ? filename.slice(1) : filename;
        mimeType = customMimeTypes.get(ext);
        if (mimeType !== undefined) {
            return mimeType;
        }
    }
    let idx = filename.indexOf('.');
    while (~idx) {
        mimeType = customMimeTypes.get(filename.substring(idx + 1));
        if (mimeType !== undefined) {
            return mimeType;
        }
        idx = filename.indexOf('.', idx + 1);
    }
}
