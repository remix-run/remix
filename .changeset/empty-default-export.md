---
"@remix-run/react": patch
---

Fix warning that could be logged when using route files with no `default` export
 - It seems our compiler compiles these files to export an empty object as the `default` which we can then end up passing to `React.createElement`, triggering the console warning, but generally no UI issues
 - By properly detecting these, we can correctly pass `Component: undefined` off to the React Router layer
 - This is technically an potential issue in the compiler but it's an easy patch in the `@remix-run/react` layer and hopefully disappears in a Vite world
