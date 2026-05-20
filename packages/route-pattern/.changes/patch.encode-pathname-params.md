Encode pathname params in `createHref` so generated URLs cannot inject extra path segments, dot segments, query strings, or fragments, while preserving slash-separated structure for wildcard params.
