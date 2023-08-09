---
"@remix-run/architect": major
"@remix-run/express": major
"@remix-run/node": major
"@remix-run/serve": major
---

For preparation of using Node's built in fetch implementation, installing the fetch globals is now a responsibility of the app server. If you are using `remix-serve`, nothing is required. If you are using your own app server, you will need to install the globals yourself.

```js filename=server.js
import { installGlobals } from "@remix-run/node";

installGlobals();
```

source-map-support is now a responsibility of the app server. If you are using `remix-serve`, nothing is required. If you are using your own app server, you will need to install [`source-map-support`](https://www.npmjs.com/package/source-map-support) yourself.

```sh
npm i source-map-support
```

```js filename=server.js
import sourceMapSupport from "source-map-support";
sourceMapSupport.install();
```
