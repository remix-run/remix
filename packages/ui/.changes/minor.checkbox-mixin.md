Added a default `checkbox()` mixin exported from `@remix-run/ui/checkbox` for styling native checkbox inputs.

Checkbox controls use the same keyboard focus shadow as `input()` controls and support an optional visual `state` for app-owned checked, unchecked, and mixed states.

```tsx
import checkbox from '@remix-run/ui/checkbox'

<input defaultChecked mix={checkbox()} name="permissions" value="read" />
<input indeterminate mix={checkbox({ size: 'lg', state: 'mixed' })} />
```
