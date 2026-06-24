Added `toggle()` styles and `toggle/primitives` for boolean switch controls with medium and large sizes.

```tsx
import toggle from '@remix-run/ui/toggle'
import * as togglePrimitive from '@remix-run/ui/toggle/primitives'

<input defaultChecked mix={toggle({ size: 'lg' })} />
<button aria-label="Notifications" mix={[...toggle(), togglePrimitive.control({ defaultChecked: true })]} />
```
