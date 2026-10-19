New apps now derive `AppContext` from the router with `RouterContext<typeof router>` instead of declaring it up front and passing it to `createRouter<AppContext>()`. The explicit type argument turned off middleware inference, so middleware added to the router later (such as `formData()`) did not show up on `context` in controllers. This also matches the setup shown in the Remix guides.

Existing generated apps can apply the same setup in `app/router.ts`:

```diff
-import { createRouter, type MiddlewareContext } from 'remix/router'
+import { createRouter, type RouterContext } from 'remix/router'

-const renderMiddleware = render({ assets })
-type AppContext = MiddlewareContext<[typeof renderMiddleware]>
+export const router = createRouter({
+  middleware: [staticFiles('./public', { index: false }), render({ assets })],
+})
+
+export type AppContext = RouterContext<typeof router>

 declare module 'remix' {
   interface RouterTypes {
     context: AppContext
   }
 }

-export const router = createRouter<AppContext>({
-  middleware: [staticFiles('./public', { index: false }), renderMiddleware],
-})
```
