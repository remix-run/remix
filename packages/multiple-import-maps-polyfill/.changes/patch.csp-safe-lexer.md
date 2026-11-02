Fix `importShim()` throwing `Cannot destructure property 'l'` under a Content Security Policy without `'unsafe-eval'` when a module has both a static import and a dynamic `import()`

Modules are now parsed with the asm.js build of `es-module-lexer` (`es-module-lexer/minimal/js`), the build ES Module Shims uses. The default build decodes import specifiers with `eval`, so a CSP without `'unsafe-eval'` silently dropped every static import from the module graph. The asm.js build needs neither `'unsafe-eval'` nor `'wasm-unsafe-eval'`, so a CSP only has to allow `blob:` module scripts.
