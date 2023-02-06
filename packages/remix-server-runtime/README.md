# @remix-run/server-runtime

[Remix](https://remix.run) supports multiple server runtimes:

- [Node](https://nodejs.org/en/)
- [Cloudflare](https://developers.cloudflare.com/workers/learning/how-workers-works/)
- [Deno](https://deno.land/) (Experimental 🧪)

Support for each runtime is provided by a corresponding Remix package:

- [`@remix-run/node`](https://github.com/remix-run/remix/tree/main/packages/remix-node)
- [`@remix-run/cloudflare`](https://github.com/remix-run/remix/tree/main/packages/remix-cloudflare)
- [`@remix-run/deno`](https://github.com/remix-run/remix/tree/main/packages/remix-deno)

This package defines a "Remix server runtime interface" that each runtime package must conform to.

Each Remix server runtime package MUST:

- Implement and export values for each type in [`interface.ts`](./interface.ts)
- Re-export types in [`reexport.ts`](./reexport.ts)

Each Remix server runtime package MAY:

- Re-export the [default implementations](./index.ts) as its implementations
- Export custom implementations adhering to the [interface types](./interface.ts)
- Provide additional exports relevant for that runtime

## Community Runtimes

Remix runs on any platform where a runtime package exists and implements the above requirements.

The following is a list of community-provided runtimes:

- [`@fastly/remix-server-runtime`][fastly-remix-server-runtime] - For [Fastly Compute@Edge][fastly-compute-at-edge].

[fastly-remix-server-runtime]: https://github.com/fastly/remix-compute-js/tree/main/packages/remix-server-runtime
[fastly-compute-at-edge]: https://developer.fastly.com/learning/compute/
