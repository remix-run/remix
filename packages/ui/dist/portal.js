import { jsx as _jsx } from "@remix-run/component/jsx-runtime";
import { createRoot, ref, } from '@remix-run/component';
/**
 * Renders children into a separate DOM container while preserving component context and state.
 * Server rendering emits an inert marker; children mount on the client. DOM events bubble through
 * the destination container. Child render errors are forwarded to the owning root.
 *
 * @param handle Component handle for the portal.
 * @returns A render function for the portal's inert marker.
 */
export function Portal(handle) {
    let marker;
    let host;
    let root;
    handle.signal.addEventListener('abort', () => {
        root?.dispose();
        host?.remove();
    });
    return () => {
        handle.queueTask((signal) => {
            if (signal.aborted || !marker)
                return;
            let container = handle.props.container ?? marker.ownerDocument.body;
            if (container.ownerDocument !== marker.ownerDocument) {
                throw new Error('Portal container must belong to the same document as its marker');
            }
            if (!host) {
                host = container.ownerDocument.createElement('div');
                host.style.display = 'contents';
                container.append(host);
                root = createRoot(host, {
                    frame: handle.frame,
                    getContext: (type) => handle.context.get(type),
                });
                root.addEventListener('error', (event) => {
                    marker?.dispatchEvent(new ErrorEvent('error', { error: event.error, bubbles: true }));
                });
            }
            else if (host.parentElement !== container) {
                container.append(host);
            }
            root?.render(handle.props.children);
        });
        return _jsx("template", { mix: ref((node) => (marker = node)) });
    };
}
//# sourceMappingURL=portal.js.map