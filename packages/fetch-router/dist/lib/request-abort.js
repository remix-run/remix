export function raceRequestAbort(promise, request) {
    let signal = request.signal;
    if (signal.aborted) {
        throw signal.reason;
    }
    return new Promise((resolve, reject) => {
        let onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
        promise.then((value) => {
            signal.removeEventListener('abort', onAbort);
            resolve(value);
        }, (error) => {
            signal.removeEventListener('abort', onAbort);
            reject(error);
        });
    });
}
