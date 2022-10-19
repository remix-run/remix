---
"remix": patch
"@remix-run/react": patch
---

Ensure that `<Form />` respects the `formMethod` attribute set on the submitter element

```tsx
<Form>
  <button type="submit">
    GET request
  </button>
  <button type="submit" formMethod="post">
    POST request
  </button>
</Form>
```
