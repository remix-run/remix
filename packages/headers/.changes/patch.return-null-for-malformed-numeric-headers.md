Return `null` from `SuperHeaders` numeric accessors when the raw header value has no parseable integer prefix, instead of returning `NaN` despite their `number | null` return type (see #12036).
