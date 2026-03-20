BREAKING CHANGE: `parseMultipart()`, `parseMultipartStream()`, and `parseMultipartRequest()` now enforce finite default `maxParts` and `maxTotalSize` limits, and add `MaxPartsExceededError` and `MaxTotalSizeExceededError` for handling multipart envelope limit failures.

Apps that intentionally accept large multipart requests may need to raise `maxParts` or `maxTotalSize` explicitly.
