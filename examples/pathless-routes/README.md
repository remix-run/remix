# Pathless Routes

A simple example demonstrates the usage of the pathless route to create layout wrappers.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/pathless-routes)

## Example

One of the features of React Router is the ability to have `pathless routes`. This gives the ability to add route layouts without adding segments to the URL.

In this example, we are going to look at a common use case of building a blog with Remix built-in MDX compiler. We have a [index route](./app/routes/index.tsx) which serves as our Home page, and we have a [articles section](./app/routes/articles.tsx) which lists all the articles we have, and also serves as a layout for the articles section.

Let's say we want to wrap each article with some styles. Due to the way MDX routes works in Remix, there is no way to include styles directly into the MDX file. We can instead create a pathless route and add our styles there.

Our file system based routes are structured as below

```sh
app
├── entry.client.tsx
├── entry.server.tsx
├── root.tsx
└── routes
    ├── articles
    │   ├── __layout
    │   │   └── hello.md
    │   └── __layout.tsx
    ├── articles.tsx
    └── index.tsx
```

| URL             | Matched Route                           |
| --------------- | --------------------------------------- |
| /               | app/routes/index.tsx                    |
| /articles       | app/routes/articles.tsx                 |
| /articles/hello | app/routes/articles/\_\_layout/hello.md |

Here `app/routes/articles/__layout.tsx` will add a pathless route, and acts as a wrapper for all the routes inside `app/routes/articles/__layout/`.

## Related Links

- [Pathless Routes](https://remix.run/docs/en/v1/api/conventions#pathless-layout-routes)
- [Layout Routes](https://remix.run/docs/en/v1/api/conventions#layout-routes)
- [Remix MD/MDX](https://remix.run/docs/en/v1/guides/mdx)
