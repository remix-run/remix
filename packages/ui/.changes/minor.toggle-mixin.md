BREAKING CHANGE: The toggle mixin is now exported as `toggle` instead of `control`. Since `toggle` consists of a single mixin, it can now be called directly as `toggle()` rather than grouped under `toggle.control()`.

```diff
-import * as toggle from '@remix-run/ui/toggle'
+import { toggle } from '@remix-run/ui/toggle'

-<input mix={toggle.control({ defaultChecked: true })} />
+<input mix={toggle({ defaultChecked: true })} />
```

The options type has also been renamed from `ToggleControlOptions` to `ToggleOptions`:

```diff
-import type { ToggleControlOptions } from '@remix-run/ui/toggle'
+import type { ToggleOptions } from '@remix-run/ui/toggle'
```
