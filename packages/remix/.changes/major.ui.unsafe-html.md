BREAKING CHANGE: Raw HTML rendered through `remix/ui` must now be explicitly authorized with `unsafeHTML()`. This applies to `innerHTML` and both iframe `srcDoc` spellings (`srcDoc` and `srcdoc`). `outerHTML` is not supported because it would replace a reconciler-owned element. The helper preserves its input exactly and does not sanitize it.

```diff
-import type { Handle } from 'remix/ui'
+import { unsafeHTML } from 'remix/ui'
+import type { Handle } from 'remix/ui'

 function Content(handle: Handle<{ html: string }>) {
-  return () => <div innerHTML={handle.props.html} />
+  return () => <div innerHTML={unsafeHTML(handle.props.html)} />
 }
```
