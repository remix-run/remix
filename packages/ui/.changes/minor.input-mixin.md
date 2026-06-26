Added a default `input()` mixin exported from `@remix-run/ui/input` for standalone native inputs, plus `input.root()` and `input.field()` for icon-capable input layouts.

```tsx
import input from '@remix-run/ui/input'

<input mix={input()} placeholder="Limit" />

<div mix={input.root()}>
  <SearchIcon />
  <input mix={input.field()} placeholder="Search and filter products" />
</div>
```
