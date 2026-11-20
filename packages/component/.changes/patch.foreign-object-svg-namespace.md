Create `<foreignObject>` in the SVG namespace so its content renders.

The element was created with `document.createElement()`, which puts it in the HTML namespace. Chromium treats an HTML-namespaced `foreignobject` inside `<svg>` as an unknown element and draws nothing inside it. Only the element itself was affected: its children already used the HTML namespace, matching what the server renderer and the browser's HTML parser do.
