---
'@remix-run/ui': minor
---

Non-blocking `<Frame>` streaming now uses the declarative out-of-order streaming directives (`<?start name="ID">` / `<?end name="ID">` around the fallback, with resolved content delivered as `<template for="ID">`). Browsers that natively process the directives perform the DOM swap with no JavaScript; other browsers use a small MutationObserver polyfill that `run()` installs automatically. In both cases the runtime hydrates the resolved region after the swap rather than extracting the template itself.

This changes the streamed wire format: resolved frame content now streams as `<template for="ID">` instead of `<template id="ID">`, and pending fallbacks are wrapped in `<?start>` / `<?end>` directives inside the existing `<!-- rmx:f:ID -->` markers.
