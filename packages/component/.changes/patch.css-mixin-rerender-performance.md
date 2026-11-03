Rerendering elements styled with `css()` is faster. In a benchmark that rerenders 200 product cards with eight `css()` styles each, rerenders take about 60% less time when the styles are defined once outside the component and about 50% less when they are written inline.

- The runtime no longer creates and dispatches `beforeUpdate` and `commit` events for a host when none of its mixins listen for them. This covers built-in mixins like `css()`, `attrs()`, and `link()`. Mixins that listen for these events, such as `animateLayout()`, receive them as before.
- When an element receives the same style object it received on the previous render, such as a style defined once at module scope, `css()` keeps the class it already generated without reading the object again.

**Behavior change:** `css()` now treats style objects as immutable. Mutating a style object in place and passing it to `css()` again no longer updates the element's styles. Pass a new object when the styles change:

```diff
 function Badge(handle: Handle<{ color: string }>) {
-  let styles = { color: 'red' }
   return () => {
-    styles.color = handle.props.color
-    return <span mix={css(styles)} />
+    return <span mix={css({ color: handle.props.color })} />
   }
 }
```
