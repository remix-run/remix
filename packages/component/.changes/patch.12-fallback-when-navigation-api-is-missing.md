Let `run()` apps boot normally when the browser does not expose the Navigation API by skipping the frame-navigation listener setup instead of throwing during startup.

Imperative `navigate()` calls now fall back to `window.location.assign(...)` in that case, so apps degrade to normal full-page navigations from the server.
