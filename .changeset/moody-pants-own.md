---
"@remix-run/dev": patch
---

Convention for Remix optional segments

Note that this only set ups the convention conversion for React Router.
Optional segments won't be available in Remix until Remix is built on top of React Router v6.5

Converts segments surrounded by parenthesis into optional segments for React Router.
For example `/($lang)/about` will be converted to `/:lang?/about` in React Router.

This means `/($lang/about)` would match:

```
/en/about
/fr/about
/about
```

Another example: `/(one)/($two)/(three).($four)` route would match all of the following:

```
/
/one
/one/param1
/one/param1/three
/one/param1/three/param2
```
