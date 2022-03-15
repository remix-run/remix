Splitting up client and server dependencies so that `react-dom` is only bundled on the client and `react-dom-server` is only bundled on the server.

## React and other singletons

Singletons like `react` will cause errors if more than one copy is present.

To ensure only one copy of each singleton is loaded, use [`deps` files](https://deno.land/manual@v1.19.3/examples/manage_dependencies) to centrally defined a single version of each singleton.