BREAKING CHANGE: Configure the application-wide router context by augmenting the new type-only `remix` root module. Runtime APIs remain available through `remix/*` subpath imports. Apps that use `@remix-run/fetch-router` directly should continue to augment that module.

```diff
-declare module 'remix/router' {
+declare module 'remix' {
   interface RouterTypes {
     context: AppContext
   }
 }
```
