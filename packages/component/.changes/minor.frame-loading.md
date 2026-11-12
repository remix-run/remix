Defer below-the-fold frame requests with `<Frame loading="lazy" fallback={<p>Loading…</p>} />`. The server renders only the fallback, and the browser loads the frame when it approaches the viewport. Eager loading remains the default. Deferred frames do not delay hydration or ancestor navigation completion, and explicit reloads and targeted navigations load immediately. Ancestor reloads refresh loaded lazy frames in the background while keeping their content visible.

To defer loading until near the viewport, provide a fallback that renders an element to observe. If the fallback renders only text or nothing, the browser warns and loads the frame immediately without inserting a placeholder element.

Unresolved lazy frames resume viewport observation after a navigation cancels their current load. The fallback stays mounted until replacement content starts rendering.
