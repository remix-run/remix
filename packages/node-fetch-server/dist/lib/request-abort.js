const requestAbortReasons = new WeakSet();
export function createRequestLifecycle() {
    let controller = new AbortController();
    let finished = false;
    return {
        get signal() {
            return controller.signal;
        },
        abort(reason) {
            if (!finished)
                controller.abort(reason);
        },
        finish() {
            finished = true;
        },
    };
}
export function observeResponseForRequestLifecycle(res, lifecycle) {
    // Abort once we can no longer write a response if we have
    // not yet sent a response (i.e., `close` without `finish`)
    // `finish` -> done rendering the response
    // `close` -> response can no longer be written to
    res.once('close', () => lifecycle.abort());
    res.once('finish', () => lifecycle.finish());
}
export function isRequestAlreadyAborted(req) {
    if ('aborted' in req && req.aborted === true)
        return true;
    if ('readableAborted' in req && req.readableAborted === true)
        return true;
    return req.destroyed && !isRequestComplete(req);
}
function isRequestComplete(req) {
    if ('complete' in req && req.complete === true)
        return true;
    return req.readableEnded;
}
export function createRequestAbortError() {
    let error = new DOMException('The request was aborted.', 'AbortError');
    markRequestAbortReason(error);
    return error;
}
export function markRequestAbortReason(error) {
    if (error != null && (typeof error === 'object' || typeof error === 'function')) {
        requestAbortReasons.add(error);
    }
}
export function isRequestAbortReason(error) {
    return (error != null &&
        (typeof error === 'object' || typeof error === 'function') &&
        requestAbortReasons.has(error));
}
