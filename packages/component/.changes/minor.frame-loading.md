Defer below-the-fold frame requests with `<Frame loading="lazy" fallback={<p>Loading…</p>} />`

- The server renders only the fallback, and the browser loads the frame when it approaches the viewport
- The fallback must be a DOM element to rive the intersection observer; the frame will default to eager loading without a valid fallback element
