BREAKING CHANGE: `parseFormData()` now enforces finite default multipart `maxParts` and `maxTotalSize` limits and surfaces multipart limit failures directly instead of treating them as generic parse noise.

Apps that intentionally accept large multipart submissions may need to raise these limits explicitly.
