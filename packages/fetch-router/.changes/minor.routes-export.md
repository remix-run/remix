Added a new `@remix-run/fetch-router/routes` export exporting route creation utilities

This has been decoupled from the main `@remix-run/fetch-router` exports so that it can be used by application `routes.ts` files intended to be loaded by the client, without pulling in server-side-specific underlying packages such as `@remix-run/session`.
