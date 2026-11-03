`css()` is faster. In a benchmark of 200 product cards with eight `css()` styles each, rerenders take about 60% less time when the styles are defined at module scope and about 50% less when they are written inline. First renders take about 20% less time and server rendering about 28% less.

- A style that was already generated is looked up by its contents instead of being hashed again.
- When an element receives the same style object it received on the previous render, `css()` keeps the class without reading the object again.
- Elements no longer create `beforeUpdate` and `commit` events when none of their mixins listen for them. This also speeds up other mixins that don't listen, such as `attrs()` and `link()`.

**Behavior change:** `css()` now treats style objects as immutable, matching the `style` prop. Mutating a style object in place and passing it to `css()` again no longer updates the element's styles. Pass a new object when the styles change:

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
