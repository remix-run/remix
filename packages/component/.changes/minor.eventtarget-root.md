`VirtualRoot` now extends `EventTarget` and dispatches `error` events when errors occur during rendering or in event handlers. Listen for errors via `root.addEventListener('error', (e) => { ... })`.
