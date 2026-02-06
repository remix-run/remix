export function logHydrationMismatch(...msg) {
    console.error('Hydration mismatch:', ...msg);
}
export function skipComments(cursor) {
    while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
        cursor = cursor.nextSibling;
    }
    return cursor;
}
//# sourceMappingURL=hydration.js.map