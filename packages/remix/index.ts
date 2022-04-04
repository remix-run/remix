// This class exists to prevent https://github.com/remix-run/remix/issues/2031 from occuring
export class RemixNotSetupError extends Error {
  constructor() {
    console.warn(
      "Importing from `remix` is deprecated. Import from `@remix-run/*` packages instead."
    );
    console.log(
      "HINT: To migrate from `remix` imports, run `npx @remix-run/dev migrate --migration replace-remix-imports <remix project directory>`."
    );
    super("Did you forget to run `remix setup` for your platform?");
  }
}

throw new RemixNotSetupError();
