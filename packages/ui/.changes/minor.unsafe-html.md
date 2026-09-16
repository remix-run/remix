BREAKING CHANGE: Raw HTML props now require an opaque value created by `unsafeHTML()`. This applies to `innerHTML` and both iframe `srcDoc` spellings (`srcDoc` and `srcdoc`). It prevents attacker-controlled prop spreads from activating HTML parsing with plain strings or JSON-shaped objects. `outerHTML` is not supported because it would replace a reconciler-owned element. `unsafeHTML()` is an explicit authorization boundary; it does not sanitize or otherwise modify its input.

```diff
-import type { Handle } from 'remix/ui'
+import { unsafeHTML } from 'remix/ui'
+import type { Handle } from 'remix/ui'

 function Content(handle: Handle<{ html: string }>) {
-  return () => <div innerHTML={handle.props.html} />
+  return () => <div innerHTML={unsafeHTML(handle.props.html)} />
 }
```
