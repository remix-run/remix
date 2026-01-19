BREAKING CHANGE: Remove `ignoreCase` option

Browsers handle casing differently for different parts of the URL ([source](https://datatracker.ietf.org/doc/html/rfc3986#section-6.2.2.1)):

| URL Part | Case Sensitivity |
|----------|------------------|
| Protocol | case insensitive |
| Host     | case insensitive |
| Pathname | case sensitive   |
| Search   | case sensitive   |

So having a single `ignoreCase` option for `RoutePattern`s was ambiguous.
There are also no usages of `ignoreCase` besides tests for the option itself.

Therefore, we are removing the `ignoreCase` option but will considering adding it back int after we have more real-world use cases to draw on for clearer design requirements.