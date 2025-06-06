---
title: Hot Module Replacement
---

# Hot Module Replacement

Hot Module Replacement is a technique for updating modules in your app without needing to reload the page.
It's a great developer experience, and Remix supports it out of the box.

Notably, HMR does its best to preserve browser state across updates.
If you have a `form` within a modal, and you fill out all the fields, traditional live reload would hard refresh the page.
So you'd lose all the data in the form.
Every time you make a change, you'd have to open up the modal _again_ and fill out the form _again_. 😭

But with HMR, all that state is preserved _across updates_. ✨

## React Fast Refresh

React already has mechanisms for updating the DOM via its [virtual DOM][virtual-dom] in response to user interactions like clicking a button.
Wouldn't it be great if React could handle updating the DOM in response to code changes too?

That's exactly what [React Fast Refresh][react-refresh] is all about!
Of course, React is all about components, not general JavaScript code, so RFR by itself only handles hot updates for exported React components.

But React Fast Refresh does have some limitations that you should be aware of.

### Class Component State

React Fast Refresh does not preserve state for class components.
This includes higher-order components that internally return classes:

```tsx
export class ComponentA extends Component {} // ❌

export const ComponentB = HOC(ComponentC); // ❌ Won't work if HOC returns a class component

export function ComponentD() {} // ✅
export const ComponentE = () => {}; // ✅
export default function ComponentF() {} // ✅
```

### Named Function Components

Function components must be named, not anonymous, for React Fast Refresh to track changes:

```tsx
export default () => {}; // ❌
export default function () {} // ❌

const ComponentA = () => {};
export default ComponentA; // ✅

export default function ComponentB() {} // ✅
```

### Supported Exports

React Fast Refresh can only handle component exports. While Remix manages special route exports like [`action`][action], [`headers`][headers], [`links`][links], [`loader`][loader], and [`meta`][meta] for you, any user-defined exports will cause full reloads:

```tsx
// These exports are handled by the Remix Vite plugin
// to be HMR-compatible
export const meta = { title: "Home" }; // ✅
export const links = [
  { rel: "stylesheet", href: "style.css" },
]; // ✅

// These exports are removed by the Remix Vite plugin
// so they never affect HMR
export const headers = { "Cache-Control": "max-age=3600" }; // ✅
export const loader = async () => {}; // ✅
export const action = async () => {}; // ✅

// This is not a Remix export, nor a component export,
// so it will cause a full reload for this route
export const myValue = "some value"; // ❌

export default function Route() {} // ✅
```

👆 Routes probably shouldn't be exporting random values like that anyway.
If you want to reuse values across routes, stick them in their own non-route module:

```ts filename=my-custom-value.ts
export const myValue = "some value";
```

### Changing Hooks

React Fast Refresh cannot track changes for a component when hooks are being added or removed from it, causing full reloads just for the next render. After the hooks have been updated, changes should result in hot updates again. For example, if you add [`useLoaderData`][use-loader-data] to your component, you may lose state local to that component for that render.

Additionally, if you are destructuring a hook's return value, React Fast Refresh will not be able to preserve state for the component if the destructured key is removed or renamed.
For example:

```tsx
export const loader = async () => {
  return json({ stuff: "some things" });
};

export default function Component() {
  const { stuff } = useLoaderData<typeof loader>();
  return (
    <div>
      <input />
      <p>{stuff}</p>
    </div>
  );
}
```

If you change the key `stuff` to `things`:

```diff
  export const loader = async () => {
-   return json({ stuff: "some things" })
+   return json({ things: "some things" })
  }

  export default Component() {
-   const { stuff } = useLoaderData<typeof loader>()
+   const { things } = useLoaderData<typeof loader>()
    return (
      <div>
        <input />
-       <p>{stuff}</p>
+       <p>{things}</p>
      </div>
    )
  }
```

then React Fast Refresh will not be able to preserve state `<input />` ❌.

As a workaround, you could refrain from destructuring and instead use the hook's return value directly:

```tsx
export const loader = async () => {
  return json({ stuff: "some things" });
};

export default function Component() {
  const data = useLoaderData<typeof loader>();
  return (
    <div>
      <input />
      <p>{data.stuff}</p>
    </div>
  );
}
```

Now if you change the key `stuff` to `things`:

```diff
  export const loader = async () => {
-   return json({ stuff: "some things" })
+   return json({ things: "some things" })
  }

  export default Component() {
    const data = useLoaderData<typeof loader>()
    return (
      <div>
        <input />
-       <p>{data.stuff}</p>
+       <p>{data.things}</p>
      </div>
    )
  }
```

Then React Fast Refresh will preserve state for the `<input />`, though you may need to use component keys as described in the next section if the stateful element (e.g. `<input />`) is a sibling of the changed element.

### Component Keys

In some cases, React cannot distinguish between existing components being changed and new components being added. [React needs `key`s][react-keys] to disambiguate these cases and track changes when sibling elements are modified.

[virtual-dom]: https://reactjs.org/docs/faq-internals.html#what-is-the-virtual-dom
[react-refresh]: https://github.com/facebook/react/tree/main/packages/react-refresh
[action]: ../route/action
[headers]: ../route/headers
[links]: ../route/links
[loader]: ../route/loader
[meta]: ../route/meta
[use-loader-data]: ../hooks/use-loader-data
[react-keys]: https://react.dev/learn/rendering-lists#why-does-react-need-keys
