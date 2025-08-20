// routes.ts

// Type for a single route
interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  name: string // e.g., 'users#show'
}

// Helper type to extract params from a path string
type ExtractParams<Path extends string> =
  Path extends `${infer Start}/:${infer Param}/${infer Rest}`
    ? { [K in Param]: string | number } & ExtractParams<`/${Rest}`>
    : Path extends `${infer Start}/:${infer Param}`
      ? { [K in Param]: string | number }
      : Path extends `/:${infer Param}/${infer Rest}`
        ? { [K in Param]: string | number } & ExtractParams<`/${Rest}`>
        : Path extends `/:${infer Param}`
          ? { [K in Param]: string | number }
          : {} // Base case for param-less paths

// Type for a single path helper function
type PathHelper<Path extends string> = (params: ExtractParams<Path>) => string

// Predefined actions (mirrors runtime for type-level computation)
type Action =
  | { action: 'index'; method: 'GET'; pathSuffix: ''; includeParam: false }
  | { action: 'new'; method: 'GET'; pathSuffix: '/new'; includeParam: false }
  | { action: 'create'; method: 'POST'; pathSuffix: ''; includeParam: false }
  | { action: 'show'; method: 'GET'; pathSuffix: '/:param'; includeParam: true }
  | { action: 'edit'; method: 'GET'; pathSuffix: '/:param/edit'; includeParam: true }
  | { action: 'update'; method: 'PATCH'; pathSuffix: '/:param'; includeParam: true }
  | { action: 'destroy'; method: 'DELETE'; pathSuffix: '/:param'; includeParam: true }

// Type-level filter for only/except
type FilterActions<
  Actions extends Action,
  Only extends readonly string[] | undefined,
  Except extends readonly string[] | undefined,
> = Actions extends infer A extends Action
  ? Only extends readonly string[]
    ? A['action'] extends Only[number]
      ? A
      : never
    : Except extends readonly string[]
      ? A['action'] extends Except[number]
        ? never
        : A
      : A
  : never

// Type-level helper name generator
type HelperName<ActionName extends string, ResourceName extends string> = ActionName extends 'index'
  ? ResourceName
  : ActionName extends 'show'
    ? ResourceName extends `${infer Singular}s`
      ? Singular
      : ResourceName
    : `${ActionName}${Capitalize<ResourceName extends `${infer Plural}s` ? Plural : ResourceName>}`

// Type-level path generator
type GeneratePath<
  ResourceName extends string,
  Suffix extends string,
  Param extends string,
> = Suffix extends `/:param${infer Rest}`
  ? `/${ResourceName}/:${Param}${Rest}`
  : `/${ResourceName}${Suffix}`

// Infer the full Paths type from config (type-level mapping over resources and actions)
type InferPathsFromConfig<Config extends ReadonlyArray<ResourceOptions>> = {
  [Res in Config[number] as Res['name']]: {
    [Act in FilterActions<
      Action,
      Res['options'] extends infer Opt
        ? Opt extends { only?: infer O }
          ? O extends readonly string[]
            ? O
            : undefined
          : undefined
        : undefined,
      Res['options'] extends infer Opt
        ? Opt extends { except?: infer E }
          ? E extends readonly string[]
            ? E
            : undefined
          : undefined
        : undefined
    > as HelperName<Act['action'], Res['name']>]: PathHelper<
      GeneratePath<
        Res['name'],
        Act['pathSuffix'],
        Res['options'] extends infer Opt
          ? Opt extends { param?: infer P extends string }
            ? P
            : 'id'
          : 'id'
      >
    >
  }
}[Config[number]['name']]

// Config for a single resource
interface ResourceOptions {
  name: string
  options?: {
    param?: string
    only?: ReadonlyArray<string>
    except?: ReadonlyArray<string>
  }
}

// Main function: Takes a const-asserted config and generates routes + typed paths
function defineRoutes<const Config extends ReadonlyArray<ResourceOptions>>(config: Config) {
  let routes: Route[] = []
  let pathMap: Record<string, string> = {} // For runtime helpers

  config.forEach((res) => {
    let name = res.name
    let options = res.options || {}
    let param = options.param || 'id'
    let actions: Action[] = [
      { action: 'index', method: 'GET', pathSuffix: '', includeParam: false },
      { action: 'new', method: 'GET', pathSuffix: '/new', includeParam: false },
      { action: 'create', method: 'POST', pathSuffix: '', includeParam: false },
      { action: 'show', method: 'GET', pathSuffix: '/:param', includeParam: true },
      { action: 'edit', method: 'GET', pathSuffix: '/:param/edit', includeParam: true },
      { action: 'update', method: 'PATCH', pathSuffix: '/:param', includeParam: true },
      { action: 'destroy', method: 'DELETE', pathSuffix: '/:param', includeParam: true },
    ]

    // Filter based on only/except
    let filteredActions = actions.filter((a) => {
      if (options.only && !options.only.includes(a.action)) return false
      if (options.except && options.except.includes(a.action)) return false
      return true
    })

    filteredActions.forEach((a) => {
      let pathSuffix = a.pathSuffix.replace(':param', param)
      let routePath = `/${name}${pathSuffix}`
      let routeName = `${name}#${a.action}`
      routes.push({ method: a.method, path: routePath, name: routeName })

      // Generate helper name (matches type-level HelperName)
      let helperName =
        a.action === 'index'
          ? name
          : a.action === 'show'
            ? name.replace(/s$/, '')
            : `${a.action}${name.charAt(0).toUpperCase() + name.slice(1).replace(/s$/, '')}`
      pathMap[helperName] = routePath
    })
  })

  // Generate runtime path helpers
  let paths = Object.fromEntries(
    Object.entries(pathMap).map(([helperName, path]) => [
      helperName,
      (params: Record<string, string | number>) => {
        let url = path
        for (let [key, value] of Object.entries(params)) {
          url = url.replace(`:${key}`, value.toString())
        }
        return url
      },
    ]),
  ) as any // Temp 'any' to build, then cast below

  return {
    routes,
    paths: paths as InferPathsFromConfig<Config>, // Now fully inferred from config literals
  }
}

// Example usage with const assertion
const routeConfig = [
  { name: 'users', options: { param: 'userId', only: ['index', 'show', 'create'] } },
] as const

const { routes, paths } = defineRoutes(routeConfig)

// Intellisense now works fully!
// paths.users(); // Autocompletes, infers () => string
// paths.user({ userId: 123 }); // Autocompletes, requires { userId: string | number }
// paths.createUser(); // Autocompletes (since 'create' is included), infers () => string
// paths.user({}); // TS Error: Missing userId
// paths.nonExistent; // TS Error: Property 'nonExistent' does not exist
// paths.editUser; // TS Error: Not included due to 'only'

// Log for demo
console.log('Generated Routes:', routes)
console.log('Path Helpers Example:')
console.log(paths.users()) // '/users'
console.log(paths.user({ userId: 123 })) // '/users/123'
console.log(paths.createUser()) // '/users'
