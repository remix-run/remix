---
"@remix-run/dev": minor
---

feat: remix optional segments

Allows for the creation of optional route segments by using parenthesis. For example:
Creating the following file routes in remix `/($lang)/about`
this will match the following routes

```
/en/about
/fr/about
/about
```

helpful for optional language paths.

Another example `/(one)/($two)/(three).($four)` file routing would match

```
/
/one
/one/param1
/one/param1/three
/one/param1/three/param2
```
