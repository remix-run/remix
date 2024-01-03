---
"@remix-run/dev": patch
---

Fix issue with `isbot` v4 released on 1/1/2024

* `remix dev` wil now add `"isbot": "^4"` to `package.json` instead of using `latest`
* Update built-in `entry.server` files to work with both `isbot@3` and `isbot@4` for backwards-compatibility with Remix apps that have pinned `isbot` to v3
* Templates are updated to use `isbot@4` moving forward via `create-remix`
