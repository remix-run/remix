Build, parse, and edit a single Content Security Policy with `ContentSecurityPolicy`, available from the package root and the `content-security-policy` subpath. Structured input uses camel-cased directives and arrays of CSP tokens; `get`, `set`, and `delete` use hyphenated directive names.

Parsing preserves the first occurrence of duplicate directives and rejects comma-separated policy lists so independently enforced policies are not accidentally combined. Existing `SuperHeaders` CSP accessors continue to use strings.
