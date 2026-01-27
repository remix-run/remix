### Robust import parsing with source maps

Replaced regex-based import parsing with es-module-lexer and magic-string. Source maps are generated and served inline.

**Acceptance Criteria:**

- [x] Add `es-module-lexer` dependency for import parsing
- [x] Add `magic-string` dependency for source manipulation with source map support
- [x] Replace `rewriteImports()` regex with es-module-lexer parsing
- [x] Handle all import forms: static, dynamic, re-exports
- [x] Get source map from esbuild transform
- [x] Use magic-string for import rewriting (preserves mappings)
- [x] Combine esbuild source map with magic-string source map
- [x] Serve source map (inline `//# sourceMappingURL=data:...`)
- [x] Browser dev tools show original source locations
- [x] Tests for import parsing edge cases (18 tests covering strings, comments, dynamic imports, etc.)
