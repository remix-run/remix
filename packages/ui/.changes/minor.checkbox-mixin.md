Added checkbox primitives and styled checkbox components.

Checkbox controls use the same keyboard focus shadow as `input()` controls.

```tsx
import checkboxStyles, { Checkbox, CheckboxGroup, CheckboxGroupParent, CheckboxItem } from '@remix-run/ui/checkbox'
import * as checkbox from '@remix-run/ui/checkbox/primitives'

<input mix={checkboxStyles()} />
<input mix={[checkboxStyles(), checkbox.control({ defaultChecked: "mixed" })]} />

<Checkbox defaultChecked="mixed" name="selection" />

<CheckboxGroup defaultValue={["read"]} name="permissions">
  <CheckboxGroupParent aria-label="All permissions" />
  <CheckboxItem value="read" />
  <CheckboxItem value="write" />
</CheckboxGroup>

<checkbox.GroupContext defaultValue={["read"]} name="permissions">
  <div mix={checkbox.group()}>
    <input aria-label="All permissions" mix={[checkboxStyles(), checkbox.parent()]} />
    <input aria-label="Read" mix={[checkboxStyles(), checkbox.item({ value: "read" })]} />
  </div>
</checkbox.GroupContext>
```
