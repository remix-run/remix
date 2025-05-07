---
title: useViewTransitionState
toc: false
---

# `useViewTransitionState`

This hook returns `true` when there is an active [View Transition][view-transitions] to the specified location. This can be used to apply finer-grained styles to elements to further customize the view transition. This requires that view transitions have been enabled for the given navigation via the `viewTransition` prop on the [`Link`][link-component-view-transition] (or the [`Form`][form-component-view-transition], [`NavLink`][nav-link-component-view-transition], `navigate`, or `submit` call).

Consider clicking on an image in a list that you need to expand into the hero image on the destination page:

```jsx
function NavImage({ src, alt, id }) {
  const to = `/images/${idx}`;
  const vt = useViewTransitionState(to);
  return (
    <Link to={to} viewTransition>
      <img
        src={src}
        alt={alt}
        style={{
          viewTransitionName: vt ? "image-expand" : "",
        }}
      />
    </Link>
  );
}
```

[view-transitions]: https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
[link-component-view-transition]: ../components/link#viewtransition
[form-component-view-transition]: ../components/form#viewtransition
[nav-link-component-view-transition]: ../components/nav-link#viewtransition
