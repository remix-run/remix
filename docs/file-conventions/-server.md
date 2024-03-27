---
title: ".server modules"
toc: false
---

# `.server` modules

While not strictly necessary, `.server` modules are a good way to explicitly mark entire modules as server-only.
The build will fail if any code in a `.server` file or `.server` directory accidentally ends up in the client module graph.

```txt
app
├── .server 👈 marks all files in this directory as server-only
│   ├── auth.ts
│   └── db.ts
├── cms.server.ts 👈 marks this file as server-only
├── root.tsx
└── routes
    └── _index.tsx
```

`.server` modules must be within your Remix app directory.

Refer to the Route Module section in the sidebar for more information.

<docs-warning>`.server` directories are only supported when using [Remix Vite][remix-vite]. The [Classic Remix Compiler][classic-remix-compiler] only supports `.server` files.</docs-warning>

<docs-warning>When using the [Classic Remix Compiler][classic-remix-compiler], `.server` modules are replaced with empty modules and will not result in a compilation error. Note that this can result in runtime errors.</docs-warning>

[classic-remix-compiler]: ../future/vite#classic-remix-compiler-vs-remix-vite
[remix-vite]: ../future/vite
