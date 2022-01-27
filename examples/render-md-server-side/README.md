# Render Markdown from Anywhere Server-Side

Remix supports MDX out of the box. This is great if you have your markdown/mdx files at compile time! If you are fetching your markdown files from a remote source, you have to work with unified or a wrapper such as react-remark.

Unfortunately, react-remark does not support cjs anymore but Remix.run will not work with esm just yet (without async imports). The older versions of react-remark do not implement useRemarkSync. Thus, right now there is no way to use react-remark in remix to render markdown server-side since it will always requires async code (and useEffect).

A solution: Make use of old versions of remark, unified, and rehype directly to basically reimplement react-remark for remix. Sounds complicated but it's really not!

We wrap everything up in one small component that we then can use to render markdown across our application! We can even apply custom plugins and use custom React components for the output of our markdown! And the best: everything renders nicely on the server! 🚀

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/render-md-sync-dgdze)

## Example

**Dependencies** 

THESE VERSIONS ARE REQUIRED AS THEY STILL SUPPORT CJS:

```
"rehype-react": "^6.2.1",
"remark-parse": "^9.0.0",
"remark-rehype": "^8.1.0",
"unified": "^9.2.2"
```

For your convenience: `npm i unified@^9.2.2 remark-rehype@^8.1.0 remark-parse@^9.0.0 rehype-react@^6.2.1` :)

**Markdown Renderer Implementation**

The markdown container component renders our markdown string. It is implemented in [./app/markdown.tsx](./app/markdown.tsx). Just copy-paste the file into your project.

**Usage Example**

Check out the [index route](./app/routes/index.tsx) where we (mock) fetch some markdown from a remote source in our loader function and access it through the `useLoader` hook. We then pass the markdown string to our markdown container. Easy as that!

## Related Links

- [Remix MDX guide](https://remix.run/docs/en/v1/guides/mdx#example)
- [react-remark documentation](https://github.com/remarkjs/react-remark)
- [unified documentation](https://github.com/unifiedjs/unified)
