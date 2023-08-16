---
"@remix-run/react": patch
---

Add error to meta params so you can render error titles, etc.

```tsx
export function meta({ error }) {
  return [{ title: error.message }]
}
```
