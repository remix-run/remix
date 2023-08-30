---
"@remix-run/dev": patch
---

Do not interpret JSX in .ts files

While JSX is supported in `.js` files for compatibility with existing apps and libraries,
`.ts` files should not contain JSX. By not interpreting `.ts` files as JSX, `.ts` files
can contain single-argument type generics without needing a comma to disambiguate from JSX:

```ts
// this works in .ts files

const id = <T>(x: T) => x;
//          ^ single-argument type generic
```

```tsx
// this doesn't work in .tsx files

const id = <T>(x: T) => x;
//          ^ is this a JSX element? or a single-argument type generic?
```

```tsx
// this works in .tsx files

const id = <T,>(x: T) => x;
//           ^ comma: this is a generic, not a JSX element

const component = <h1>hello</h1>
//                   ^ no comma: this is a JSX element
```
