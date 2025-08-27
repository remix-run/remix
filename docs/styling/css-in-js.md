---
title: CSS in JS
---

# CSS in JS libraries

You can use CSS-in-JS libraries like Styled Components and Emotion. Some of them require a "double render" to extract the styles from the component tree during the server render.

Since each library is integrated differently, check out our [examples repo][examples] to see how to use some of the most popular CSS-in-JS libraries. If you've got a library working well that hasn't been covered, please [contribute an example][examples]!

<docs-warning>
Most CSS-in-JS approaches aren't recommended for use in Remix because they require your app to render completely before you know what the styles are. This is a performance issue and prevents streaming features like `defer`.
</docs-warning>

[examples]: https://github.com/remix-run/examples
