This repository is a collection of packages for use with [Remix](https://remix.run) or any web framework you choose.

## Philosophy

The packages in this repository are designed around the [single responsibility principle](https://en.wikipedia.org/wiki/Single-responsibility_principle); they each do one thing really well. Where existing web standards and APIs exist, we build on them in creative ways to expand and extend their functionality. Where new APIs are needed, we design theme to interoperate seamlessly with existing standards.

The goal is that these libraries should be really useful for anyone who is building for the web. If you're using [Remix](https://remix.run), we've designed it from the start to work with web standards. If you're using some other framework, you should easily be able to integrate these tools into your workflow as well without going full-blown Remix.

## Packages

We currently publish the following packages:

- [file-storage](packages/file-storage): Key/value storage for JavaScript `File` objects
- [form-data-parser](packages/form-data-parser): A `request.formData()` wrapper with streaming file upload handling
- [headers](packages/headers): A toolkit for working with HTTP headers in JavaScript
- [lazy-file](packages/lazy-file): Lazy, streaming `Blob`s and `File`s for JavaScript
- [multipart-parser](packages/multipart-parser): Fast, efficient parser for multipart streams

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)
