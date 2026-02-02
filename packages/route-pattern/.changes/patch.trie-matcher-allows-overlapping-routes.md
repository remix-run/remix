`TrieMatcher` allows overlapping routes

For example:

```ts
let pattern1 = new RoutePattern('://api.example.com/users/:id')
let pattern2 = new RoutePattern('://api.example.com/users(/:id)')

matcher.add(pattern1)
matcher.add(pattern2)
```

In this case, the second pattern fully overlaps the first one when the optional is included and the TrieMatcher could not store overlapping routes, so `pattern1` was silently dropped.

Now, `TrieMatcher` allows overlapping routes by storing an array of route patterns in the trie nodes.
