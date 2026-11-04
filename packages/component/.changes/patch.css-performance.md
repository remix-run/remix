`css()` is faster. In a benchmark of 200 product cards with eight `css()` styles each, rerenders take about 50% less time, first renders about 20% less, and server rendering about 27% less.

- A style that was already generated is looked up by its contents instead of being hashed again.
- Elements no longer create `beforeUpdate` and `commit` events when none of their mixins listen for them. This also speeds up other mixins that don't listen, such as `attrs()` and `link()`.
