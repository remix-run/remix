import { renderToStream } from 'remix/component/server';
import { createHtmlResponse } from 'remix/response/html';
export function render(node, init) {
    return createHtmlResponse(renderToStream(node), init);
}
