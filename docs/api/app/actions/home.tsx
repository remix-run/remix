export function Home() {
  return () => (
    <>
      <h1>Welcome to Remix 3!</h1>
      <p>
        Remix is a batteries-included, ultra-productive, zero-dependency, bundler-free framework,
        ready for development in a model-first world. Remix 3 is built on the following principles:
      </p>

      <ol>
        <li>
          <b>Model-First Development.</b> AI fundamentally shifts the human-computer interaction
          model for both user experience and developer workflows. Optimize the source code,
          documentation, tooling, and abstractions for LLMs. Additionally, develop abstractions for
          applications to use models in the product itself, not just as a tool to develop it.
        </li>
        <li>
          <b>Build on Web APIs.</b> Sharing abstractions across the stack greatly reduces the amount
          of context switching, both for humans and machines. Build on the foundation of Web APIs
          and JavaScript because it is the only full stack ecosystem.
        </li>
        <li>
          <b>Religiously Runtime.</b> Designing for bundlers/compilers/typegen (and any pre-runtime
          static analysis) leads to poor API design that eventually pollutes the entire system. All
          packages must be designed with no expectation of static analysis and all tests must run
          without bundling. Because browsers are involved, --import loaders for simple
          transformations like TypeScript and JSX are permissible.
        </li>
        <li>
          <b>Avoid Dependencies.</b> Dependencies lock you into somebody else's roadmap. Choose them
          wisely, wrap them completely, and expect to replace most of them with our own package
          eventually. The goal is zero.
        </li>
        <li>
          <b>Demand Composition.</b> Abstractions should be single-purpose and replaceable. A
          composable abstraction is easy to add and remove from an existing program. Every package
          must be useful and documented independent of any other context. New features should first
          be attempted as a new package. If impossible, attempt to break up the existing package to
          make it more composable. However, tightly coupled modules that almost always change
          together in both directions should be moved to the same package.
        </li>
        <li>
          <b>Distribute Cohesively.</b> Extremely composable ecosystems are difficult to learn and
          use. Remix will be distributed as a single remix package for both distribution and
          documentation.
        </li>
      </ol>
    </>
  )
}
