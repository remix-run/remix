Build, parse, and edit a single policy with `ContentSecurityPolicy`, exported from the package root and `content-security-policy` subpath. Initializers use camel-cased directives, source token arrays, and a single endpoint string for `reportTo`; `get`, `set`, and `delete` use hyphenated names.

Parsing preserves the first duplicate directive and rejects policy lists. `report-to` requires exactly one HTTP token. Existing `SuperHeaders` CSP accessors retain their string API.
