Remove requirement for every element to have props

Originally, `@remix/component` assumed that props will be an object, not `null` or `undefined`. This requirement has been removed and allows props to be nullish. This makes it easier to render `@remix/component` apps using alternative JSX templating tools like [`htm`](https://www.npmjs.com/package/htm).