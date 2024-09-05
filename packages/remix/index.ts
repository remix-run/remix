// This class exists to prevent https://github.com/remix-run/remix/issues/2031 from occurring
export class RemixPackageNotUsedError extends Error {
  constructor() {
    super(
      "The `remix` package is no longer used for Remix modules and should be removed " +
        "from your project dependencies. See " +
        "https://github.com/remix-run/remix/releases/tag/remix%402.0.0" +
        " for more information."
    );
  }
}

throw new RemixPackageNotUsedError();
