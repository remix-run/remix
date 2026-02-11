export async function drain(stream) {
    let reader = stream.getReader();
    let decoder = new TextDecoder();
    let html = '';
    while (true) {
        let { done, value } = await reader.read();
        if (done)
            break;
        html += decoder.decode(value);
    }
    return html;
}
export function readChunks(stream) {
    let reader = stream.getReader();
    let decoder = new TextDecoder();
    return (async function* () {
        while (true) {
            let { done, value } = await reader.read();
            if (done)
                break;
            yield decoder.decode(value);
        }
    })();
}
export function withResolvers() {
    let resolve;
    let reject;
    let promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return [promise, resolve, reject];
}
//# sourceMappingURL=utils.js.map