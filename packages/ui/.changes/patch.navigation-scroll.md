Fixed delayed scroll resets and history scroll restoration during frame navigation. Scroll now updates once the destination and its blocking frames first render, without waiting for the rest of the streamed content or client entry hydration. Also fixed scroll jumps in Chromium and stale or repeated scroll changes during redirects and overlapping reloads (see #11755).

Failed `frame.reload()` calls no longer cause a second unhandled promise rejection when the caller already handles the error.
