import { getResponseNonce } from './nonce.js';
import { getSpaResponseData } from './spa-response.js';
export async function unwrapFrameResolution(resolution) {
    if (!(resolution instanceof Response))
        return { content: resolution };
    let data = getSpaResponseData(resolution);
    if (data) {
        return {
            content: data.node,
            redirectedTo: data.redirectedTo,
        };
    }
    let content = resolution.body ?? (await resolution.text());
    return {
        content,
        nonce: getResponseNonce(resolution),
        redirectedTo: resolution.redirected && resolution.url ? resolution.url : undefined,
    };
}
//# sourceMappingURL=frame-resolution.js.map