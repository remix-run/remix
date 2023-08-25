---
"@remix-run/dev": minor
---

Support root route as a folder.

Now your root route can be either a file (`app/root.tsx`) or a folder (`app/root/route.tsx`) just like any other route. This is handy for organizational purposes if your root route depends on a lot of components imported from other files.
