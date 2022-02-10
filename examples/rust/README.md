# Example using Rust

If you want to combine the **Web Fundamentals & Modern UX** of Remix together with the **Reliability, Performance & Efficiency** of Rust, you can use functions built with Rust on your server. Useful for intensive computations such as on the fly machine learning tasks, fibonacci etc.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/with-rust)

## Example

This example uses Rust compiled to WASM.

If you don't have Rust installed on your computer the first thing to do is to get this set up

Installing Rust:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Here we use `wasm-pack` to comile our Rust code down to WASM

Installing [wasm-pack](https://github.com/rustwasm/wasm-pack):

```sh
cargo install wasm-pack
```

In this example, the Rust library is already built with the associated code. But if you wanted to set up your own library you could do so by running the following command:

```sh
cargo new --lib <library-name>
```

Then build the library using:

```sh
cd <library-name>
wasm-pack build --target nodejs
```

After succesfully bulding the library you can add this to your dependencies by running inside your remix project:

```sh
npm install ./<library-name>/pkg
```

This will add the dependency to your `package.json` file.

```json
    ...
    "@remix-run/serve": "1.1.3",
    "<library-name>": "file:<library-name>/pkg"
    ...
```

## Notes:

_To prevent remix from including the rust-functions library in the client build we can re-export the functions using a `.server.ts` file, e.g. [rust.server.ts](app/rust.server.ts)_

## Related Links

[Rust](https://rust-lang.org/)

[Wasm-pack](https://github.com/rustwasm/wasm-pack)

[Tensorflow & WebAssembly](https://blog.tensorflow.org/2020/03/introducing-webassembly-backend-for-tensorflow-js.html)
