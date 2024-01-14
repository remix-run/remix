export function warnAboutExternalBindingsNotFound(
  bindingsNotFound: Set<string>,
  typeOfBinding: "Durable Objects" | "Service Bindings"
): void {
  console.warn(
    `\n\x1b[33mWarning:\nYou have requested ${typeOfBinding} but no local instance of such` +
      ` has been found.\nIn order to access your ${typeOfBinding} please start the relevant workers locally\n` +
      "with `wrangler dev` and then restart the next dev server.\n\n" +
      `The following bindings won't be accessible until then:\n ${[
        ...bindingsNotFound,
      ]
        .map((notFound) => ` - ${notFound}`)
        .join("\n")}\x1b[0m\n\n`
  );
}
