import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SourceMapConsumer } from 'source-map-js/source-map.js'

import { transformComponentsForBrowser, transformComponentsForServer } from './transform.ts'

const updatedExportsCheckStatement = `let __remixUiHmrInvalidationMessage__ = (() => {
  let __remixUiHmrPreviousExportNames__ = Object.keys(__remixUiHmrPreviousExports__);
  for (let name of __remixUiHmrPreviousExportNames__) {
    if (!Object.prototype.hasOwnProperty.call(module, name)) {
      return 'Updated component module removed export "' + name + '"';
    }
  }
  for (let name of Object.keys(module)) {
    if (!Object.prototype.hasOwnProperty.call(__remixUiHmrPreviousExports__, name)) {
      return 'Updated component module added export "' + name + '"';
    }
  }
  for (let name of __remixUiHmrPreviousExportNames__) {
    if (__remixUiHmrComponentNames__.includes(name)) continue;
    if (__remixUiHmrPreviousExports__[name] !== module[name]) {
      return 'Updated component module changed non-component export "' + name + '"';
    }
  }
  return null;
})();`

describe('transformComponentsForBrowser', () => {
  it('rewrites exported PascalCase function components into HMR wrappers', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  return ({ count }) => <button>{count}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.equal(
      getGeneratedComponentImplementation(result.code, 'Counter'),
      `function __remixUiHmrImpl_Counter__() {
  let __remixUiHmrHandle__ = __remixUiHmr__.getComponentHandleForHmr(arguments[0], "/app/Counter.tsx", "Counter");
  let __s__ = __remixUiHmr__.getComponentHmrState(__remixUiHmrHandle__);
  if (__remixUiHmr__.setupComponentForHmr(__remixUiHmrHandle__, __s__, "/app/Counter.tsx", "Counter", "<setup-hash>", (__s__) => {

  }, Counter)) {
    return () => null;
  }
  __remixUiHmr__.registerComponentRenderForHmr(__remixUIRefresh__, "/app/Counter.tsx", "Counter", __remixUiHmrHandle__, ({ count }) => <button>{count}</button>, Counter);
  return function () {
    return __remixUiHmr__.callComponentRenderForHmr(__remixUiHmrHandle__, ...arguments);
  };
}`,
    )
    assert.equal(
      getGeneratedImports(result.code),
      `import { __uiHmrBrowserRuntime__ as __remixUiHmr__ } from "@remix-run/ui-hmr/browser-runtime";
import * as __remixUIRefresh__ from "@remix-run/ui/dev/refresh";`,
    )
    assert.equal(
      getGeneratedPublicWrapper(result.code, 'Counter'),
      `export function Counter() {
  return __remixUiHmr__.getCurrentComponentForHmr("/app/Counter.tsx", "Counter").apply(undefined, arguments);
}`,
    )
    assert.match(
      result.code,
      /__remixUiHmr__\.registerComponentForHmr\(__remixUIRefresh__, "\/app\/Counter\.tsx", "Counter", __remixUiHmrImpl_Counter__, "[^"]+", Counter\);/,
    )
    assert.equal(
      getGeneratedComponentNames(result.code),
      `let __remixUiHmrComponentNames__ = ["Counter"];`,
    )
    assert.equal(
      getGeneratedPreviousExports(result.code),
      `let __remixUiHmrPreviousExports__ = {
  "Counter": Counter,
};`,
    )
    assert.equal(getGeneratedUpdatedExportsCheck(result.code), updatedExportsCheckStatement)
    assert.equal(
      getGeneratedComponentModuleUpdate(result.code),
      `__remixUiHmr__.updateComponentModuleForHmr(__remixUIRefresh__, "/app/Counter.tsx", module);`,
    )
  })

  it('derives browser runtime imports from the import source', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: 'remix', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(
      getGeneratedImports(result.code),
      `import { __uiHmrBrowserRuntime__ as __remixUiHmr__ } from "remix/ui-hmr/browser-runtime";
import * as __remixUIRefresh__ from "remix/ui/dev/refresh";`,
    )
  })

  it('supports custom browser runtime import sources', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@acme/remix', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(
      getGeneratedImports(result.code),
      `import { __uiHmrBrowserRuntime__ as __remixUiHmr__ } from "@acme/remix/ui-hmr/browser-runtime";
import * as __remixUIRefresh__ from "@acme/remix/ui/dev/refresh";`,
    )
  })

  it('generates source maps for transformed browser modules', () => {
    let source = `export function Counter() {
  return () => <button>Count</button>
}
`
    let result = transformComponentsForBrowser(source, {
      importSource: '@remix-run',
      moduleUrl: '/app/Counter.tsx',
      sourceMap: true,
    })

    assert.equal(result.transformed, true)
    assertSourceMapPosition(result.map, result.code, source, '<button>Count</button>')
  })

  it('hoists setup variables into persistent HMR state', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  let count = 0
  return () => <button>{count}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(
      getGeneratedComponentImplementation(result.code, 'Counter'),
      `function __remixUiHmrImpl_Counter__() {
  let __remixUiHmrHandle__ = __remixUiHmr__.getComponentHandleForHmr(arguments[0], "/app/Counter.tsx", "Counter");
  let __s__ = __remixUiHmr__.getComponentHmrState(__remixUiHmrHandle__);
  if (__remixUiHmr__.setupComponentForHmr(__remixUiHmrHandle__, __s__, "/app/Counter.tsx", "Counter", "<setup-hash>", (__s__) => {
    __s__.count = 0;
  }, Counter)) {
    return () => null;
  }
  __remixUiHmr__.registerComponentRenderForHmr(__remixUIRefresh__, "/app/Counter.tsx", "Counter", __remixUiHmrHandle__, () => <button>{__s__.count}</button>, Counter);
  return function () {
    return __remixUiHmr__.callComponentRenderForHmr(__remixUiHmrHandle__, ...arguments);
  };
}`,
    )
  })

  it('hoists destructured setup variables into persistent HMR state', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  let model = { count: 1 }
  let { count } = model
  return () => <button>{count}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(
      getGeneratedComponentImplementation(result.code, 'Counter'),
      `function __remixUiHmrImpl_Counter__() {
  let __remixUiHmrHandle__ = __remixUiHmr__.getComponentHandleForHmr(arguments[0], "/app/Counter.tsx", "Counter");
  let __s__ = __remixUiHmr__.getComponentHmrState(__remixUiHmrHandle__);
  if (__remixUiHmr__.setupComponentForHmr(__remixUiHmrHandle__, __s__, "/app/Counter.tsx", "Counter", "<setup-hash>", (__s__) => {
    __s__.model = { count: 1 };
    {
      let { count } = __s__.model;
      __s__.count = count;
    }
  }, Counter)) {
    return () => null;
  }
  __remixUiHmr__.registerComponentRenderForHmr(__remixUIRefresh__, "/app/Counter.tsx", "Counter", __remixUiHmrHandle__, () => <button>{__s__.count}</button>, Counter);
  return function () {
    return __remixUiHmr__.callComponentRenderForHmr(__remixUiHmrHandle__, ...arguments);
  };
}`,
    )
  })

  it('rewrites setup expressions that reference previously hoisted variables', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  let count = 0
  let next = count + 1
  count += 1
  let model = { count }
  let { value, ...rest } = model
  return () => <button title={value}>{count}{next}{rest.count}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(
      getGeneratedComponentImplementation(result.code, 'Counter'),
      `function __remixUiHmrImpl_Counter__() {
  let __remixUiHmrHandle__ = __remixUiHmr__.getComponentHandleForHmr(arguments[0], "/app/Counter.tsx", "Counter");
  let __s__ = __remixUiHmr__.getComponentHmrState(__remixUiHmrHandle__);
  if (__remixUiHmr__.setupComponentForHmr(__remixUiHmrHandle__, __s__, "/app/Counter.tsx", "Counter", "<setup-hash>", (__s__) => {
    __s__.count = 0;
    __s__.next = __s__.count + 1;
    __s__.count += 1
    __s__.model = { count: __s__.count };
    {
      let { value, ...rest } = __s__.model;
      __s__.value = value;
      __s__.rest = rest;
    }
  }, Counter)) {
    return () => null;
  }
  __remixUiHmr__.registerComponentRenderForHmr(__remixUIRefresh__, "/app/Counter.tsx", "Counter", __remixUiHmrHandle__, () => <button title={__s__.value}>{__s__.count}{__s__.next}{__s__.rest.count}</button>, Counter);
  return function () {
    return __remixUiHmr__.callComponentRenderForHmr(__remixUiHmrHandle__, ...arguments);
  };
}`,
    )
  })

  it('rewrites setup binding pattern expressions that reference previously hoisted variables', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  let count = 1
  let key = 'value'
  let model = { [key]: 2 }
  let { [key]: value = count } = model
  let [first = count] = []
  return () => <button>{value}{first}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(
      getGeneratedComponentImplementation(result.code, 'Counter'),
      `function __remixUiHmrImpl_Counter__() {
  let __remixUiHmrHandle__ = __remixUiHmr__.getComponentHandleForHmr(arguments[0], "/app/Counter.tsx", "Counter");
  let __s__ = __remixUiHmr__.getComponentHmrState(__remixUiHmrHandle__);
  if (__remixUiHmr__.setupComponentForHmr(__remixUiHmrHandle__, __s__, "/app/Counter.tsx", "Counter", "<setup-hash>", (__s__) => {
    __s__.count = 1;
    __s__.key = 'value';
    __s__.model = { [__s__.key]: 2 };
    {
      let { [__s__.key]: value = __s__.count } = __s__.model;
      __s__.value = value;
    }
    {
      let [first = __s__.count] = [];
      __s__.first = first;
    }
  }, Counter)) {
    return () => null;
  }
  __remixUiHmr__.registerComponentRenderForHmr(__remixUIRefresh__, "/app/Counter.tsx", "Counter", __remixUiHmrHandle__, () => <button>{__s__.value}{__s__.first}</button>, Counter);
  return function () {
    return __remixUiHmr__.callComponentRenderForHmr(__remixUiHmrHandle__, ...arguments);
  };
}`,
    )
  })

  it('does not rewrite setup bindings that shadow previously hoisted variables', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  let value = 'outer'
  function read(value) {
    let inner = value
    return inner
  }
  if (value) {
    let value = 'block'
    read(value)
  }
  let result = read(value)
  return () => <button>{value}{result}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(
      getGeneratedComponentImplementation(result.code, 'Counter'),
      `function __remixUiHmrImpl_Counter__() {
  let __remixUiHmrHandle__ = __remixUiHmr__.getComponentHandleForHmr(arguments[0], "/app/Counter.tsx", "Counter");
  let __s__ = __remixUiHmr__.getComponentHmrState(__remixUiHmrHandle__);
  if (__remixUiHmr__.setupComponentForHmr(__remixUiHmrHandle__, __s__, "/app/Counter.tsx", "Counter", "<setup-hash>", (__s__) => {
    __s__.value = 'outer';
    function read(value) {
        let inner = value
        return inner
      }
    if (__s__.value) {
        let value = 'block'
        read(value)
      }
    __s__.result = read(__s__.value);
  }, Counter)) {
    return () => null;
  }
  __remixUiHmr__.registerComponentRenderForHmr(__remixUIRefresh__, "/app/Counter.tsx", "Counter", __remixUiHmrHandle__, () => <button>{__s__.value}{__s__.result}</button>, Counter);
  return function () {
    return __remixUiHmr__.callComponentRenderForHmr(__remixUiHmrHandle__, ...arguments);
  };
}`,
    )
  })

  it('does not rewrite render bindings that shadow setup variables', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  let count = 0
  return ({ count }) => {
    let next = count + 1
    return <button>{next}</button>
  }
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(
      getGeneratedComponentImplementation(result.code, 'Counter'),
      `function __remixUiHmrImpl_Counter__() {
  let __remixUiHmrHandle__ = __remixUiHmr__.getComponentHandleForHmr(arguments[0], "/app/Counter.tsx", "Counter");
  let __s__ = __remixUiHmr__.getComponentHmrState(__remixUiHmrHandle__);
  if (__remixUiHmr__.setupComponentForHmr(__remixUiHmrHandle__, __s__, "/app/Counter.tsx", "Counter", "<setup-hash>", (__s__) => {
    __s__.count = 0;
  }, Counter)) {
    return () => null;
  }
  __remixUiHmr__.registerComponentRenderForHmr(__remixUIRefresh__, "/app/Counter.tsx", "Counter", __remixUiHmrHandle__, ({ count }) => {
    let next = count + 1
    return <button>{next}</button>
  }, Counter);
  return function () {
    return __remixUiHmr__.callComponentRenderForHmr(__remixUiHmrHandle__, ...arguments);
  };
}`,
    )
  })

  it('rewrites PascalCase function components with separate named exports', () => {
    let result = transformComponentsForBrowser(
      `function Counter() {
  return ({ count }) => jsx('button', { children: count })
}
export {
  Counter
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.equal(
      getGeneratedPublicWrapper(result.code, 'Counter'),
      `function Counter() {
  return __remixUiHmr__.getCurrentComponentForHmr("/app/Counter.tsx", "Counter").apply(undefined, arguments);
}`,
    )
    assert.equal(
      getGeneratedNamedExports(result.code),
      `export {
  Counter
}`,
    )
    assert.equal(
      getGeneratedComponentNames(result.code),
      `let __remixUiHmrComponentNames__ = ["Counter"];`,
    )
    assert.equal(
      getGeneratedPreviousExports(result.code),
      `let __remixUiHmrPreviousExports__ = {
  "Counter": Counter,
};`,
    )
  })

  it('rewrites exported client entry function components', () => {
    let result = transformComponentsForBrowser(
      `export const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let count = 0
  return () => jsx('button', { children: count })
})
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.equal(
      getGeneratedComponentImplementation(result.code, 'Counter'),
      `function __remixUiHmrImpl_Counter__(handle) {
  let __remixUiHmrHandle__ = __remixUiHmr__.getComponentHandleForHmr(arguments[0], "/app/Counter.tsx", "Counter");
  let __s__ = __remixUiHmr__.getComponentHmrState(__remixUiHmrHandle__);
  if (__remixUiHmr__.setupComponentForHmr(__remixUiHmrHandle__, __s__, "/app/Counter.tsx", "Counter", "<setup-hash>", (__s__) => {
    __s__.count = 0;
  }, Counter)) {
    return () => null;
  }
  __remixUiHmr__.registerComponentRenderForHmr(__remixUIRefresh__, "/app/Counter.tsx", "Counter", __remixUiHmrHandle__, () => jsx('button', { children: __s__.count }), Counter);
  return function () {
    return __remixUiHmr__.callComponentRenderForHmr(__remixUiHmrHandle__, ...arguments);
  };
}`,
    )
    assert.equal(
      getGeneratedPublicWrapper(result.code, 'Counter'),
      `export const Counter = clientEntry(import.meta.url, function Counter(handle) {
  return __remixUiHmr__.getCurrentComponentForHmr("/app/Counter.tsx", "Counter").apply(undefined, arguments);
})`,
    )
    assert.match(
      result.code,
      /__remixUiHmr__\.registerComponentForHmr\(__remixUIRefresh__, "\/app\/Counter\.tsx", "Counter", __remixUiHmrImpl_Counter__, "[^"]+", Counter\);/,
    )
    assert.equal(
      getGeneratedComponentNames(result.code),
      `let __remixUiHmrComponentNames__ = ["Counter"];`,
    )
    assert.equal(
      getGeneratedPreviousExports(result.code),
      `let __remixUiHmrPreviousExports__ = {
  "Counter": Counter,
};`,
    )
  })

  it('hoists client entry setup variables into persistent HMR state', () => {
    let result = transformComponentsForBrowser(
      `export const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let label = "Initial"
  let count = 0
  return () => jsx('button', { children: label + count })
})
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(
      getGeneratedComponentImplementation(result.code, 'Counter'),
      `function __remixUiHmrImpl_Counter__(handle) {
  let __remixUiHmrHandle__ = __remixUiHmr__.getComponentHandleForHmr(arguments[0], "/app/Counter.tsx", "Counter");
  let __s__ = __remixUiHmr__.getComponentHmrState(__remixUiHmrHandle__);
  if (__remixUiHmr__.setupComponentForHmr(__remixUiHmrHandle__, __s__, "/app/Counter.tsx", "Counter", "<setup-hash>", (__s__) => {
    __s__.label = "Initial";
    __s__.count = 0;
  }, Counter)) {
    return () => null;
  }
  __remixUiHmr__.registerComponentRenderForHmr(__remixUIRefresh__, "/app/Counter.tsx", "Counter", __remixUiHmrHandle__, () => jsx('button', { children: __s__.label + __s__.count }), Counter);
  return function () {
    return __remixUiHmr__.callComponentRenderForHmr(__remixUiHmrHandle__, ...arguments);
  };
}`,
    )
  })

  it('rewrites client entry function components with separate named exports', () => {
    let result = transformComponentsForBrowser(
      `const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let count = 0
  return () => jsx('button', { children: count })
})
export {
  Counter
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.equal(
      getGeneratedPublicWrapper(result.code, 'Counter'),
      `const Counter = clientEntry(import.meta.url, function Counter(handle) {
  return __remixUiHmr__.getCurrentComponentForHmr("/app/Counter.tsx", "Counter").apply(undefined, arguments);
})`,
    )
    assert.equal(
      getGeneratedNamedExports(result.code),
      `export {
  Counter
}`,
    )
    assert.equal(
      getGeneratedComponentNames(result.code),
      `let __remixUiHmrComponentNames__ = ["Counter"];`,
    )
    assert.equal(
      getGeneratedPreviousExports(result.code),
      `let __remixUiHmrPreviousExports__ = {
  "Counter": Counter,
};`,
    )
  })

  it('rewrites client entry function components wrapped by transform helpers', () => {
    let result = transformComponentsForBrowser(
      `const Counter = clientEntry(import.meta.url, __name(function Counter2(handle) {
  let count = 0
  return () => jsx('button', { children: count })
}, "Counter"))
export {
  Counter
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.equal(
      getGeneratedPublicWrapper(result.code, 'Counter'),
      `const Counter = clientEntry(import.meta.url, __name(function Counter2(handle) {
  return __remixUiHmr__.getCurrentComponentForHmr("/app/Counter.tsx", "Counter").apply(undefined, arguments);
}, "Counter"))`,
    )
    assert.equal(
      getGeneratedComponentNames(result.code),
      `let __remixUiHmrComponentNames__ = ["Counter"];`,
    )
    assert.equal(
      getGeneratedPreviousExports(result.code),
      `let __remixUiHmrPreviousExports__ = {
  "Counter": Counter,
};`,
    )
  })

  it('does not transform aliased component exports', () => {
    let source = `function Counter() {
  return () => <button>Count</button>
}

export { Counter as Renamed }
`
    let result = transformComponentsForBrowser(source, {
      importSource: '@remix-run',
      moduleUrl: '/app/Counter.tsx',
    })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('does not transform component-like exports with unsupported initializers', () => {
    let source = `function CounterA() {
  return () => <button>A</button>
}

function CounterB() {
  return () => <button>B</button>
}

export const Counter = Math.random() > 0.5 ? CounterA : CounterB
`
    let result = transformComponentsForBrowser(source, {
      importSource: '@remix-run',
      moduleUrl: '/app/Counter.tsx',
    })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('does not transform non-component functions', () => {
    let source = `export function loader() {
  return new Response('ok')
}
`
    let result = transformComponentsForBrowser(source, {
      importSource: '@remix-run',
      moduleUrl: '/app/loader.ts',
    })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('tracks unsupported component-like exports as non-component exports', () => {
    let result = transformComponentsForBrowser(
      `function CounterA() {
  return () => <button>A</button>
}

function CounterB() {
  return () => <button>B</button>
}

export const Selected = Math.random() > 0.5 ? CounterA : CounterB

export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.equal(
      getGeneratedPreviousExports(result.code),
      `let __remixUiHmrPreviousExports__ = {
  "Selected": Selected,
  "Counter": Counter,
};`,
    )
    assert.equal(getGeneratedUpdatedExportsCheck(result.code), updatedExportsCheckStatement)
  })

  it('transforms component modules with non-component tracked exports', () => {
    let result = transformComponentsForBrowser(
      `export const loader = () => new Response('ok')

export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.equal(
      getGeneratedPreviousExports(result.code),
      `let __remixUiHmrPreviousExports__ = {
  "loader": loader,
  "Counter": Counter,
};`,
    )
  })

  it('does not transform component modules with re-exported runtime values', () => {
    let source = `export function Counter() {
  return () => <button>Count</button>
}

export { loader } from './loader.ts'
`
    let result = transformComponentsForBrowser(source, {
      importSource: '@remix-run',
      moduleUrl: '/app/Counter.tsx',
    })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('rejects updates with incompatible tracked exports', () => {
    let result = transformComponentsForBrowser(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(getGeneratedUpdatedExportsCheck(result.code), updatedExportsCheckStatement)
  })

  it('allows component modules with type-only exports', () => {
    let result = transformComponentsForBrowser(
      `export interface CounterProps {
  count: number
}

export function Counter() {
  return ({ count }: CounterProps) => <button>{count}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: '/app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
  })
})

describe('transformComponentsForServer', () => {
  it('rewrites exported PascalCase function components into stateless HMR wrappers', () => {
    let result = transformComponentsForServer(
      `export function Counter(handle) {
  let count = 0
  return () => <button>{count}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.equal(
      getGeneratedComponentImplementation(result.code, 'Counter'),
      `function __remixUiHmrImpl_Counter__(handle) {
  let count = 0
  return () => <button>{count}</button>
}`,
    )
    assert.equal(
      getGeneratedImports(result.code),
      `import { __uiHmrServerRuntime__ as __remixUiHmr__ } from "@remix-run/ui-hmr/server-runtime";`,
    )
    assert.equal(
      getGeneratedPublicWrapper(result.code, 'Counter'),
      `export function Counter(handle) {
  return __remixUiHmr__.getCurrentComponentForHmr("file:///app/Counter.tsx", "Counter").apply(undefined, arguments);
}`,
    )
    assert.match(
      result.code,
      /__remixUiHmr__\.registerComponentForHmr\("file:\/\/\/app\/Counter\.tsx", "Counter", __remixUiHmrImpl_Counter__\);/,
    )
    assert.equal(result.code.includes('getComponentHmrState'), false)
    assert.equal(result.code.includes('setupComponentForHmr'), false)
    assert.equal(result.code.includes('__remixUIRefresh__'), false)
    assert.equal(
      getGeneratedComponentNames(result.code),
      `let __remixUiHmrComponentNames__ = ["Counter"];`,
    )
    assert.equal(
      getGeneratedPreviousExports(result.code),
      `let __remixUiHmrPreviousExports__ = {
  "Counter": Counter,
};`,
    )
    assert.equal(getGeneratedUpdatedExportsCheck(result.code), updatedExportsCheckStatement)
    assert.equal(getGeneratedComponentModuleUpdate(result.code), null)
  })

  it('derives server runtime imports from the import source', () => {
    let result = transformComponentsForServer(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: 'remix', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(
      getGeneratedImports(result.code),
      `import { __uiHmrServerRuntime__ as __remixUiHmr__ } from "remix/ui-hmr/server-runtime";`,
    )
  })

  it('supports custom server runtime import sources', () => {
    let result = transformComponentsForServer(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@acme/remix', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(
      getGeneratedImports(result.code),
      `import { __uiHmrServerRuntime__ as __remixUiHmr__ } from "@acme/remix/ui-hmr/server-runtime";`,
    )
  })

  it('generates source maps for transformed server modules', () => {
    let source = `export function Counter() {
  return () => <button>Count</button>
}
`
    let result = transformComponentsForServer(source, {
      importSource: '@remix-run',
      moduleUrl: 'file:///app/Counter.tsx',
      sourceMap: true,
    })

    assert.equal(result.transformed, true)
    assertSourceMapPosition(result.map, result.code, source, '<button>Count</button>')
  })

  it('rewrites exported client entry function components without hoisting setup state', () => {
    let result = transformComponentsForServer(
      `export const Counter = clientEntry(import.meta.url, function Counter(handle) {
  let count = 0
  return () => jsx('button', { children: count })
})
`,
      { importSource: '@remix-run', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.equal(
      getGeneratedComponentImplementation(result.code, 'Counter'),
      `function __remixUiHmrImpl_Counter__(handle) {
  let count = 0
  return () => jsx('button', { children: count })
}`,
    )
    assert.equal(
      getGeneratedPublicWrapper(result.code, 'Counter'),
      `export const Counter = clientEntry(import.meta.url, function Counter(handle) {
  return __remixUiHmr__.getCurrentComponentForHmr("file:///app/Counter.tsx", "Counter").apply(undefined, arguments);
})`,
    )
    assert.equal(
      getGeneratedComponentNames(result.code),
      `let __remixUiHmrComponentNames__ = ["Counter"];`,
    )
    assert.equal(
      getGeneratedPreviousExports(result.code),
      `let __remixUiHmrPreviousExports__ = {
  "Counter": Counter,
};`,
    )
    assert.equal(getGeneratedUpdatedExportsCheck(result.code), updatedExportsCheckStatement)
    assert.equal(getGeneratedComponentModuleUpdate(result.code), null)
    assert.equal(result.code.includes('__s__.count'), false)
  })

  it('does not transform non-component functions', () => {
    let source = `export function loader() {
  return new Response('ok')
}
`
    let result = transformComponentsForServer(source, {
      importSource: '@remix-run',
      moduleUrl: 'file:///app/loader.ts',
    })

    assert.equal(result.transformed, false)
    assert.equal(result.code, source)
  })

  it('transforms component modules with non-component tracked exports', () => {
    let result = transformComponentsForServer(
      `export const loader = () => new Response('ok')

export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@remix-run', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
    assert.equal(
      getGeneratedPreviousExports(result.code),
      `let __remixUiHmrPreviousExports__ = {
  "loader": loader,
  "Counter": Counter,
};`,
    )
  })

  it('rejects updates with incompatible tracked exports', () => {
    let result = transformComponentsForServer(
      `export function Counter() {
  return () => <button>Count</button>
}
`,
      { importSource: '@remix-run', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.equal(getGeneratedUpdatedExportsCheck(result.code), updatedExportsCheckStatement)
  })

  it('allows component modules with type-only exports', () => {
    let result = transformComponentsForServer(
      `export type CounterProps = {
  count: number
}

export function Counter() {
  return ({ count }: CounterProps) => <button>{count}</button>
}
`,
      { importSource: '@remix-run', moduleUrl: 'file:///app/Counter.tsx' },
    )

    assert.equal(result.transformed, true)
    assert.deepEqual(result.componentNames, ['Counter'])
  })
})

function assertSourceMapPosition(
  sourceMap: string | null,
  generatedSource: string,
  originalSource: string,
  search: string,
): void {
  assert.ok(sourceMap)
  let consumer = new SourceMapConsumer(JSON.parse(sourceMap))
  let generated = getLineAndColumn(generatedSource, search)
  let expected = getLineAndColumn(originalSource, search)
  let original = consumer.originalPositionFor(generated)

  assert.equal(original.line, expected.line)
  assert.equal(original.column, expected.column)
}

function getGeneratedComponentImplementation(code: string, componentName: string): string {
  let implementationName = `__remixUiHmrImpl_${componentName}__`
  let start = code.indexOf(`function ${implementationName}`)
  assert.notEqual(start, -1)

  let end = findFirstIndex(
    [
      `\nexport function ${componentName}`,
      `\nfunction ${componentName}`,
      `\nexport const ${componentName}`,
      `\nconst ${componentName}`,
    ],
    code,
    start,
  )
  assert.notEqual(end, -1)

  return code
    .slice(start, end)
    .replace(
      /"[^"]+", \(__s__\) => \{/,
      `"<setup-hash>", (__s__) => {`,
    )
}

function getGeneratedImports(code: string): string {
  let end = code.indexOf('\nfunction __remixUiHmrImpl_')
  assert.notEqual(end, -1)

  return code.slice(0, end)
}

function getGeneratedPublicWrapper(code: string, componentName: string): string {
  let implementationStart = code.indexOf(`function __remixUiHmrImpl_${componentName}__`)
  assert.notEqual(implementationStart, -1)

  let start = findFirstIndex(
    [
      `\nexport function ${componentName}`,
      `\nfunction ${componentName}`,
      `\nexport const ${componentName}`,
      `\nconst ${componentName}`,
    ],
    code,
    implementationStart,
  )
  assert.notEqual(start, -1)

  let end = findFirstIndex(
    [`\n__remixUiHmr__.registerComponentForHmr`, `\nexport {\n`],
    code,
    start + 1,
  )
  assert.notEqual(end, -1)

  return code.slice(start + 1, end)
}

function getGeneratedPreviousExports(code: string): string {
  let prefix = 'let __remixUiHmrPreviousExports__ = '
  let start = code.indexOf(prefix)
  assert.notEqual(start, -1)

  let end = code.indexOf(';\n  import.meta.hot.accept', start)
  assert.notEqual(end, -1)

  return code.slice(start, end + 1)
}

function getGeneratedNamedExports(code: string): string {
  let start = code.indexOf('\nexport {\n')
  assert.notEqual(start, -1)

  let end = code.indexOf('\n}', start)
  assert.notEqual(end, -1)

  return code.slice(start + 1, end + 2)
}

function getGeneratedComponentNames(code: string): string {
  let match = /let __remixUiHmrComponentNames__ = [^;]+;/.exec(code)
  assert.ok(match)

  return match[0]
}

function getGeneratedUpdatedExportsCheck(code: string): string {
  let prefix = 'let __remixUiHmrInvalidationMessage__ = '
  let start = code.indexOf(prefix)
  assert.notEqual(start, -1)

  let end = findFirstIndex(
    [`;\n      if (__remixUiHmrInvalidationMessage__)`, `;\n    if (__remixUiHmrInvalidationMessage__)`],
    code,
    start,
  )
  assert.notEqual(end, -1)

  return code.slice(start, end + 1)
}

function getGeneratedComponentModuleUpdate(code: string): string | null {
  let match = /__remixUiHmr__\.updateComponentModuleForHmr\([^;]+;/.exec(code)
  return match?.[0] ?? null
}

function findFirstIndex(needles: readonly string[], haystack: string, fromIndex: number): number {
  let firstIndex = -1

  for (let needle of needles) {
    let index = haystack.indexOf(needle, fromIndex)
    if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
      firstIndex = index
    }
  }

  return firstIndex
}

function getLineAndColumn(source: string, search: string): { column: number; line: number } {
  let index = source.indexOf(search)
  assert.notEqual(index, -1)

  let lines = source.slice(0, index).split('\n')
  return {
    column: lines.at(-1)?.length ?? 0,
    line: lines.length,
  }
}
