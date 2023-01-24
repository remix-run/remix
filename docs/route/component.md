---
title: Component
---

# Route Component

The default export of a route module defines the component that will render when the route matches.

```tsx filename=app/routes/my-route.tsx
export default function MyRouteComponent() {
  return (
    <div>
      <h1>Look ma!</h1>
      <p>I'm still using React after like 8 years.</p>
    </div>
  );
}
```
