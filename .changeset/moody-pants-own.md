---
"@remix-run/dev": minor
---

Added support and conventions for optional route segments

Routes surrounded by parenthesis will be converted into optional segments for React Router. For example `/($lang)/about` will be converted to `/:lang?/about` in React Router.

This means `/($lang)/about` would match:

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

As with any of our conventions, you can escape this conversion by wrapping the route filename in square brackets. For example, `/[(one)]/two` would match the URL path `/(one)/two`.