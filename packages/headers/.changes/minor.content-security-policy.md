Build, parse, and edit a single Content Security Policy with `ContentSecurityPolicy`, available from the package root and the `content-security-policy` subpath. Structured input uses camel-cased directives, token arrays for source lists, and a string for `reportTo`; `get`, `set`, and `delete` use hyphenated directive names.

Parsing preserves the first occurrence of duplicate directives and rejects comma-separated policy lists so independently enforced policies are not accidentally combined. Existing `SuperHeaders` CSP accessors continue to use strings.

`reportTo` accepts a string naming one reporting endpoint, such as `'csp'`. Parsing and `set('report-to', values)` reject empty lists, multiple names, and names outside the HTTP token grammar.
