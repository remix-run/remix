Fix `remix/headers` `Accept`, `Accept-Encoding` and `Accept-Language` weights when several header entries match a value. `getWeight()`, `accepts()` and `getPreferred()` now prefer an exact entry, then the most specific matching range, as RFC 9110 requires. Previously the highest-weighted match won, so `Accept-Encoding: gzip;q=0, *` reported `gzip` as acceptable and `Accept-Language: en;q=0, en-US` reported `en` as acceptable.

`Accept-Language` ranges now match by full subtag prefix, so `zh-Hant-TW` no longer matches `zh-Hant-CN`.

`AcceptEncoding#accepts('identity')` now returns `false` when the header refuses `identity` with `identity;q=0`, or with `*;q=0` and no `identity` entry. It still returns `true` when `identity` is not mentioned.
