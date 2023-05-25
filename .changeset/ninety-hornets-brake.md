---
"@remix-run/dev": minor
---

built-in tls support

New options:

- `--tls-key` / `tlsKey`: TLS key
- `--tls-cert` / `tlsCert`: TLS Certificate

If both TLS options are set, `scheme` defaults to `https`

## Example

Install [mkcert](https://github.com/FiloSottile/mkcert) and create a local CA:

```sh
brew install mkcert
mkcert -install
```

Then make sure you inform `node` about your CA certs:

```sh
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"
```

👆 You'll probably want to put that env var in your scripts or `.bashrc`/`.zshrc`

Now create `key.pem` and `cert.pem`:

```sh
mkcert -key-file key.pem -cert-file cert.pem localhost
```

See `mkcert` docs for more details.

Finally, pass in the paths to the key and cert via flags:

```sh
remix dev --tls-key=key.pem --tls-cert=cert.pem
```

or via config:

```js
module.exports = {
  future: {
    unstable_dev: {
      tlsKey: "key.pem",
      tlsCert: "cert.pem",
    },
  },
};
```

That's all that's needed to set up the Remix Dev Server with TLS.

🚨 Make sure to update your app server for TLS as well.

For example, with `express`:

```ts
import express from "express";
import https from "node:https";
import fs from "node:fs";

let app = express();

// ...code setting up your express app...

let appServer = https.createServer(
  {
    key: fs.readFileSync("key.pem"),
    cert: fs.readFileSync("cert.pem"),
  },
  app
);

appServer.listen(3000, () => {
  console.log("Ready on https://localhost:3000");
});
```

## Known limitations

`remix-serve` does not yet support TLS.
That means this only works for custom app server using the `-c` flag for now.
