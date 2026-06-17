Added checkbox primitives and styled checkbox components.

```tsx
import * as checkbox from '@remix-run/ui/checkbox'
import checkboxStyles, { Checkbox, CheckboxGroup, CheckboxGroupParent, CheckboxItem } from '@remix-run/ui/components/checkbox'

<input mix={checkboxStyles()} />

<Checkbox defaultChecked="mixed" name="selection" />

<CheckboxGroup defaultValue={["read"]} name="permissions">
  <CheckboxGroupParent aria-label="All permissions" />
  <CheckboxItem value="read" />
  <CheckboxItem value="write" />
</CheckboxGroup>
```
