# Welcome to Remix!

We are happy you're here!

[Remix](https://remix.run) is a full stack web framework that lets you focus on the user interface and work back through web fundamentals to deliver a fast, slick, and resilient user experience that deploys to any Node.js server and even non-Node.js environments at the edge like Cloudflare Workers.

Want to know more? Read the [Technical Explanation of Remix](https://remix.run/pages/technical-explanation)

This repository contains the Remix source code. This repo is a work in progress, so we appreciate your patience as we figure things out.

## Documentation

For documentation about Remix, please visit [our website](https://remix.run/docs).

Also, please [join our community on Discord](https://rmx.as/discord).

The documentation is automatically generated on each release from the files in
[the `docs` directory](docs).

## Contributing

If you're interested in contributing code and/or documentation, please see [our guide to contributing](docs/pages/contributing.md).

## Code of Conduct

Please see our [code of conduct](CODE_OF_CONDUCT.md) for any questions about the kind of community we are trying to build here and what to do if you need help with someone who is not acting professionally.

# Below is an Example Project of Developers Release of Remix-ESBUILD formatted in JavaScript 
`
 # JavaScript
  > ".$_remix.run-react_export.handler_Loader: js"
".$_/This loader is enabled by default for .js, .cjs, and .mjs files. The .cjs extension is used by node for CommonJS modules and the .mjs extension is used by node for ECMAScript modules.
 ** Note that by default, esbuild's output will take advantage of all modern JS features.
> For example,
> a !== void 0 && a !== null ?
> a : b will become a ??
> b when minifying is enabled which makes use of syntax from the ES2020 version of JavaScript.
> If this is undesired, you must specify esbuild's target setting to say in which browsers you need the output to work correctly. Then esbuild will avoid using JavaScript features that are too modern for those browsers.
> All modern JavaScript syntax is supported by esbuild. Newer syntax may not be supported by older browsers.
> so you may want to configure the target option to tell esbuild to convert newer syntax to older syntax as appropriate.
 ** These syntax features are always transformed for older browsers:
"Syntax transform	Language version	Example
Trailing commas in function parameter lists and calls	es2017	foo(a, b, )
Numeric separators	esnext	1_000_000
These syntax features are conditionally transformed for older browsers depending on the configured language target:

Syntax transform	Transformed when --target is below	Example
Exponentiation operator	es2016	a ** b
Async functions	es2017	async () => {}
Asynchronous iteration	es2018	for await (let x of y) {}
Async generators	es2018	async function* foo() {}
Spread properties	es2018	let x = {...y}
Rest properties	es2018	let {...x} = y
Optional catch binding	es2019	try {} catch {}
Optional chaining	es2020	a?.b
Nullish coalescing	es2020	a ?? b
import.meta	es2020	import.meta
Logical assignment operators	es2021	a ??= b
Class instance fields	es2022	class { x }
Static class fields	es2022	class { static x }
Private instance methods	es2022	class { #x() {} }
Private instance fields	es2022	class { #x }
Private static methods	es2022	class { static #x() {} }
Private static fields	es2022	class { static #x }
Ergonomic brand checks	es2022	#x in y
Class static blocks	es2022	class { static {} }
Import assertions	esnext	import "x" assert {}
Auto-accessors	esnext	class { accessor x }
using declarations	esnext	using x = y"
These syntax features are currently always passed through un-transformed:

Syntax transform	Unsupported when --target is below	Example
RegExp dotAll flag	es2018	/./s1
RegExp lookbehind assertions	es2018	/(?<=x)y/1
RegExp named capture groups	es2018	/(?<foo>\d+)/1
RegExp unicode property escapes	es2018	/\p{ASCII}/u1
BigInt	es2020	123n
Top-level await	es2022	await import(x)
Arbitrary module namespace identifiers	es2022	export {foo as 'f o o'}
RegExp match indices	es2022	/x(.+)y/d1
Hashbang grammar	esnext	#!/usr/bin/env node
Decorators	esnext	@foo class Bar {}
RegExp set notation	esnext	/[\w--\d]/1
1 Unsupported regular expression literals are transformed into a new RegExp() constructor call so you can bring your own polyfill library to get them to work anyway.
See also the list of finished ECMAScript proposals and the list of active ECMAScript proposals. Note that while transforming code containing top-level await is supported, bundling code containing top-level await is only supported when the output format is set to esm.

JavaScript caveats
You should keep the following things in mind when using JavaScript with esbuild:

ES5 is not supported well
Transforming ES6+ syntax to ES5 is not supported yet. However, if you're using esbuild to transform ES5 code, you should still set the target to es5. This prevents esbuild from introducing ES6 syntax into your ES5 code. For example, without this flag the object literal {x: x} will become {x} and the string "a\nb" will become a multi-line template literal when minifying. Both of these substitutions are done because the resulting code is shorter, but the substitutions will not be performed if the target is es5.

Private member performance
The private member transform (for the #name syntax) uses WeakMap and WeakSet to preserve the privacy properties of this feature. This is similar to the corresponding transforms in the Babel and TypeScript compilers. Most modern JavaScript engines (V8, JavaScriptCore, and SpiderMonkey but not ChakraCore) may not have good performance characteristics for large WeakMap and WeakSet objects.

Creating many instances of classes with private fields or private methods with this syntax transform active may cause a lot of overhead for the garbage collector. This is because modern engines (other than ChakraCore) store weak values in an actual map object instead of as hidden properties on the keys themselves, and large map objects can cause performance issues with garbage collection. See this reference for more information.

Imports follow ECMAScript module behavior
You might try to modify global state before importing a module which needs that global state and expect it to work. However, JavaScript (and therefore esbuild) effectively "hoists" all import statements to the top of the file, so doing this won't work:

window.foo = {}
import './something-that-needs-foo'
There are some broken implementations of ECMAScript modules out there (e.g. the TypeScript compiler) that don't follow the JavaScript specification in this regard. Code compiled with these tools may "work" since the import is replaced with an inline call to require(), which ignores the hoisting requirement. But such code will not work with real ECMAScript module implementations such as node, a browser, or esbuild, so writing code like this is non-portable and is not recommended.

The way to do this correctly is to move the global state modification into its own import. That way it will be run before the other import:

import './assign-to-foo-on-window'
import './something-that-needs-foo'
Avoid direct eval when bundling
Although the expression eval(x) looks like a normal function call, it actually takes on special behavior in JavaScript. Using eval in this way means that the evaluated code stored in x can reference any variable in any containing scope by name. For example, the code let y = 123; return eval('y') will return 123.

This is called "direct eval" and is problematic when bundling your code for many reasons:

Modern bundlers contain an optimization called "scope hoisting" that merges all bundled files into a single file and renames variables to avoid name collisions. However, this means code evaluated by direct eval can read and write variables in any file in the bundle! This is a correctness issue because the evaluated code may try to access a global variable but may accidentally access a private variable with the same name from another file instead. It can potentially even be a security issue if a private variable in another file has sensitive data.

The evaluated code may not work correctly when it references variables imported using an import statement. Imported variables are live bindings to variables in another file. They are not copies of those variables. So when esbuild bundles your code, your imports are replaced with a direct reference to the variable in the imported file. But that variable may have a different name, in which case the code evaluated by direct eval will be unable to reference it by the expected name.

Using direct eval forces esbuild to deoptimize all of the code in all of the scopes containing calls to direct eval. For correctness, it must assume that the evaluated code might need to access any of the other code in the file reachable from that eval call. This means none of that code will be eliminated as dead code and none of that code will be minified.

Because the code evaluated by the direct eval could need to reference any reachable variable by name, esbuild is prevented from renaming all of the variables reachable by the evaluated code. This means it can't rename variables to avoid name collisions with other variables in the bundle. So the direct eval causes esbuild to wrap the file in a CommonJS closure, which avoids name collisions by introducing a new scope instead. However, this makes the generated code bigger and slower because exported variables use run-time dynamic binding instead of compile-time static binding.

Luckily it is usually easy to avoid using direct eval. There are two commonly-used alternatives that avoid all of the drawbacks mentioned above:

(0, eval)('x')
This is known as "indirect eval" because eval is not being called directly, and so does not trigger the grammatical special case for direct eval in the JavaScript VM. You can call indirect eval using any syntax at all except for an expression of the exact form eval('x'). For example, var eval2 = eval; eval2('x') and [eval][0]('x') and window.eval('x') are all indirect eval calls. When you use indirect eval, the code is evaluated in the global scope instead of in the inline scope of the caller.

new Function('x')
This constructs a new function object at run-time. It is as if you wrote function() { x } in the global scope except that x can be an arbitrary string of code. This form is sometimes convenient because you can add arguments to the function, and use those arguments to expose variables to the evaluated code. For example, (new Function('env', 'x'))(someEnv) is as if you wrote (function(env) { x })(someEnv). This is often a sufficient alternative for direct eval when the evaluated code needs to access local variables because you can pass the local variables in as arguments.

The value of toString() is not preserved on functions (and classes)
It's somewhat common to call toString() on a JavaScript function object and then pass that string to some form of eval to get a new function object. This effectively "rips" the function out of the containing file and breaks links with all variables in that file. Doing this with esbuild is not supported and may not work. In particular, esbuild often uses helper methods to implement certain features and it assumes that JavaScript scope rules have not been tampered with. For example:

let pow = (a, b) => a ** b;
let pow2 = (0, eval)(pow.toString());
console.log(pow2(2, 3));
When this code is compiled for ES6, where the ** operator isn't available, the ** operator is replaced with a call to the __pow helper function:

let __pow = Math.pow;
let pow = (a, b) => __pow(a, b);
let pow2 = (0, eval)(pow.toString());
console.log(pow2(2, 3));
If you try to run this code, you'll get an error such as ReferenceError: __pow is not defined because the function (a, b) => __pow(a, b) depends on the locally-scoped symbol __pow which is not available in the global scope. This is the case for many JavaScript language features including async functions, as well as some esbuild-specific features such as the keep names setting.

This problem most often comes up when people get the source code of a function with .toString() and then try to use it as the body of a web worker. If you are doing this and you want to use esbuild, you should instead build the source code for the web worker in a separate build step and then insert the web worker source code as a string into the code that creates the web worker. The define feature is one way to insert the string at build time.

The value of this is not preserved on functions called from a module namespace object
In JavaScript, the value of this in a function is automatically filled in for you based on how the function is called. For example if a function is called using obj.fn(), the value of this during the function call will be obj. This behavior is respected by esbuild with one exception: if you call a function from a module namespace object, the value of this may not be correct. For example, consider this code that calls foo from the module namespace object ns:

import * as ns from './foo.js'
ns.foo()
If foo.js tries to reference the module namespace object using this, then it won't necessarily work after the code is bundled with esbuild:

// foo.js
export function foo() {
  this.bar()
}
export function bar() {
  console.log('bar')
}
The reason for this is that esbuild automatically rewrites code most code that uses module namespace objects to code that imports things directly instead. That means the example code above will be converted to this instead, which removes the this context for the function call:

import { foo } from './foo.js'
foo()
This transformation dramatically improves tree shaking (a.k.a. dead code elimination) because it makes it possible for esbuild to understand which exported symbols are unused. It has the drawback that this changes the behavior of code that uses this to access the module's exports, but this isn't an issue because no one should ever write bizarre code like this in the first place. If you need to access an exported function from the same file, just call it directly (i.e. bar() instead of this.bar() in the example above).

The default export can be error-prone
The ES module format (i.e. ESM) have a special export called default that sometimes behaves differently than all other export names. When code in the ESM format that has a default export is converted to the CommonJS format, and then that CommonJS code is imported into another module in ESM format, there are two different interpretations of what should happen that are both widely-used (the Babel way and the Node way). This is very unfortunate because it causes endless compatibility headaches, especially since JavaScript libraries are often authored in ESM and published as CommonJS.

When esbuild bundles code that does this, it has to decide which interpretation to use, and there's no perfect answer. The heuristics that esbuild uses are the same heuristics that Webpack uses (see below for details). Since Webpack is the most widely-used bundler, this means that esbuild is being the most compatible that it can be with the existing ecosystem regarding this compatibility problem. So the good news is that if you can get code with this problem to work with esbuild, it should also work with Webpack.

Here's an example that demonstrates the problem:

// index.js
import foo from './somelib.js'
console.log(foo)
// somelib.js
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = 'foo';
And here are the two interpretations, both of which are widely-used:

The Babel interpretation

If the Babel interpretation is used, this code will print foo. Their rationale is that somelib.js was converted from ESM into CommonJS (as you can tell by the __esModule marker) and the original code looked something like this:

// somelib.js
export default 'foo'
If somelib.js hadn't been converted from ESM into CommonJS, then this code would print foo, so it should still print foo regardless of the module format. This is accomplished by detecting when a CommonJS module used to be an ES module via the __esModule marker (which all module conversion tools set including Babel, TypeScript, Webpack, and esbuild) and setting the default import to exports.default if the __esModule marker is present. This behavior is important because it's necessary to run cross-compiled ESM correctly in a CommonJS environment, and for a long time that was the only way to run ESM code in Node before Node eventually added native ESM support.

The Node interpretation

If the Node interpretation is used, this code will print { default: 'foo' }. Their rationale is that CommonJS code uses dynamic exports while ESM code uses static exports, so the fully general approach to importing CommonJS into ESM is to expose the CommonJS exports object itself somehow. For example, CommonJS code can do exports[Math.random()] = 'foo' which has no equivalent in ESM syntax. The default export is used for this because that's actually what it was originally designed for by the people who came up with the ES module specification. This interpretation is entirely reasonable for normal CommonJS modules. It only causes compatibility problems for CommonJS modules that used to be ES modules (i.e. when __esModule is present) in which case the behavior diverges from the Babel interpretation.

If you are a library author: When writing new code, you should strongly consider avoiding the default export entirely. It has unfortunately been tainted with compatibility problems and using it will likely cause problems for your users at some point.

If you are a library user: By default, esbuild will use the Babel interpretation. If you want esbuild to use the Node interpretation instead, you need to either put your code in a file ending in .mts or .mjs, or you need to add "type": "module" to your package.json file. The rationale is that Node's native ESM support can only run ESM code if the file extension is .mjs or "type": "module" is present, so doing that is a good signal that the code is intended to be run in Node, and should therefore use the Node interpretation of default import. This is the same heuristic that Webpack uses.

TypeScript
Loader: ts or tsx

This loader is enabled by default for .ts, .tsx, .mts, and .cts files, which means esbuild has built-in support for parsing TypeScript syntax and discarding the type annotations. However, esbuild does not do any type checking so you will still need to run tsc -noEmit in parallel with esbuild to check types. This is not something esbuild does itself.

TypeScript type declarations like these are parsed and ignored (a non-exhaustive list):

Syntax feature	Example
Interface declarations	interface Foo {}
Type declarations	type Foo = number
Function declarations	function foo(): void;
Ambient declarations	declare module 'foo' {}
Type-only imports	import type {Type} from 'foo'
Type-only exports	export type {Type} from 'foo'
Type-only import specifiers	import {type Type} from 'foo'
Type-only export specifiers	export {type Type} from 'foo'
TypeScript-only syntax extensions are supported, and are always converted to JavaScript (a non-exhaustive list):

Syntax feature	Example	Notes
Namespaces	namespace Foo {}	
Enums	enum Foo { A, B }	
Const enums	const enum Foo { A, B }	
Generic type parameters	<T>(a: T): T => a	Must write <T,>(... with the tsx loader
JSX with types	<Element<T>/>	
Type casts	a as B and <B>a	
Type imports	import {Type} from 'foo'	Handled by removing all unused imports
Type exports	export {Type} from 'foo'	Handled by ignoring missing exports in TypeScript files
Experimental decorators	@sealed class Foo {}	Requires experimentalDecorators,
does not support emitDecoratorMetadata
Instantiation expressions	Array<number>	TypeScript 4.7+
extends on infer	infer A extends B	TypeScript 4.7+
Variance annotations	type A<out B> = () => B	TypeScript 4.7+
The satisfies operator	a satisfies T	TypeScript 4.9+
const type parameters	class Foo<const T> {}	TypeScript 5.0+
TypeScript caveats
You should keep the following things in mind when using TypeScript with esbuild (in addition to the JavaScript caveats):

Files are compiled independently
Even when transpiling a single module, the TypeScript compiler actually still parses imported files so it can tell whether an imported name is a type or a value. However, tools like esbuild and Babel (and the TypeScript compiler's transpileModule API) compile each file in isolation so they can't tell if an imported name is a type or a value.

Because of this, you should enable the isolatedModules TypeScript configuration option if you use TypeScript with esbuild. This option prevents you from using features which could cause mis-compilation in environments like esbuild where each file is compiled independently without tracing type references across files. For example, it prevents you from re-exporting types from another module using export {T} from './types' (you need to use export type {T} from './types' instead).

Imports follow ECMAScript module behavior
For historical reasons, the TypeScript compiler compiles ESM (ECMAScript module) syntax to CommonJS syntax by default. For example, import * as foo from 'foo' is compiled to const foo = require('foo'). Presumably this happened because ECMAScript modules were still a proposal when TypeScript adopted the syntax. However, this is legacy behavior that doesn't match how this syntax behaves on real platforms such as node. For example, the require function can return any JavaScript value including a string but the import * as syntax always results in an object and cannot be a string.

To avoid problems due to this legacy feature, you should enable the esModuleInterop TypeScript configuration option if you use TypeScript with esbuild. Enabling it disables this legacy behavior and makes TypeScript's type system compatible with ESM. This option is not enabled by default because it would be a breaking change for existing TypeScript projects, but Microsoft highly recommends applying it both to new and existing projects (and then updating your code) for better compatibility with the rest of the ecosystem.

Specifically this means that importing a non-object value from a CommonJS module with ESM import syntax must be done using a default import instead of using import * as. So if a CommonJS module exports a function via module.exports = fn, you need to use import fn from 'path' instead of import * as fn from 'path'.

Features that need a type system are not supported
TypeScript types are treated as comments and are ignored by esbuild, so TypeScript is treated as "type-checked JavaScript." The interpretation of the type annotations is up to the TypeScript type checker, which you should be running in addition to esbuild if you're using TypeScript. This is the same compilation strategy that Babel's TypeScript implementation uses. However, it means that some TypeScript compilation features which require type interpretation to work do not work with esbuild.

Specifically:

The emitDecoratorMetadata TypeScript configuration option is not supported. This feature passes a JavaScript representation of the corresponding TypeScript type to the attached decorator function. Since esbuild does not replicate TypeScript's type system, it does not have enough information to implement this feature.

The declaration TypeScript configuration option (i.e. generation of .d.ts files) is not supported. If you are writing a library in TypeScript and you want to publish the compiled JavaScript code as a package for others to use, you will probably also want to publish type declarations. This is not something that esbuild can do for you because it doesn't retain any type information. You will likely either need to use the TypeScript compiler to generate them or manually write them yourself.

Only certain tsconfig.json fields are respected
During bundling, the path resolution algorithm in esbuild will consider the contents of the tsconfig.json file in the closest parent directory containing one and will modify its behavior accordingly. It is also possible to explicitly set the tsconfig.json path with the build API using esbuild's tsconfig setting and to explicitly pass in the contents of a tsconfig.json file with the transform API using esbuild's tsconfigRaw setting. However, esbuild currently only inspects the following fields in tsconfig.json files:

experimentalDecorators
This option enables the transformation of decorator syntax in TypeScript files. The transformation follows the outdated decorator design that TypeScript itself follows when experimentalDecorators is enabled.

Note that there is an updated design for decorators that is being added to JavaScript, as well as to TypeScript when experimentalDecorators is disabled. This is not something that esbuild implements yet, so esbuild will currently not transform decorators when experimentalDecorators is disabled.

target
useDefineForClassFields
These options control whether class fields in TypeScript files are compiled with "define" semantics or "assign" semantics:

Define semantics (esbuild's default behavior): TypeScript class fields behave like normal JavaScript class fields. Field initializers do not trigger setters on the base class. You should write all new code this way going forward.

Assign semantics (which you have to explicitly enable): esbuild emulates TypeScript's legacy class field behavior. Field initializers will trigger base class setters. This may be needed to get legacy code to run.

The way to disable define semantics (and therefore enable assign semantics) with esbuild is the same way you disable it with TypeScript: by setting useDefineForClassFields to false in your tsconfig.json file.

For compatibility with TypeScript, esbuild also copies TypeScript's behavior where when useDefineForClassFields is not specified, it defaults to false when tsconfig.json contains a target that is earlier than ES2022. But I recommend setting useDefineForClassFields explicitly if you need it instead of relying on this default value coming from the value of the target setting. Note that the target setting in tsconfig.json is only used by esbuild for determining the default value of useDefineForClassFields. It does not affect esbuild's own target setting, even though they have the same name.

baseUrl
paths
These options affect esbuild's resolution of import/require paths to files on the file system. You can use it to define package aliases and to rewrite import paths in other ways. Note that using esbuild for import path transformation requires bundling to be enabled, as esbuild's path resolution only happens during bundling. Also note that esbuild also has a native alias feature which you may want to use instead.

jsx
jsxFactory
jsxFragmentFactory
jsxImportSource
These options affect esbuild's transformation of JSX syntax into JavaScript. They are equivalent to esbuild's native options for these settings: jsx, jsxFactory, jsxFragment, and jsxImportSource.

alwaysStrict
strict
If either of these options are enabled, esbuild will consider all code in all TypeScript files to be in strict mode and will prefix generated code with "use strict" unless the output format is set to esm (since all ESM files are automatically in strict mode).

verbatimModuleSyntax
importsNotUsedAsValues
preserveValueImports
By default, the TypeScript compiler will delete unused imports when converting TypeScript to JavaScript. That way imports which turn out to be type-only imports accidentally don't cause an error at run-time. This behavior is also implemented by esbuild.

These options allow you to disable this behavior and preserve unused imports, which can be useful if for example the imported file has useful side-effects. You should use verbatimModuleSyntax for this, as that replaces the older importsNotUsedAsValues and preserveValueImports settings (which TypeScript has now deprecated).

extends
This option allows you to split up your tsconfig.json file across multiple files. This value can be a string for single inheritance or an array for multiple inheritance (new in TypeScript 5.0+).

All other tsconfig.json fields (i.e. those that aren't in the above list) will be ignored.

You cannot use the tsx loader for *.ts files
The tsx loader is not a superset of the ts loader. They are two different partially-incompatible syntaxes. For example, the character sequence <a>1</a>/g parses as <a>(1 < (/a>/g)) with the ts loader and (<a>1</a>) / g with the tsx loader.

The most common issue this causes is not being able to use generic type parameters on arrow function expressions such as <T>() => {} with the tsx loader. This is intentional, and matches the behavior of the official TypeScript compiler. That space in the tsx grammar is reserved for JSX elements.

JSX
Loader: jsx or tsx

JSX is an XML-like syntax extension for JavaScript that was created for React. It's intended to be converted into normal JavaScript by your build tool. Each XML element becomes a normal JavaScript function call. For example, the following JSX code:

import Button from './button'
let button = <Button>Click me</Button>
render(button)
Will be converted to the following JavaScript code:

import Button from "./button";
let button = React.createElement(Button, null, "Click me");
render(button);
This loader is enabled by default for .jsx and .tsx files. Note that JSX syntax is not enabled in .js files by default. If you would like to enable that, you will need to configure it:

esbuild app.js --bundle --loader:.js=jsx
Auto-import for JSX
Using JSX syntax usually requires you to manually import the JSX library you are using. For example, if you are using React, by default you will need to import React into each JSX file like this:

import * as React from 'react'
render(<div/>)
This is because the JSX transform turns JSX syntax into a call to React.createElement but it does not itself import anything, so the React variable is not automatically present.

If you would like to avoid having to manually import your JSX library into each file, you may be able to do this by setting esbuild's JSX transform to automatic, which generates import statements for you. Keep in mind that this also completely changes how the JSX transform works, so it may break your code if you are using a JSX library that's not React. Doing that looks like this:

esbuild app.jsx --jsx=automatic
Using JSX without React
If you're using JSX with a library other than React (such as Preact), you'll likely need to configure the JSX factory and JSX fragment settings since they default to React.createElement and React.Fragment respectively:

esbuild app.jsx --jsx-factory=h --jsx-fragment=Fragment
Alternatively, if you are using TypeScript, you can just configure JSX for TypeScript by adding this to your tsconfig.json file and esbuild should pick it up automatically without needing to be configured:

{
  "compilerOptions": {
    "jsxFactory": "h",
    "jsxFragmentFactory": "Fragment"
  }
}
You will also have to add import {h, Fragment} from 'preact' in files containing JSX syntax unless you use auto-importing as described above.

JSON
Loader: json
This loader is enabled by default for .json files. It parses the JSON file into a JavaScript object at build time and exports the object as the default export. Using it looks something like this:

import object from './example.json'
console.log(object)
In addition to the default export, there are also named exports for each top-level property in the JSON object. Importing a named export directly means esbuild can automatically remove unused parts of the JSON file from the bundle, leaving only the named exports that you actually used. For example, this code will only include the version field when bundled:

import { version } from './package.json'
console.log(version)
CSS
Loader: css (also global-css and local-css for CSS modules)

The css loader is enabled by default for .css files and the local-css loader is enabled by default for .module.css files. These loaders load the file as CSS syntax. CSS is a first-class content type in esbuild, which means esbuild can bundle CSS files directly without needing to import your CSS from JavaScript code:

esbuild --bundle app.css --outfile=out.css
You can @import other CSS files and reference image and font files with url() and esbuild will bundle everything together. Note that you will have to configure a loader for image and font files, since esbuild doesn't have any pre-configured. Usually this is either the data URL loader or the external file loader.

Note that by default, esbuild's output will take advantage of all modern CSS features. For example, color: rgba(255, 0, 0, 0.4) will become color: #f006 when minifying is enabled which makes use of syntax from CSS Color Module Level 4. If this is undesired, you must specify esbuild's target setting to say in which browsers you need the output to work correctly. Then esbuild will avoid using CSS features that are too modern for those browsers.

The new CSS nesting syntax is supported. To transform nested CSS into non-nested CSS for older browsers, make sure to specify those older browsers using esbuild's target setting.

When you provide a list of browser versions using the target setting, esbuild will also automatically insert vendor prefixes so that your CSS will work in those browsers at those versions or newer. Currently esbuild will do this for the following CSS properties:

appearance
backdrop-filter
background-clip: text
box-decoration-break
clip-path
font-kerning
hyphens
initial-letter
mask-image
mask-origin
mask-position
mask-repeat
mask-size
position: sticky
print-color-adjust
tab-size
text-decoration-color
text-decoration-line
text-decoration-skip
text-emphasis-color
text-emphasis-position
text-emphasis-style
text-orientation
text-size-adjust
user-select
Import from JavaScript
You can also import CSS from JavaScript. When you do this, esbuild will gather all CSS files referenced from a given entry point and bundle it into a sibling CSS output file next to the JavaScript output file for that JavaScript entry point. So if esbuild generates app.js it would also generate app.css containing all CSS files referenced by app.js. Here's an example of importing a CSS file from JavaScript:

import './button.css'

export let Button = ({ text }) =>
  <div className="button">{text}</div>
The bundled JavaScript generated by esbuild will not automatically import the generated CSS into your HTML page for you. Instead, you should import the generated CSS into your HTML page yourself along with the generated JavaScript. This means the browser can download the CSS and JavaScript files in parallel, which is the most efficient way to do it. That looks like this:

<html>
  <head>
    <link href="app.css" rel="stylesheet">
    <script src="app.js"></script>
  </head>
</html>
If the generated output names are not straightforward (for example if you have added [hash] to the entry names setting and the output file names have content hashes) then you will likely want to look up the generated output names in the metafile. To do this, first find the JS file by looking for the output with the matching entryPoint property. This file goes in the <script> tag. The associated CSS file can then be found using the cssBundle property. This file goes in the <link> tag.

CSS modules
CSS modules is a CSS preprocessor technique to avoid unintentional CSS name collisions. CSS class names are normally global, but CSS modules provides a way to make CSS class names local to the file they appear in instead. If two separate CSS files use the same local class name .button, esbuild will automatically rename one of them so that they don't collide. This is analogous to how esbuild automatically renames local variables with the same name in separate JS modules to avoid name collisions.

There is support for bundling with CSS modules in esbuild. To use it, you need to enable bundling, use the local-css loader for your CSS file (e.g. by using the .module.css file extension), and then import your CSS module code into a JS file. Each local CSS name in that file can be imported into JS to get the name that esbuild renamed it to. Here's an example:

// app.js
import { outerShell } from './app.module.css'
const div = document.createElement('div')
div.className = outerShell
document.body.appendChild(div)
/* app.module.css */
.outerShell {
  position: absolute;
  inset: 0;
}
When you bundle this with esbuild app.js --bundle --outdir=out you'll get this (notice how the local CSS name outerShell has been renamed):

// out/app.js
(() => {
  // app.module.css
  var outerShell = "app_outerShell";

  // app.js
  var div = document.createElement("div");
  div.className = outerShell;
  document.body.appendChild(div);
})();
/* out/app.css */
.app_outerShell {
  position: absolute;
  inset: 0;
}
This feature only makes sense to use when bundling is enabled both because your code needs to import the renamed local names so that it can use them, and because esbuild needs to be able to process all CSS files containing local names in a single bundling operation so that it can successfully rename conflicting local names to avoid collisions.

The names that esbuild generates for local CSS names are an implementation detail and are not intended to be hard-coded anywhere. The only way you should be referencing the local CSS names in your JS or HTML is with an import statement in JS that is bundled with esbuild, as demonstrated above. For example, when minification is enabled, esbuild will use a different name generation algorithm which generates names that are as short as possible (analogous to how esbuild minifies local identifiers in JS).

Using global names
The local-css loader makes all CSS names in the file local by default. However, sometimes you want to mix local and global names in the same file. There are several ways to do this:

You can wrap class names in :global(...) make them global and :local(...) to make them local.
You can use :global to make names default to being global and :local to make names default to being local.
You can use the global-css loader to still have local CSS features enabled but have names default to being global.
Here are some examples:

/*
 * This is a local name with the "local-css" loader
 * and a global name with the "global-css" loader
 */
.button {
}

/* This is a local name with both loaders */
:local(.button) {
}

/* This is a global name with both loaders */
:global(.button) {
}

/* "foo" is global and "bar" is local */
:global .foo :local .bar {
}

/* "foo" is global and "bar" is local */
:global {
  .foo {
    :local {
      .bar {}
    }
  }
}
The composes directive
The CSS modules specification also describes a composes directive. It allows class selectors with local names to reference other class selectors. This can be used to split out common sets of properties to avoid duplicating them. And with the from keyword, it can also be used to reference class selectors with local names in other files. Here's an example:

// app.js
import { submit } from './style.css'
const div = document.createElement('div')
div.className = submit
document.body.appendChild(div)
/* style.css */
.button {
  composes: pulse from "anim.css";
  display: inline-block;
}
.submit {
  composes: button;
  font-weight: bold;
}
/* anim.css */
@keyframes pulse {
  from, to { opacity: 1 }
  50% { opacity: 0.5 }
}
.pulse {
  animation: 2s ease-in-out infinite pulse;
}
Bundling this with esbuild app.js --bundle --outdir=dist --loader:.css=local-css will give you something like this:

(() => {
  // style.css
  var submit = "anim_pulse style_button style_submit";

  // app.js
  var div = document.createElement("div");
  div.className = submit;
  document.body.appendChild(div);
})();
/* anim.css */
@keyframes anim_pulse {
  from, to {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
.anim_pulse {
  animation: 2s ease-in-out infinite anim_pulse;
}

/* style.css */
.style_button {
  display: inline-block;
}
.style_submit {
  font-weight: bold;
}
Notice how using composes causes the string imported into JavaScript to become a space-separated list of all of the local names that were composed together. This is intended to be passed to the className property on a DOM element. Also notice how using composes with from allows you to (indirectly) reference local names in other CSS files.

Note that the order in which composed CSS classes from separate files appear in the bundled output file is deliberately undefined by design (see the specification for details). You are not supposed to declare the same CSS property in two separate class selectors and then compose them together. You are only supposed to compose CSS class selectors that declare non-overlapping CSS properties.

CSS caveats
You should keep the following things in mind when using CSS with esbuild:

Limited CSS verification
CSS has a general syntax specification that all CSS processors use and then many specifications that define what specific CSS rules mean. While esbuild understands general CSS syntax and can understand some CSS rules (enough to bundle CSS file together and to minify CSS reasonably well), esbuild does not contain complete knowledge of CSS. This means esbuild takes a "garbage in, garbage out" philosophy toward CSS. If you want to verify that your compiled CSS is free of typos, you should be using a CSS linter in addition to esbuild.

@import order matches the browser
The @import rule in CSS behaves differently than the import keyword in JavaScript. In JavaScript, an import means roughly "make sure the imported file is evaluated before this file is evaluated" but in CSS, @import means roughly "re-evaluate the imported file again here" instead. For example, consider the following files:

entry.css
@import "foreground.css";
@import "background.css";
foreground.css
@import "reset.css";
body {
  color: white;
}
background.css
@import "reset.css";
body {
  background: black;
}
reset.css
body {
  color: black;
  background: white;
}
Using your intuition from JavaScript, you might think that this code first resets the body to black text on a white background, and then overrides that to white text on a black background. This is not what happens. Instead, the body will be entirely black (both the foreground and the background). This is because @import is supposed to behave as if the import rule was replaced by the imported file (sort of like #include in C/C++), which leads to the browser seeing the following code:

/* reset.css */
body {
  color: black;
  background: white;
}

/* foreground.css */
body {
  color: white;
}

/* reset.css */
body {
  color: black;
  background: white;
}

/* background.css */
body {
  background: black;
}
which ultimately reduces down to this:

body {
  color: black;
  background: black;
}
This behavior is unfortunate, but esbuild behaves this way because that's how CSS is specified, and that's how CSS works in browsers. This is important to know about because some other commonly-used CSS processing tools such as postcss-import incorrectly resolve CSS imports in JavaScript order instead of in CSS order. If you are porting CSS code written for those tools to esbuild (or even just switching over to running your CSS code natively in the browser), you may have appearance changes if your code depends on the incorrect import order.

Text
Loader: text

This loader is enabled by default for .txt files. It loads the file as a string at build time and exports the string as the default export. Using it looks something like this:

import string from './example.txt'
console.log(string)
Binary
Loader: binary

This loader will load the file as a binary buffer at build time and embed it into the bundle using Base64 encoding. The original bytes of the file are decoded from Base64 at run time and exported as a Uint8Array using the default export. Using it looks like this:

import uint8array from './example.data'
console.log(uint8array)
If you need an ArrayBuffer instead, you can just access uint8array.buffer. Note that this loader is not enabled by default. You will need to configure it for the appropriate file extension like this:

esbuild app.js --bundle --loader:.data=binary
Base64
Loader: base64

This loader will load the file as a binary buffer at build time and embed it into the bundle as a string using Base64 encoding. This string is exported using the default export. Using it looks like this:

import base64string from './example.data'
console.log(base64string)
Note that this loader is not enabled by default. You will need to configure it for the appropriate file extension like this:

esbuild app.js --bundle --loader:.data=base64
If you intend to turn this into a Uint8Array or an ArrayBuffer, you should use the binary loader instead. It uses an optimized Base64-to-binary converter that is faster than the usual atob conversion process.

Data URL
Loader: dataurl

This loader will load the file as a binary buffer at build time and embed it into the bundle as a Base64-encoded data URL. This string is exported using the default export. Using it looks like this:

import url from './example.png'
let image = new Image
image.src = url
document.body.appendChild(image)
The data URL includes a best guess at the MIME type based on the file extension and/or the file contents, and will look something like this for binary data:

data:image/png;base64,iVBORw0KGgo=
...or like this for textual data:

data:image/svg+xml,<svg></svg>%0A
Note that this loader is not enabled by default. You will need to configure it for the appropriate file extension like this:

esbuild app.js --bundle --loader:.png=dataurl
External file
There are two different loaders that can be used for external files depending on the behavior you're looking for. Both loaders are described below:

The file loader
Loader: file

This loader will copy the file to the output directory and embed the file name into the bundle as a string. This string is exported using the default export. Using it looks like this:

import url from './example.png'
let image = new Image
image.src = url
document.body.appendChild(image)
This behavior is intentionally similar to Webpack's file-loader package. Note that this loader is not enabled by default. You will need to configure it for the appropriate file extension like this:

esbuild app.js --bundle --loader:.png=file --outdir=out
By default the exported string is just the file name. If you would like to prepend a base path to the exported string, this can be done with the public path API option.

The copy loader
Loader: copy

This loader will copy the file to the output directory and rewrite the import path to point to the copied file. This means the import will still exist in the final bundle and the final bundle will still reference the file instead of including the file inside the bundle. This might be useful if you are running additional bundling tools on esbuild's output, if you want to omit a rarely-used data file from the bundle for faster startup performance, or if you want to rely on specific behavior of your runtime that's triggered by an import. For example:

import json from './example.json' assert { type: 'json' }
console.log(json)
If you bundle the above code with the following command:

esbuild app.js --bundle --loader:.json=copy --outdir=out --format=esm
the resulting out/app.js file might look something like this:

// app.js
import json from "./example-PVCBWCM4.json" assert { type: "json" };
console.log(json);
Notice how the import path has been rewritten to point to the copied file out/example-PVCBWCM4.json (a content hash has been added due to the default value of the asset names setting), and how the import assertion for JSON has been kept so the runtime will be able to load the JSON file.

Empty file
Loader: empty

This loader tells tells esbuild to pretend that a file is empty. It can be a helpful way to remove content from your bundle in certain situations. For example, you can configure .css files to load with empty to prevent esbuild from bundling CSS files that are imported into JavaScript files:

esbuild app.js --bundle --loader:.css=empty
This loader also lets you remove imported assets from CSS files. For example, you can configure .png files to load with empty so that references to .png files in CSS code such as url(image.png) are replaced with url()."
`
