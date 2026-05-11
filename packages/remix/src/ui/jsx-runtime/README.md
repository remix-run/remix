# JSX Runtime

`jsx-runtime` and `jsx-dev-runtime` expose the JSX entrypoints used by Remix UI's custom JSX transform. They are compiler-facing modules; most application code should import public runtime APIs from `remix/ui` instead.

## Usage

```tsx
/** @jsxImportSource remix/ui */

export function Message() {
  return <p>Hello</p>
}
```

## `jsx-runtime.*`

- `jsx`, `jsxs`, and `jsxDEV`: JSX factory functions exported from the internal runtime.
- `Fragment`: fragment component used by the JSX transform.
- Runtime element and prop types are re-exported from `remix/ui`.

## Behavior Notes

- These modules are intended for JSX compiler output, not hand-authored imports.
- `remix/ui/jsx-runtime` and `remix/ui/jsx-dev-runtime` share the same source file.
- Use `createElement` from `remix/ui` when code needs to construct elements manually.
